// app/api/game/poster/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handlePngUpload } from "@/core/lib/blobUpload";

export async function POST(req: NextRequest): Promise<NextResponse> {
    return handlePngUpload(req, { folder: "posters", maxAttempts: 20, keepPerUser: 12 });
}
