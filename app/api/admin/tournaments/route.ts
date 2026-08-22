// app/api/admin/tournaments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { games, tournamentEntries, tournaments } from "@/core/database/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { DEFAULT_GAME_SLUG } from "@/core/lib/defaultGame";
import {
    TOURNAMENT_LIMITS,
    isTournamentCurrency,
    isTournamentKind,
    isTournamentStatus,
    submissionKindOf,
    tournamentPhase,
} from "@/core/lib/tournaments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

async function resolveGame(slug: string | null) {
    const target = slug && slug.length > 0 ? slug : DEFAULT_GAME_SLUG;
    const game = await db.query.games.findFirst({ where: eq(games.slug, target) });
    if (game) return game;
    return db.query.games.findFirst({ orderBy: asc(games.createdAt) });
}

function clampText(value: unknown, limit: number): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, limit);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function parseAmount(value: unknown): string | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > TOURNAMENT_LIMITS.rewardAmountCap) return null;
    return parsed.toFixed(6);
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim().length === 0) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function readSettings(body: any) {
    if (!isTournamentKind(body.kind)) return { error: "invalid_kind" as const };
    if (!isTournamentCurrency(body.rewardCurrency)) return { error: "invalid_currency" as const };
    if (!isTournamentStatus(body.status)) return { error: "invalid_status" as const };

    const title = clampText(body.title, TOURNAMENT_LIMITS.title);
    if (title.length === 0) return { error: "missing_title" as const };

    const rewardAmount = parseAmount(body.rewardAmount);
    if (rewardAmount === null) return { error: "invalid_reward" as const };

    const startsAt = parseDate(body.startsAt);
    const endsAt = parseDate(body.endsAt);
    if (!startsAt || !endsAt) return { error: "missing_window" as const };
    if (endsAt.getTime() <= startsAt.getTime()) return { error: "end_before_start" as const };

    const accent = typeof body.accent === "string" && HEX_COLOR_RE.test(body.accent) ? body.accent : "#f0b95c";

    return {
        values: {
            kind: body.kind,
            title,
            description: clampText(body.description, TOURNAMENT_LIMITS.description),
            rulesText: clampText(body.rulesText, TOURNAMENT_LIMITS.rulesText),
            rewardAmount,
            rewardCurrency: body.rewardCurrency,
            rewardNote: clampText(body.rewardNote, TOURNAMENT_LIMITS.rewardNote),
            accent,
            maxEntries: clampInt(body.maxEntries, 0, TOURNAMENT_LIMITS.maxEntriesCap, 0),
            startsAt,
            endsAt,
            status: body.status,
            updatedAt: new Date(),
        },
    };
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const slug = new URL(req.url).searchParams.get("gameSlug");
        const game = await resolveGame(slug);
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const rows = await db
            .select()
            .from(tournaments)
            .where(eq(tournaments.gameId, game.id))
            .orderBy(desc(tournaments.createdAt))
            .limit(200);

        const counts = await db
            .select({
                tournamentId: tournamentEntries.tournamentId,
                entries: sql<number>`count(*)::int`,
                submitted: sql<number>`count(${tournamentEntries.submittedAt})::int`,
                likes: sql<number>`coalesce(sum(${tournamentEntries.likeCount}), 0)::int`,
            })
            .from(tournamentEntries)
            .where(eq(tournamentEntries.gameId, game.id))
            .groupBy(tournamentEntries.tournamentId);

        const stats = new Map(counts.map((row) => [row.tournamentId, row]));
        const now = Date.now();

        return NextResponse.json({
            gameSlug: game.slug,
            gameName: game.title,
            tournaments: rows.map((row) => ({
                id: row.id,
                kind: row.kind,
                title: row.title,
                description: row.description,
                rulesText: row.rulesText,
                rewardAmount: row.rewardAmount,
                rewardCurrency: row.rewardCurrency,
                rewardNote: row.rewardNote,
                accent: row.accent,
                maxEntries: row.maxEntries,
                startsAt: row.startsAt.toISOString(),
                endsAt: row.endsAt.toISOString(),
                status: row.status,
                phase: tournamentPhase(row.startsAt.getTime(), row.endsAt.getTime(), now),
                submission: submissionKindOf(row.kind),
                winnerEntryId: row.winnerEntryId,
                winnerDecidedAt: row.winnerDecidedAt?.toISOString() ?? null,
                paidAt: row.paidAt?.toISOString() ?? null,
                payoutRef: row.payoutRef,
                entryCount: stats.get(row.id)?.entries ?? 0,
                submittedCount: stats.get(row.id)?.submitted ?? 0,
                likeCount: stats.get(row.id)?.likes ?? 0,
                createdAt: row.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("[admin/tournaments] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();

        const sigError = await verifyAdminAction(req, body, "tournament_create", "tournament:new");
        if (sigError) return sigError;

        const parsed = readSettings(body);
        if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

        const game = await resolveGame(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const [created] = await db
            .insert(tournaments)
            .values({ gameId: game.id, ...parsed.values })
            .returning({ id: tournaments.id });

        return NextResponse.json({ success: true, id: created?.id ?? null });
    } catch (error) {
        console.error("[admin/tournaments] POST Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const id = typeof body.id === "string" ? body.id : "";
        if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

        const sigError = await verifyAdminAction(req, body, "tournament_update", `tournament:${id}`);
        if (sigError) return sigError;

        const existing = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
        if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

        // The payout half of the form saves on its own — it is the only thing an
        // admin can still change after a contest has ended.
        if (body.mode === "payout") {
            const winnerEntryId = typeof body.winnerEntryId === "string" && UUID_RE.test(body.winnerEntryId)
                ? body.winnerEntryId
                : null;

            if (winnerEntryId) {
                const entry = await db.query.tournamentEntries.findFirst({
                    where: and(eq(tournamentEntries.id, winnerEntryId), eq(tournamentEntries.tournamentId, id)),
                });
                if (!entry) return NextResponse.json({ error: "entry_not_found" }, { status: 400 });
            }

            await db
                .update(tournaments)
                .set({
                    winnerEntryId,
                    winnerDecidedAt: winnerEntryId ? existing.winnerDecidedAt ?? new Date() : null,
                    paidAt: body.paid === true ? existing.paidAt ?? new Date() : null,
                    payoutRef: clampText(body.payoutRef, TOURNAMENT_LIMITS.payoutRef) || null,
                    updatedAt: new Date(),
                })
                .where(eq(tournaments.id, id));

            return NextResponse.json({ success: true, id });
        }

        const parsed = readSettings(body);
        if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

        // Changing the kind after people have entered would orphan their
        // submissions, so it is locked once the first entry lands.
        if (parsed.values.kind !== existing.kind) {
            const [count] = await db
                .select({ total: sql<number>`count(*)::int` })
                .from(tournamentEntries)
                .where(eq(tournamentEntries.tournamentId, id));
            if ((count?.total ?? 0) > 0) {
                return NextResponse.json({ error: "kind_locked" }, { status: 400 });
            }
        }

        await db.update(tournaments).set(parsed.values).where(eq(tournaments.id, id));

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error("[admin/tournaments] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const id = typeof body.id === "string" ? body.id : "";
        if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

        const sigError = await verifyAdminAction(req, body, "tournament_delete", `tournament:${id}`);
        if (sigError) return sigError;

        await db.delete(tournaments).where(eq(tournaments.id, id));

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error("[admin/tournaments] DELETE Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
