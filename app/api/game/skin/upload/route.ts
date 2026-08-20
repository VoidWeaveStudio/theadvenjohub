// app/api/game/skin/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handlePngUpload } from "@/core/lib/blobUpload";

export async function POST(req: NextRequest): Promise<NextResponse> {
    return handlePngUpload(req, { folder: "skins", maxAttempts: 10, keepPerUser: 3 });
}
