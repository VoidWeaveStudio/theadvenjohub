// src/core/lib/dexscreener.ts
import { getCache, setCache } from "@/core/lib/cache";

const CACHE_TTL_SECONDS = 20;
const FETCH_TIMEOUT_MS = 6000;

async function fetchFromDexscreener(ca: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
            { cache: "no-store", signal: controller.signal }
        );

        const data = await res.json();
        const pair = data.pairs?.[0];

        if (!pair) return null;

        return {
            image: pair.info?.imageUrl,
            name: pair.baseToken?.name,
            symbol: pair.baseToken?.symbol,

            price: pair.priceUsd,
            priceNative: pair.priceNative,

            mc: pair.fdv || pair.marketCap || 0,

            liquidity: pair.liquidity?.usd,
            liquidityBase: pair.liquidity?.base,
            liquidityQuote: pair.liquidity?.quote,

            volume: pair.volume,
            txns: pair.txns,
            priceChange: pair.priceChange,

            dex: pair.dexId,
            pairAddress: pair.pairAddress,
            url: pair.pairAddress ? `https://dexscreener.com/solana/${pair.pairAddress}` : undefined,

            labels: pair.labels || []
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function getTokenByCa(ca: string) {
    const cacheKey = `token-by-ca:${ca.toLowerCase()}`;

    const cached = await getCache<any>(cacheKey);
    if (cached !== null) {
        return cached;
    }

    try {
        const data = await fetchFromDexscreener(ca);
        await setCache(cacheKey, data, CACHE_TTL_SECONDS);
        return data;
    } catch (e) {
        console.error("Dexscreener API error:", e);
        return null;
    }
}
