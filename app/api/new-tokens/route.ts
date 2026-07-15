//app\api\new-tokens\route.ts
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
            cache: "no-store"
        });

        if (!res.ok) {
            return NextResponse.json([]);
        }

        const data = await res.json();
        const profiles = Array.isArray(data) ? data : [];

        const tokens = profiles
            .filter((p: any) => p.icon)
            .slice(0, 50)
            .map((p: any) => ({
                address: p.tokenAddress,
                chainId: p.chainId,
                name: p.description ? p.description.substring(0, 30) : "New Token",
                symbol: "NEW",
                image: p.icon || "fallback",
                url: p.url
            }));

        return NextResponse.json(tokens);
    } catch (error) {
        return NextResponse.json([], { status: 200 });
    }
}