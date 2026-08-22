// app/api/auth/desktop-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { issueDesktopCode, isValidCodeChallenge } from "@/core/auth/lib/desktopCode";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit(`auth:desktop-code:${ip}`, {
    maxAttempts: 20,
    windowMs: 60_000,
    prefix: "api:auth:desktop-code",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { user } = authResult;

  if (!verifyCSRF(req)) {
    return NextResponse.json(
      { error: "invalid_csrf_token" },
      { status: 403, headers: formatRateLimitHeaders(rl) }
    );
  }

  const body = await req.json().catch(() => null);
  const codeChallenge = body?.codeChallenge;

  if (!isValidCodeChallenge(codeChallenge)) {
    return NextResponse.json(
      { error: "invalid_code_challenge" },
      { status: 400, headers: formatRateLimitHeaders(rl) }
    );
  }

  try {
    const code = await issueDesktopCode({
      userId: user.userId,
      wallet: user.wallet,
      codeChallenge,
    });

    return NextResponse.json({ code }, { headers: formatRateLimitHeaders(rl) });
  } catch (error) {
    console.error("[auth/desktop-code] Failed to issue code:", error);
    return NextResponse.json(
      { error: "code_issue_failed" },
      { status: 500, headers: formatRateLimitHeaders(rl) }
    );
  }
}
