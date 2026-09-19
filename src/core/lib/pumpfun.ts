// src/core/lib/pumpfun.ts
import { getCache, setCache } from "@/core/lib/cache";

const CACHE_TTL_SECONDS = 20;
const FETCH_TIMEOUT_MS = 6000;
const IPFS_GATEWAY_PREFIX = "https://ipfs.io/ipfs/";
const PUMP_CDN_PREFIX = "https://pump.mypinata.cloud/ipfs/";

function toStableImageUrl(imageUri: unknown): string | undefined {
    if (typeof imageUri !== "string" || imageUri.length === 0) return undefined;
    if (imageUri.startsWith(IPFS_GATEWAY_PREFIX)) {
        return PUMP_CDN_PREFIX + imageUri.slice(IPFS_GATEWAY_PREFIX.length);
    }
    return imageUri;
}

async function fetchFromPumpFun(ca: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(
            `https://frontend-api-v3.pump.fun/coins/${ca}`,
            { cache: "no-store", signal: controller.signal }
        );

        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.mint) return null;

        return {
            name: data.name as string | undefined,
            symbol: data.symbol as string | undefined,
            image: toStableImageUrl(data.image_uri),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function getPumpFunTokenInfo(ca: string) {
    const cacheKey = `pumpfun-token:${ca.toLowerCase()}`;

    const cached = await getCache<any>(cacheKey);
    if (cached !== null) {
        return cached;
    }

    try {
        const data = await fetchFromPumpFun(ca);
        await setCache(cacheKey, data, CACHE_TTL_SECONDS);
        return data;
    } catch (e) {
        console.error("pump.fun API error:", e);
        return null;
    }
}
