// app/api/internal/game/cosmetic-crates/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { readCosmeticCrateState } from "@/core/lib/cosmeticCrates";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId } = await req.json();

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        return NextResponse.json({ success: true, ...(await readCosmeticCrateState(userId, gameId)) });
    } catch (error) {
        console.error("[internal/cosmetic-crates/state] Error:", error);
        return NextResponse.json({ error: "state_failed" }, { status: 500 });
    }
}
