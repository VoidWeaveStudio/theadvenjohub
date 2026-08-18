// app/api/internal/game/event-configs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { eventConfigs } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { resolveAllEvents } from "@/features/game/data/eventDoors";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { gameId } = await req.json();
        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const rows = await db.select().from(eventConfigs).where(eq(eventConfigs.gameId, gameId));

        return NextResponse.json({ success: true, events: resolveAllEvents(rows) });
    } catch (error) {
        console.error("[internal/event-configs] Error:", error);
        return NextResponse.json({ error: "load_failed" }, { status: 500 });
    }
}
