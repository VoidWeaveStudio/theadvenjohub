// src/app/api/dexscreener/route.ts
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/solana", {
            cache: "no-store"
        });

        if (!res.ok) throw new Error("Dexscreener API failed");
        const data = await res.json();
        const pairs = data.pairs || [];

        const NOW = Date.now();
        const FIFTEEN_MINUTES = 15 * 60 * 1000;

        const qualifiedTokens = pairs
            .filter((p: any) => {
                const isSolana = p.chainId === "solana";
                
                const isRecent = p.pairCreatedAt && (NOW - p.pairCreatedAt) < FIFTEEN_MINUTES;
                
                const hasSomeMC = typeof p.marketCap === "number" && p.marketCap >= 1000;
                
                return isSolana && isRecent && hasSomeMC;
            })
            .slice(0, 50)
            .map((p: any) => {
                const fallbackImage = "https://cryptologos.cc/logos/solana-sol-logo.png"; 
                
                return {
                    address: p.baseToken.address,
                    name: p.baseToken.name || p.baseToken.symbol || "New Meme",
                    symbol: p.baseToken.symbol || "MEME",
                    image: p.info?.imageUrl || fallbackImage,
                    marketCap: p.marketCap,
                    createdAt: p.pairCreatedAt
                };
            });

        console.log(`[API] Found ${qualifiedTokens.length} fresh tokens (< 15 min old)`);
        return NextResponse.json(qualifiedTokens);
        
    } catch (error) {
        console.error("Dexscreener API Error:", error);
        return NextResponse.json([], { status: 200 });
    }
}