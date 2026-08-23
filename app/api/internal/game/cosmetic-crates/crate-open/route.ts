// app/api/internal/game/cosmetic-crates/crate-open/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { openCosmeticCrate } from "@/core/lib/cosmeticCrates";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId } = await req.json();

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const result = await openCosmeticCrate(userId, gameId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            itemId: result.itemId,
            rarity: result.rarity,
            owned: result.state.owned,
            fragments: result.state.fragments,
            crates: result.state.crates,
        });
    } catch (error) {
        console.error("[internal/cosmetic-crates/crate-open] Error:", error);
        return NextResponse.json({ error: "open_failed" }, { status: 500 });
    }
}
