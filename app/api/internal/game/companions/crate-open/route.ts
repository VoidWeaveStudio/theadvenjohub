// app/api/internal/game/companions/crate-open/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { openCrate } from "@/core/lib/companionInventory";

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

        const result = await openCrate(userId, gameId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            itemId: result.itemId,
            rarity: result.rarity,
            owned: result.state.owned,
            equipped: result.state.equipped,
            fragments: result.state.fragments,
            crates: result.state.crates,
        });
    } catch (error) {
        console.error("[internal/companions/crate-open] Error:", error);
        return NextResponse.json({ error: "open_failed" }, { status: 500 });
    }
}
