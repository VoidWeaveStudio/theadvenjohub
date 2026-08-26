// app/api/internal/game/companions/escrow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { adjustCompanion, readCompanionState } from "@/core/lib/companionInventory";
import { isCompanionId } from "@/features/game/data/companions";

const ACTIONS = new Set(["hold", "release", "deliver"]);

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { action, userId, gameId, itemId } = await req.json();

        if (!userId || !gameId || !isCompanionId(itemId) || !ACTIONS.has(action)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const delta = action === "hold" ? -1 : 1;
        const applied = await adjustCompanion(userId, gameId, itemId, delta);

        if (!applied) {
            return NextResponse.json(
                { error: action === "hold" ? "not_owned" : "grant_failed" },
                { status: action === "hold" ? 409 : 500 }
            );
        }

        return NextResponse.json({
            success: true,
            action,
            itemId,
            ...(await readCompanionState(userId, gameId)),
        });
    } catch (error) {
        console.error("[internal/companions/escrow] Error:", error);
        return NextResponse.json({ error: "escrow_failed" }, { status: 500 });
    }
}
