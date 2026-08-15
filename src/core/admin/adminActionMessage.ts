// src/core/admin/adminActionMessage.ts

export const ADMIN_SIGNATURE_FIELDS = ["wallet", "signature", "timestamp", "nonce"];

function normalizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }

    if (value && typeof value === "object") {
        const source = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(source).sort()) {
            if (source[key] === undefined) continue;
            result[key] = normalizeValue(source[key]);
        }
        return result;
    }

    return value;
}

export function stableStringify(payload: unknown): string {
    const normalized = normalizeValue(payload);
    return JSON.stringify(normalized === undefined ? null : normalized);
}

export async function hashActionPayload(payload: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(stableStringify(payload));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

export function extractActionPayload(body: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
        if (ADMIN_SIGNATURE_FIELDS.includes(key)) continue;
        payload[key] = value;
    }

    return payload;
}

export function buildAdminActionMessage(params: {
    action: string;
    target: string;
    timestamp: number;
    nonce: string;
    payloadHash: string;
}): string {
    const { action, target, timestamp, nonce, payloadHash } = params;
    return `TANJO Admin Action: ${action} ${target} at ${timestamp}\nNonce: ${nonce}\nPayload: ${payloadHash}`;
}
