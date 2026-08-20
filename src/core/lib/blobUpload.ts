// src/core/lib/blobUpload.ts
import { NextRequest, NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 64 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngUploadOptions {
    folder: string;
    maxAttempts: number;
    keepPerUser: number;
}

async function prunePreviousUploads(prefix: string, keep: number, currentUrl: string): Promise<void> {
    try {
        const { blobs } = await list({ prefix });
        const stale = blobs
            .filter((blob) => blob.url !== currentUrl)
            .sort((a, b) => a.pathname.localeCompare(b.pathname))
            .slice(0, Math.max(0, blobs.length - keep));

        if (stale.length === 0) return;
        await del(stale.map((blob) => blob.url));
    } catch (error) {
        console.error(`[blobUpload] Prune failed for ${prefix}:`, error);
    }
}

export async function handlePngUpload(
    req: NextRequest,
    { folder, maxAttempts, keepPerUser }: PngUploadOptions
): Promise<NextResponse> {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return authResult;
    }
    const { user } = authResult;

    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "invalid_csrf_token" }, { status: 403 });
    }

    const rl = await checkRateLimit(`game:${folder}:upload:${user.userId}`, {
        maxAttempts,
        windowMs: 60_000,
        prefix: `api:game:${folder}:upload`,
    });

    if (!rl.allowed) {
        return NextResponse.json(
            { error: "too_many_attempts" },
            { status: 429, headers: formatRateLimitHeaders(rl) }
        );
    }

    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "file_too_large" }, { status: 413, headers: formatRateLimitHeaders(rl) });
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

        const prefix = `${folder}/${user.userId}/`;
        const blob = await put(`${prefix}${Date.now()}.png`, buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: "image/png",
        });

        await prunePreviousUploads(prefix, keepPerUser, blob.url);

        return NextResponse.json({ url: blob.url }, { headers: formatRateLimitHeaders(rl) });
    } catch (error) {
        console.error(`[game/${folder}/upload] Error:`, error);
        return NextResponse.json({ error: "upload_failed" }, { status: 500, headers: formatRateLimitHeaders(rl) });
    }
}
