// app/api/solana/rpc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getVersion",
  "sendTransaction",
  "simulateTransaction",
]);

const MAX_BATCH_SIZE = 10;
const MAX_BODY_BYTES = 256 * 1024;

function isAllowedPayload(payload: unknown): boolean {
  const calls = Array.isArray(payload) ? payload : [payload];

  if (calls.length === 0 || calls.length > MAX_BATCH_SIZE) return false;

  return calls.every((call) => {
    if (typeof call !== "object" || call === null) return false;
    const method = (call as { method?: unknown }).method;
    return typeof method === "string" && ALLOWED_METHODS.has(method);
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit(`solana:rpc:${ip}`, {
    maxAttempts: 240,
    windowMs: 60_000,
    prefix: "api:solana:rpc",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const upstream = process.env.SOLANA_RPC_PRIVATE?.trim();
  if (!upstream) {
    console.error("[solana/rpc] SOLANA_RPC_PRIVATE is not set");
    return NextResponse.json({ error: "rpc_not_configured" }, { status: 500 });
  }

  const raw = await req.text();

  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers: formatRateLimitHeaders(rl) });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: formatRateLimitHeaders(rl) });
  }

  if (!isAllowedPayload(payload)) {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 403, headers: formatRateLimitHeaders(rl) });
  }

  try {
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
      cache: "no-store",
    });

    const body = await upstreamRes.text();

    return new NextResponse(body, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...formatRateLimitHeaders(rl),
      },
    });
  } catch (error: any) {
    console.error("[solana/rpc] Upstream request failed:", error?.message || error);
    return NextResponse.json({ error: "rpc_unavailable" }, { status: 502, headers: formatRateLimitHeaders(rl) });
  }
}
