// app/api/internal/game/companions/equip/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { equipCompanion, readCompanionState } from "@/core/lib/companionInventory";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const companionId = typeof body.companionId === "string" ? body.companionId : null;
        const result = await equipCompanion(userId, gameId, companionId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 403 });
        }

        return NextResponse.json({ success: true, ...(await readCompanionState(userId, gameId)) });
    } catch (error) {
        console.error("[internal/companions/equip] Error:", error);
        return NextResponse.json({ error: "equip_failed" }, { status: 500 });
    }
}
