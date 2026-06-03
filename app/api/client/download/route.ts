import { NextRequest, NextResponse } from "next/server";
import { list, getDownloadUrl } from "@vercel/blob";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    
    const rl = await checkRateLimit(`download:${ip}`, {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
      prefix: "api:download",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_downloads" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const userAgent = req.headers.get("user-agent") || "";
    const isWindows = userAgent.includes("Windows");
    const isMac = userAgent.includes("Mac");
    const isLinux = userAgent.includes("Linux");

    let filename: string;

    if (isWindows) {
      filename = "TANJO-Client-latest.exe";
    } else if (isMac) {
      filename = "TANJO-Client-latest.dmg";
    } else if (isLinux) {
      filename = "TANJO-Client-latest.AppImage";
    } else {
      filename = "TANJO-Client-latest.exe";
    }

    const blobPath = `releases/${filename}`;

    const { blobs } = await list({ prefix: "releases/" });
    const blob = blobs.find(b => b.pathname === blobPath);

    if (!blob) {
      return NextResponse.json(
        { error: "File not found", message: "The requested file is not available yet" },
        { status: 404 }
      );
    }

    const downloadUrl = await getDownloadUrl(blobPath, {
      validUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

    console.log(`[Download] ${filename} (${(blob.size / 1024 / 1024).toFixed(2)} MB) requested from ${ip}`);

    return NextResponse.redirect(downloadUrl.toString(), 302);

  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { error: "Download failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}