// app/api/internal/game/room/can-edit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { canEditLot } from "@/core/lib/roomLayoutAccess";

const FACTION_PREFIX = "faction-gate-";
const PLAYER_PREFIX = "player-room-";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, locationId } = await req.json();
        if (typeof userId !== "string" || typeof locationId !== "string") {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        if (locationId.startsWith(PLAYER_PREFIX)) {
            const canEdit = await canEditLot("personal", locationId.slice(PLAYER_PREFIX.length), userId);
            return NextResponse.json({ canEdit });
        }

        if (locationId.startsWith(FACTION_PREFIX)) {
            const canEdit = await canEditLot("faction", locationId.slice(FACTION_PREFIX.length), userId);
            return NextResponse.json({ canEdit });
        }

        return NextResponse.json({ canEdit: false });
    } catch (error) {
        console.error("[internal/game/room/can-edit] Error:", error);
        return NextResponse.json({ error: "check_failed" }, { status: 500 });
    }
}
