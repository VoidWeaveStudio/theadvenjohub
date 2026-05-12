// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`auth:refresh:${ip}`, {
      maxAttempts: 10,
      windowMs: 60_000,
      prefix: "api:auth:refresh",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const refreshToken = req.cookies.get("refresh_token")?.value;
    const jwtSecret = process.env.JWT_SECRET;

    if (!refreshToken || !jwtSecret) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const decoded = jwt.verify(refreshToken, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users",
    }) as { userId: string; wallet: string; iat: number };

    const newAccessToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users",
      }
    );

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users",
      }
    );

    const newCsrfToken = generateCSRFToken();
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { success: true, csrfToken: newCsrfToken },
      { headers: formatRateLimitHeaders(rl) }
    );

    const baseCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  domain: process.env.NODE_ENV === "production" 
    ? ".theadvenjo.online"
    : undefined,
};

    response.cookies.set("token", newAccessToken, {
      ...baseCookieOptions,
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", newRefreshToken, {
      ...baseCookieOptions,
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set("csrf_token", newCsrfToken, {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });

    return response;

  } catch (error) {
    const response = NextResponse.json(
      { error: "session_expired" },
      { status: 401 }
    );
    response.cookies.delete("token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("csrf_token");
    return response;
  }
}