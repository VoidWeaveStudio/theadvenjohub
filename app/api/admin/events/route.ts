// app/api/admin/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { eventConfigs, eventRuns, games } from "@/core/database/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { DEFAULT_GAME_SLUG } from "@/core/lib/defaultGame";
import { EVENT_DOORS, isEventId, resolveAllEvents } from "@/features/game/data/eventDoors";

const TEXT_LIMITS = {
    title: 60,
    tagline: 60,
    description: 1000,
    rewardText: 240,
    scheduleNote: 120,
};

async function resolveGame(slug: string | null) {
    const target = slug && slug.length > 0 ? slug : DEFAULT_GAME_SLUG;
    const game = await db.query.games.findFirst({ where: eq(games.slug, target) });
    if (game) return game;
    return db.query.games.findFirst({ orderBy: asc(games.createdAt) });
}

function clampText(value: unknown, limit: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed.slice(0, limit);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const slug = new URL(req.url).searchParams.get("gameSlug");
        const game = await resolveGame(slug);
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const rows = await db.select().from(eventConfigs).where(eq(eventConfigs.gameId, game.id));

        const runCounts = await db
            .select({
                eventId: eventRuns.eventId,
                runs: sql<number>`count(*)::int`,
                bestWave: sql<number>`coalesce(max(${eventRuns.wavesCleared}), 0)::int`,
            })
            .from(eventRuns)
            .where(eq(eventRuns.gameId, game.id))
            .groupBy(eventRuns.eventId);

        const stats = new Map(runCounts.map((row) => [row.eventId, row]));

        const events = resolveAllEvents(rows).map((event) => ({
            ...event,
            runs: stats.get(event.id)?.runs ?? 0,
            bestWave: stats.get(event.id)?.bestWave ?? 0,
        }));

        return NextResponse.json({ gameSlug: game.slug, gameName: game.title, events });
    } catch (error) {
        console.error("[admin/events] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const eventId = typeof body.eventId === "string" ? body.eventId : "";

        if (!isEventId(eventId)) {
            return NextResponse.json({ error: "invalid_event" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "event_config_set", `event:${eventId}`);
        if (sigError) return sigError;

        const game = await resolveGame(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const fallback = EVENT_DOORS.find((door) => door.id === eventId)!;
        const maxParty = clampInt(body.maxParty, 1, 4, fallback.maxParty);

        const startsAt = parseDate(body.startsAt);
        const endsAt = parseDate(body.endsAt);
        if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
            return NextResponse.json({ error: "end_before_start" }, { status: 400 });
        }

        const values = {
            enabled: body.enabled === true,
            title: clampText(body.title, TEXT_LIMITS.title),
            tagline: clampText(body.tagline, TEXT_LIMITS.tagline),
            description: clampText(body.description, TEXT_LIMITS.description),
            rewardText: clampText(body.rewardText, TEXT_LIMITS.rewardText),
            scheduleNote: clampText(body.scheduleNote, TEXT_LIMITS.scheduleNote),
            startsAt,
            endsAt,
            repeatDays: startsAt && endsAt ? clampInt(body.repeatDays, 0, 365, 0) : 0,
            minParty: clampInt(body.minParty, 1, maxParty, 1),
            maxParty,
            cooldownMinutes: clampInt(body.cooldownMinutes, 0, 10080, fallback.cooldownMinutes),
            ashPerWave: clampInt(body.ashPerWave, 0, 100000, fallback.ashPerWave),
            xpPerWave: clampInt(body.xpPerWave, 0, 100000, fallback.xpPerWave),
            ashCap: clampInt(body.ashCap, 0, 10000000, fallback.ashCap),
            xpCap: clampInt(body.xpCap, 0, 10000000, fallback.xpCap),
            updatedAt: new Date(),
        };

        const existing = await db.query.eventConfigs.findFirst({
            where: and(eq(eventConfigs.gameId, game.id), eq(eventConfigs.eventId, eventId)),
        });

        if (existing) {
            await db.update(eventConfigs).set(values).where(eq(eventConfigs.id, existing.id));
        } else {
            await db.insert(eventConfigs).values({ gameId: game.id, eventId, ...values });
        }

        return NextResponse.json({ success: true, eventId, ...values });
    } catch (error) {
        console.error("[admin/events] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const eventId = typeof body.eventId === "string" ? body.eventId : "";

        if (!isEventId(eventId)) {
            return NextResponse.json({ error: "invalid_event" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "event_board_clear", `event:${eventId}`);
        if (sigError) return sigError;

        const game = await resolveGame(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        await db.delete(eventRuns).where(and(eq(eventRuns.gameId, game.id), eq(eventRuns.eventId, eventId)));

        return NextResponse.json({ success: true, eventId });
    } catch (error) {
        console.error("[admin/events] DELETE Error:", error);
        return NextResponse.json({ error: "clear_failed" }, { status: 500 });
    }
}
