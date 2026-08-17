// src/features/game/utils/apiCache.ts
const DEFAULT_TTL_MS = 30000;

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { at: number; value: unknown }>();

export function fetchJsonShared<T>(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
    const now = Date.now();

    const hit = cache.get(url);
    if (hit && now - hit.at < ttlMs) return Promise.resolve(hit.value as T);

    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;

    const request = fetch(url)
        .then((res) => {
            if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
            return res.json();
        })
        .then((value) => {
            cache.set(url, { at: Date.now(), value });
            return value as T;
        })
        .finally(() => {
            inflight.delete(url);
        });

    inflight.set(url, request);
    return request as Promise<T>;
}

export function invalidateShared(url: string): void {
    cache.delete(url);
}
