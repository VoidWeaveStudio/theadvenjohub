// app/api/game/sign/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handlePngUpload } from "@/core/lib/blobUpload";

export async function POST(req: NextRequest): Promise<NextResponse> {
    return handlePngUpload(req, { folder: "signs", maxAttempts: 10, keepPerUser: 32 });
}
