//app\api\token-by-ca\route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const ca = searchParams.get("ca");

    if (!ca) return NextResponse.json(null);

    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
            cache: "no-store"
        });

        const data = await res.json();
        const pair = data.pairs?.[0];

        if (!pair) return NextResponse.json(null);

        return NextResponse.json({
            image: pair.info?.imageUrl,
            mc: pair.fdv || pair.marketCap || 0,
            name: pair.baseToken?.name,
            symbol: pair.baseToken?.symbol
        });
    } catch {
        return NextResponse.json(null);
    }
}