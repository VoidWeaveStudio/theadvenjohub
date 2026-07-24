// app/api/marketplace/config/route.ts
import { NextResponse } from "next/server";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

export async function GET(req: Request) {
  const ip = getClientIp(req as Request);
  const rl = await checkRateLimit(`marketplace:config:${ip}`, {
    maxAttempts: 100,
    windowMs: 60_000,
    prefix: "api:marketplace:config",
  });

  const config = {
    treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS?.trim(),
    tokenMint: process.env.NEXT_PUBLIC_TNJ_TOKEN_MINT_ADDRESS?.trim(),
    decimals: process.env.NEXT_PUBLIC_TNJ_DECIMALS?.trim() || "6",
    publicRpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com",
  };

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      ...formatRateLimitHeaders(rl),
    },
  });
}