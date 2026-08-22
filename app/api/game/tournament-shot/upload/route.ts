// app/api/game/tournament-shot/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handlePngUpload } from "@/core/lib/blobUpload";

// Build-contest screenshots. keepPerUser is higher than the skins folder because
// one player can have a live entry in several contests at once, and pruning a
// blob that an entry still points at would blank out their submission.
export async function POST(req: NextRequest): Promise<NextResponse> {
    return handlePngUpload(req, { folder: "tournament-shots", maxAttempts: 6, keepPerUser: 12 });
}
