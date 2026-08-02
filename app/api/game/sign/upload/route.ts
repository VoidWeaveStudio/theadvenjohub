// app/api/game/sign/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";
import { put } from "@vercel/blob";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function POST(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return authResult;
    }
    const { user } = authResult;

    const rl = await checkRateLimit(`game:sign:upload:${user.userId}`, {
        maxAttempts: 10,
        windowMs: 60_000,
        prefix: "api:game:sign:upload",
    });

    if (!rl.allowed) {
        return NextResponse.json(
            { error: "too_many_attempts" },
            { status: 429, headers: formatRateLimitHeaders(rl) }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "no_file" }, { status: 400, headers: formatRateLimitHeaders(rl) });
        }
        if (file.type !== "image/png") {
            return NextResponse.json({ error: "unsupported_file_type" }, { status: 400, headers: formatRateLimitHeaders(rl) });
        }
        if (file.size > MAX_FILE_BYTES) {
            return NextResponse.json({ error: "file_too_large" }, { status: 400, headers: formatRateLimitHeaders(rl) });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const isPng = PNG_SIGNATURE.every((byte, i) => buffer[i] === byte);
        if (!isPng) {
            return NextResponse.json({ error: "invalid_png" }, { status: 400, headers: formatRateLimitHeaders(rl) });
        }

        const blob = await put(`signs/${user.userId}/${Date.now()}.png`, buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: "image/png",
        });

        return NextResponse.json({ url: blob.url }, { headers: formatRateLimitHeaders(rl) });
    } catch (error) {
        console.error("[game/sign/upload] Error:", error);
        return NextResponse.json({ error: "upload_failed" }, { status: 500, headers: formatRateLimitHeaders(rl) });
    }
}
