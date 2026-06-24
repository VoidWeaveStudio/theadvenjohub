// app/api/client/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const LATEST_RELEASE_URL = "https://github.com/VoidWeaveStudio/theadvenjohub/releases/latest/download/TANJO.Game.Store_0.1.4_x64-setup.exe";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`download:${ip}`, {
      maxAttempts: 100,
      windowMs: 60 * 60 * 1000,
      prefix: "api:download",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_downloads" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    console.log(`[Download] Redirecting to GitHub from ${ip}`);
    
    return NextResponse.redirect(LATEST_RELEASE_URL, 302);

  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}