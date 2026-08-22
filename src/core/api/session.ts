// src/core/api/session.ts
import { getCsrfToken } from "@/core/lib/clientUtils";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let refreshInFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;
let lastFailureAt = 0;

const FAILURE_COOLDOWN_MS = 30_000;

export async function refreshSession(): Promise<boolean> {
    if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return false;

    if (!refreshInFlight) {
        refreshInFlight = fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
        })
            .then(async (res) => {
                if (!res.ok) {
                    lastFailureAt = Date.now();
                    return false;
                }
                const payload = await res.json().catch(() => null);
                const ok = payload?.success === true;
                if (ok) {
                    lastRefreshAt = Date.now();
                    lastFailureAt = 0;
                } else {
                    lastFailureAt = Date.now();
                }
                return ok;
            })
            .catch(() => {
                lastFailureAt = Date.now();
                return false;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }

    return refreshInFlight;
}

export function noteAuthenticated(): void {
    lastFailureAt = 0;
}

function buildInit(init: RequestInit): RequestInit {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);

    if (!SAFE_METHODS.has(method) && !headers.has("x-csrf-token")) {
        const csrf = getCsrfToken();
        if (csrf) headers.set("x-csrf-token", csrf);
    }

    return { ...init, method, headers, credentials: "include" };
}

export async function sessionFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const first = await fetch(url, buildInit(init));
    if (first.status !== 401 && first.status !== 403) return first;

    if (!(await refreshSession())) return first;

    return fetch(url, buildInit(init));
}

export async function keepSessionAlive(minIntervalMs = 60_000): Promise<void> {
    if (Date.now() - lastRefreshAt < minIntervalMs) return;
    await refreshSession();
}
