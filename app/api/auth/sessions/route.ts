// app/api/auth/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { listSessions, revokeSession } from "@/core/auth/lib/sessionRegistry";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

function currentSessionId(req: NextRequest): string | null {
  const token = req.cookies.get("refresh_token")?.value;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users",
    }) as { sid?: string };

    return decoded.sid ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(`auth:sessions:${getClientIp(req)}`, {
    maxAttempts: 60,
    windowMs: 60_000,
    prefix: "api:auth:sessions",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const active = currentSessionId(req);
  const sessions = await listSessions(user.userId);

  return NextResponse.json(
    {
      sessions: sessions.map((session) => ({
        sid: session.sid,
        device: session.device,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: session.sid === active,
      })),
    },
    { headers: formatRateLimitHeaders(rl) }
  );
}

export async function DELETE(req: NextRequest) {
  const rl = await checkRateLimit(`auth:sessions:delete:${getClientIp(req)}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    prefix: "api:auth:sessions:delete",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  if (!verifyCSRF(req)) {
    return NextResponse.json(
      { error: "invalid_csrf_token" },
      { status: 403, headers: formatRateLimitHeaders(rl) }
    );
  }

  const { user } = authResult;
  const body = await req.json().catch(() => null);
  const sid = typeof body?.sid === "string" ? body.sid : null;

  if (!sid || !/^[a-f0-9]{32}$/.test(sid)) {
    return NextResponse.json(
      { error: "invalid_session_id" },
      { status: 400, headers: formatRateLimitHeaders(rl) }
    );
  }

  await revokeSession(user.userId, sid);

  return NextResponse.json({ success: true }, { headers: formatRateLimitHeaders(rl) });
}
