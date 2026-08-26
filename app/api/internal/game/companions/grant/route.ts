// app/api/internal/game/companions/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { adjustCompanion, readCompanionState } from "@/core/lib/companionInventory";
import { COMPANIONS_BY_ID, type CompanionId } from "@/features/game/data/companions";

const MAX_GRANT = 5;

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId, itemId, quantity } = await req.json();

        if (!userId || !gameId || typeof itemId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const definition = COMPANIONS_BY_ID.get(itemId as CompanionId);
        if (!definition) {
            return NextResponse.json({ error: "unknown_companion" }, { status: 404 });
        }

        if (definition.source !== "boss") {
            return NextResponse.json({ error: "not_a_world_drop" }, { status: 403 });
        }

        const amount = Math.floor(Number(quantity ?? 1));
        if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GRANT) {
            return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
        }

        const granted = await adjustCompanion(userId, gameId, itemId, amount);
        if (!granted) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

        return NextResponse.json({
            success: true,
            itemId,
            granted: amount,
            ...(await readCompanionState(userId, gameId)),
        });
    } catch (error) {
        console.error("[internal/companions/grant] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
