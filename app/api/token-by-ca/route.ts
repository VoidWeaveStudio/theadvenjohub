//app\api\token-by-ca\route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const ca = searchParams.get("ca");

    if (!ca) return NextResponse.json(null);

    try {
        const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
            { cache: "no-store" }
        );

        const data = await res.json();
        const pair = data.pairs?.[0];

        if (!pair) return NextResponse.json(null);

        return NextResponse.json({
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
            url: pair.url,

            websites: pair.info?.websites || [],
            socials: pair.info?.socials || [],
            labels: pair.labels || []
        });

    } catch (e) {
        console.error("Dexscreener API error:", e);
        return NextResponse.json(null);
    }
}