// app/api/internal/game/faction/my-factions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { getMyFactionsList } from "@/core/lib/factionDetail";

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

        const factions = await getMyFactionsList(userId, gameId);
        return NextResponse.json({ factions });
    } catch (error) {
        console.error("[internal/faction/my-factions] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
