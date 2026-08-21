// app/api/internal/game/companions/dust/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { dustCompanion } from "@/core/lib/companionInventory";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, itemId } = body;

        if (!userId || !gameId || typeof itemId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const result = await dustCompanion(userId, gameId, itemId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, itemId, gained: result.fragments, ...result.state });
    } catch (error) {
        console.error("[internal/companions/dust] Error:", error);
        return NextResponse.json({ error: "dust_failed" }, { status: 500 });
    }
}
