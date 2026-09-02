// app/api/internal/game/companions/grant-fragments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { adjustWallet, readCompanionState } from "@/core/lib/companionInventory";

const MAX_GRANT = 100;

// Fragment payouts the game server hands out for world content — canyon bosses
// and quest rewards. Credit-only: a negative amount is rejected rather than clamped
// so a bug upstream can never quietly drain a wallet through this route.
export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId, fragments } = await req.json();

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const amount = Math.floor(Number(fragments));
        if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GRANT) {
            return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
        }

        const credited = await adjustWallet(userId, gameId, amount, 0);
        if (!credited) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

        return NextResponse.json({
            success: true,
            granted: amount,
            ...(await readCompanionState(userId, gameId)),
        });
    } catch (error) {
        console.error("[internal/companions/grant-fragments] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
