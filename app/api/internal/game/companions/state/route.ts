// app/api/internal/game/companions/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { readCompanionState, seedLegacyDog } from "@/core/lib/companionInventory";

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

        const legacyDogCount = Math.max(0, Math.floor(Number(body.legacyDogCount) || 0));
        if (legacyDogCount > 0) {
            await seedLegacyDog(userId, gameId, legacyDogCount);
        }

        return NextResponse.json(await readCompanionState(userId, gameId));
    } catch (error) {
        console.error("[internal/companions/state] Error:", error);
        return NextResponse.json({ error: "state_failed" }, { status: 500 });
    }
}
