// app/api/internal/game/tournaments/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { listTournaments } from "@/core/lib/tournamentStore";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { gameId, viewerUserId } = await req.json();
        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const tournaments = await listTournaments(gameId, viewerUserId || null);
        return NextResponse.json({ success: true, tournaments });
    } catch (error) {
        console.error("[internal/tournaments/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
