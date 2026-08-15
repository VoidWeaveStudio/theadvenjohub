// src/core/admin/verifyAdminAction.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { verifyCSRF } from "@/core/auth/lib/csrf";
import { verifySolanaSignature } from "@/core/auth/lib/signMessage";
import {
    buildAdminActionMessage,
    extractActionPayload,
    hashActionPayload,
} from "@/core/admin/adminActionMessage";

const MAX_ACTION_AGE_MS = 60_000;
const NONCE_TTL_SECONDS = 300;
const NONCE_MIN_LENGTH = 16;
const NONCE_MAX_LENGTH = 128;

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function verifyAdminAction(
    req: NextRequest,
    body: any,
    action: string,
    target: string
): Promise<NextResponse | null> {
    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "invalid_csrf_token" }, { status: 403 });
    }

    const { wallet, signature, timestamp, nonce } = body || {};
    if (
        typeof wallet !== "string" ||
        typeof signature !== "string" ||
        typeof timestamp !== "number" ||
        typeof nonce !== "string"
    ) {
        return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }

    if (nonce.length < NONCE_MIN_LENGTH || nonce.length > NONCE_MAX_LENGTH || !/^[\w-]+$/.test(nonce)) {
        return NextResponse.json({ error: "invalid_nonce" }, { status: 400 });
    }

    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet || wallet !== adminWallet) {
        return NextResponse.json({ error: "not_admin" }, { status: 403 });
    }

    if (Math.abs(Date.now() - timestamp) > MAX_ACTION_AGE_MS) {
        return NextResponse.json({ error: "signature_expired" }, { status: 401 });
    }

    const payloadHash = await hashActionPayload(extractActionPayload(body || {}));
    const message = buildAdminActionMessage({ action, target, timestamp, nonce, payloadHash });

    if (!verifySolanaSignature(signature, message, wallet)) {
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    let claimed: unknown;
    try {
        claimed = await redis.set(`admin:action:nonce:${nonce}`, timestamp, {
            nx: true,
            ex: NONCE_TTL_SECONDS,
        });
    } catch (error) {
        console.error("[verifyAdminAction] Nonce store unavailable:", error);
        return NextResponse.json({ error: "nonce_store_unavailable" }, { status: 503 });
    }

    if (claimed !== "OK") {
        return NextResponse.json({ error: "signature_replayed" }, { status: 409 });
    }

    return null;
}
