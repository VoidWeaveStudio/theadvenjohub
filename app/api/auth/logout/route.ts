//app\api\auth\logout\route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await checkRateLimit(`auth:logout:${ip}`, {
    maxAttempts: 20,
    windowMs: 60_000,
    prefix: "api:auth:logout",
  });

  const response = NextResponse.json({ success: true }, {
    headers: formatRateLimitHeaders(rl),
  });

  response.cookies.delete("token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("csrf_token");

  return response;
}

export { POST as DELETE };