// app/api/internal/game/cosmetic-crates/combine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { combineCosmeticFragments } from "@/core/lib/cosmeticCrates";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId } = await req.json();

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const result = await combineCosmeticFragments(userId, gameId);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, ...result.state });
    } catch (error) {
        console.error("[internal/cosmetic-crates/combine] Error:", error);
        return NextResponse.json({ error: "combine_failed" }, { status: 500 });
    }
}
