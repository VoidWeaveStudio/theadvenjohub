//app\api\marketplace\config\route.ts
import { NextResponse } from "next/server";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function GET(req: Request) {
  const ip = (req as any).headers?.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await checkRateLimit(`marketplace:config:${ip}`, {
    maxAttempts: 100,
    windowMs: 60_000,
    prefix: "api:marketplace:config",
  });

  const config = {
    treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS?.trim(),
    tokenMint: process.env.NEXT_PUBLIC_TNJ_TOKEN_MINT_ADDRESS?.trim(),
    decimals: process.env.NEXT_PUBLIC_TNJ_DECIMALS?.trim() || "6",
    publicRpc: process.env.SOLANA_RPC_PRIVATE?.trim() || "https://mainnet.helius-rpc.com",
  };

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      ...formatRateLimitHeaders(rl),
    },
  });
}