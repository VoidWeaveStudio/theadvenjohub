//app\api\auth\me\route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await checkRateLimit(`auth:me:${ip}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    prefix: "api:auth:me",
  });

  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { authenticated: false },
        {
          status: 401,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { error: "Server error" },
        {
          status: 500,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string; wallet: string };

    return NextResponse.json(
      {
        authenticated: true,
        user: { id: decoded.userId, wallet: decoded.wallet }
      },
      {
        headers: formatRateLimitHeaders(rl),
      }
    );
  } catch {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: formatRateLimitHeaders(rl),
      }
    );
  }
}