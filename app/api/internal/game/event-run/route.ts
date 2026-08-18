// app/api/internal/game/event-run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { eventRuns } from "@/core/database/schema";
import { isEventId } from "@/features/game/data/eventDoors";

const MAX_PARTICIPANTS = 8;

function clampInt(value: unknown, min: number, max: number): number {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, eventId, participants } = body;

        if (!gameId || typeof eventId !== "string" || !isEventId(eventId)) {
            return NextResponse.json({ error: "invalid_run" }, { status: 400 });
        }
        if (!Array.isArray(participants) || participants.length === 0) {
            return NextResponse.json({ error: "no_participants" }, { status: 400 });
        }

        const wavesCleared = clampInt(body.wavesCleared, 0, 100000);
        const partySize = clampInt(body.partySize ?? participants.length, 1, MAX_PARTICIPANTS);
        const durationSeconds = clampInt(body.durationSeconds, 0, 86400);

        const rows = participants
            .slice(0, MAX_PARTICIPANTS)
            .filter((entry: any) => typeof entry?.userId === "string" && typeof entry?.wallet === "string")
            .map((entry: any) => ({
                gameId,
                eventId,
                userId: entry.userId as string,
                wallet: (entry.wallet as string).slice(0, 44),
                wavesCleared,
                partySize,
                durationSeconds,
                ashAwarded: clampInt(entry.ash, 0, 10000000),
                xpAwarded: clampInt(entry.xp, 0, 10000000),
            }));

        if (rows.length === 0) {
            return NextResponse.json({ error: "no_participants" }, { status: 400 });
        }

        await db.insert(eventRuns).values(rows);

        return NextResponse.json({ success: true, recorded: rows.length });
    } catch (error) {
        console.error("[internal/event-run] Error:", error);
        return NextResponse.json({ error: "record_failed" }, { status: 500 });
    }
}
