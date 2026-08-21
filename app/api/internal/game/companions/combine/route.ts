// app/api/internal/game/companions/combine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { combineFragments } from "@/core/lib/companionInventory";

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

        const result = await combineFragments(userId, gameId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, ...result.state });
    } catch (error) {
        console.error("[internal/companions/combine] Error:", error);
        return NextResponse.json({ error: "combine_failed" }, { status: 500 });
    }
}
