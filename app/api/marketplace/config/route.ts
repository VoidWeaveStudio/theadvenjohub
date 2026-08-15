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

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const treasuryWallet = process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS?.trim();
  const tokenMint = process.env.NEXT_PUBLIC_TNJ_TOKEN_MINT_ADDRESS?.trim();

  if (!treasuryWallet || !tokenMint) {
    console.error("[marketplace/config] Treasury wallet or token mint is not configured");
    return NextResponse.json({ error: "payment_not_configured" }, { status: 500 });
  }

  if (treasuryWallet !== process.env.TREASURY_WALLET_ADDRESS?.trim()) {
    console.error("[marketplace/config] Public treasury wallet does not match the server-side one");
    return NextResponse.json({ error: "payment_not_configured" }, { status: 500 });
  }

  if (tokenMint !== process.env.TNJ_TOKEN_MINT_ADDRESS?.trim()) {
    console.error("[marketplace/config] Public token mint does not match the server-side one");
    return NextResponse.json({ error: "payment_not_configured" }, { status: 500 });
  }

  const config = {
    treasuryWallet,
    tokenMint,
    decimals: process.env.NEXT_PUBLIC_TNJ_DECIMALS?.trim() || "6",
  };

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      ...formatRateLimitHeaders(rl),
    },
  });
}
