// app/api/internal/game/tournaments/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { listEntries } from "@/core/lib/tournamentStore";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { tournamentId, viewerUserId } = await req.json();
        if (typeof tournamentId !== "string" || tournamentId.length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const result = await listEntries(tournamentId, viewerUserId || null);
        if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[internal/tournaments/entries] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
