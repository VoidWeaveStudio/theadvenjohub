// app/api/game/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { eventConfigs, games } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { EVENT_DOORS_BY_ID, resolveAllEvents, resolveEvent } from "@/features/game/data/eventDoors";
import { loadEventBoard } from "@/core/lib/eventBoard";

export async function GET(req: NextRequest) {
    try {
        const params = new URL(req.url).searchParams;
        const slug = params.get("gameSlug");
        const eventId = params.get("eventId");

        if (!slug) {
            return NextResponse.json({ error: "missing_game_slug" }, { status: 400 });
        }

        const game = await db.query.games.findFirst({ where: eq(games.slug, slug) });
        if (!game) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const rows = await db.select().from(eventConfigs).where(eq(eventConfigs.gameId, game.id));

        if (eventId) {
            const door = EVENT_DOORS_BY_ID.get(eventId);
            if (!door) {
                return NextResponse.json({ error: "unknown_event" }, { status: 404 });
            }

            const event = resolveEvent(door, rows.find((row) => row.eventId === eventId));
            const board = door.scored ? await loadEventBoard(game.id, eventId) : [];

            return NextResponse.json({ event, board }, {
                headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
            });
        }

        return NextResponse.json({ events: resolveAllEvents(rows) }, {
            headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
        });
    } catch (error) {
        console.error("[game/events] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
