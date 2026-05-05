//app\api\auth\refresh\route.ts
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
        { error: "Too many refresh attempts" },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...formatRateLimitHeaders(rl),
          },
        }
      );
    }

    const refreshToken = req.cookies.get("refresh_token")?.value;
    const jwtSecret = process.env.JWT_SECRET;

    if (!refreshToken || !jwtSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const decoded = jwt.verify(refreshToken, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users"
    }) as { userId: string; wallet: string; iat: number };

    const newAccessToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users"
      }
    );

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users"
      }
    );

    const newCsrfToken = generateCSRFToken();

    const response = NextResponse.json({
      success: true,
      csrfToken: newCsrfToken
    }, {
      headers: formatRateLimitHeaders(rl),
    });

    const isProd = process.env.NODE_ENV === "production";

    response.cookies.set("token", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
      domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
    });

    response.cookies.set("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
      domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
    });

    response.cookies.set("csrf_token", newCsrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
      domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
    });

    return response;

  } catch (error: any) {
    const res = NextResponse.json(
      { error: "Session expired" },
      { status: 401 }
    );
    res.cookies.delete("token");
    res.cookies.delete("refresh_token");
    res.cookies.delete("csrf_token");
    return res;
  }
}