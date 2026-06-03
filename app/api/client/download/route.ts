//app\api\client\download\route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const MAX_FILE_SIZE = 500 * 1024 * 1024; 

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

    const releasesDir = path.join(process.cwd(), "releases");

    let filename: string;
    let contentType: string;

    if (isWindows) {
      filename = "TANJO-Client-latest.exe";
      contentType = "application/vnd.microsoft.portable-executable";
    } else if (isMac) {
      filename = "TANJO-Client-latest.dmg";
      contentType = "application/x-apple-diskimage";
    } else if (isLinux) {
      filename = "TANJO-Client-latest.AppImage";
      contentType = "application/x-executable";
    } else {
      filename = "TANJO-Client-latest.exe";
      contentType = "application/vnd.microsoft.portable-executable";
    }

    const filePath = path.join(releasesDir, filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found", message: "The requested file is not available yet" },
        { status: 404 }
      );
    }

    const statResult = await stat(filePath);

    if (statResult.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large" },
        { status: 413 }
      );
    }

    console.log(`[Download] ${filename} (${(statResult.size / 1024 / 1024).toFixed(2)} MB) requested from ${ip}`);

    const stream = createReadStream(filePath);

    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer | string) => {
          if (typeof chunk === 'string') {
            controller.enqueue(Buffer.from(chunk, 'utf-8'));
          } else {
            controller.enqueue(chunk);
          }
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          console.error('[Download] Stream error:', err);
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      }
    });

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": statResult.size.toString(),
        "Cache-Control": "public, max-age=3600",
        "Last-Modified": statResult.mtime.toUTCString(),
        ...formatRateLimitHeaders(rl),
      },
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}