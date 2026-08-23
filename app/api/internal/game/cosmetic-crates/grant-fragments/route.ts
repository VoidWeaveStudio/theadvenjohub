// app/api/internal/game/cosmetic-crates/grant-fragments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { adjustCosmeticWallet, readCosmeticCrateState } from "@/core/lib/cosmeticCrates";

const MAX_GRANT = 50;

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

        const credited = await adjustCosmeticWallet(userId, gameId, amount, 0);
        if (!credited) return NextResponse.json({ error: "grant_failed" }, { status: 500 });

        return NextResponse.json({
            success: true,
            granted: amount,
            ...(await readCosmeticCrateState(userId, gameId)),
        });
    } catch (error) {
        console.error("[internal/cosmetic-crates/grant-fragments] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
