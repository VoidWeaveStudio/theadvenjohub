// src/core/lib/tournamentStore.ts
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/core/database";
import {
    gameCharacterProgression,
    gameNicknames,
    gameProgress,
    tournamentEntries,
    tournamentLikes,
    tournaments,
    users,
} from "@/core/database/schema";
import {
    TOURNAMENT_LIMITS,
    isValidXPostUrl,
    ranksByLikes,
    submissionKindOf,
    tournamentPhase,
    type TournamentEntryView,
    type TournamentKind,
    type TournamentSummary,
} from "@/core/lib/tournaments";

type Tournament = typeof tournaments.$inferSelect;
type Entry = typeof tournamentEntries.$inferSelect;

export type TournamentActionError =
    | "not_found"
    | "not_open"
    | "not_joined"
    | "already_joined"
    | "full"
    | "no_submission"
    | "no_skin"
    | "invalid_shot"
    | "invalid_url"
    | "wrong_kind"
    | "own_entry"
    | "entry_not_found"
    | "save_failed";

export type TournamentActionResult<T> = { ok: true; value: T } | { ok: false; error: TournamentActionError };

function epoch(value: Date | null): number | null {
    return value ? value.getTime() : null;
}

// The billboard only ever shows published contests; drafts stay admin-only and
// archived ones drop out of the game entirely.
async function loadPublished(gameId: string, limit: number): Promise<Tournament[]> {
    return db
        .select()
        .from(tournaments)
        .where(and(eq(tournaments.gameId, gameId), eq(tournaments.status, "published")))
        .orderBy(desc(tournaments.endsAt))
        .limit(limit);
}

async function likeCounts(tournamentIds: string[]): Promise<Map<string, number>> {
    if (tournamentIds.length === 0) return new Map();

    const rows = await db
        .select({ entryId: tournamentLikes.entryId, total: sql<number>`count(*)::int` })
        .from(tournamentLikes)
        .where(inArray(tournamentLikes.tournamentId, tournamentIds))
        .groupBy(tournamentLikes.entryId);

    return new Map(rows.map((row) => [row.entryId, row.total]));
}

async function entriesOf(tournamentIds: string[], includeRemoved = false): Promise<Entry[]> {
    if (tournamentIds.length === 0) return [];
    const scope = includeRemoved
        ? inArray(tournamentEntries.tournamentId, tournamentIds)
        : and(
            inArray(tournamentEntries.tournamentId, tournamentIds),
            eq(tournamentEntries.status, "joined")
        );

    return db
        .select()
        .from(tournamentEntries)
        .where(scope)
        .limit(TOURNAMENT_LIMITS.entriesLimit * tournamentIds.length);
}

// xp24h has no submission step, so its ranking is the XP a player gained since
// joining. Everything else ranks on votes.
async function xpGainedFor(gameId: string, entries: Entry[]): Promise<Map<string, number>> {
    const userIds = [...new Set(entries.map((entry) => entry.userId))];
    if (userIds.length === 0) return new Map();

    const rows = await db
        .select({ userId: gameCharacterProgression.userId, totalXp: gameCharacterProgression.totalXp })
        .from(gameCharacterProgression)
        .where(
            and(
                eq(gameCharacterProgression.gameId, gameId),
                inArray(gameCharacterProgression.userId, userIds)
            )
        );

    const totals = new Map(rows.map((row) => [row.userId, row.totalXp]));
    const gained = new Map<string, number>();
    for (const entry of entries) {
        const total = totals.get(entry.userId) ?? entry.xpAtJoin;
        gained.set(entry.id, Math.max(0, total - entry.xpAtJoin));
    }
    return gained;
}

function rankEntries(kind: string, entries: Entry[], likes: Map<string, number>, xp: Map<string, number>): Entry[] {
    const byLikes = ranksByLikes(kind);
    return [...entries].sort((a, b) => {
        const scoreA = byLikes ? likes.get(a.id) ?? 0 : xp.get(a.id) ?? 0;
        const scoreB = byLikes ? likes.get(b.id) ?? 0 : xp.get(b.id) ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        // Ties go to whoever committed first — the earliest submission, falling
        // back to the join time for xp24h where nothing is ever submitted.
        const timeA = (a.submittedAt ?? a.joinedAt).getTime();
        const timeB = (b.submittedAt ?? b.joinedAt).getTime();
        return timeA - timeB;
    });
}

// A finished contest keeps its result forever: the tallies are written back once
// and the winner is stamped on the row, so the history list never recomputes.
// Both writes are single statements — a 200-entry contest would otherwise mean
// 200 round trips over the HTTP driver.
async function freezeResults(tournament: Tournament): Promise<string | null> {
    await db.execute(sql`
        update ${tournamentEntries}
        set like_count = (
            select count(*)::int from ${tournamentLikes}
            where ${tournamentLikes.entryId} = ${tournamentEntries.id}
        ), updated_at = now()
        where ${tournamentEntries.tournamentId} = ${tournament.id}
    `);

    if (!ranksByLikes(tournament.kind)) {
        await db.execute(sql`
            update ${tournamentEntries}
            set xp_gained = greatest(0, coalesce(p.total_xp, 0) - ${tournamentEntries.xpAtJoin}), updated_at = now()
            from ${gameCharacterProgression} p
            where p.user_id = ${tournamentEntries.userId}
              and p.game_id = ${tournamentEntries.gameId}
              and ${tournamentEntries.tournamentId} = ${tournament.id}
        `);
    }

    const needsSubmission = submissionKindOf(tournament.kind) !== "none";
    const score = ranksByLikes(tournament.kind) ? tournamentEntries.likeCount : tournamentEntries.xpGained;

    const [winner] = await db
        .select({ id: tournamentEntries.id })
        .from(tournamentEntries)
        .where(
            and(
                eq(tournamentEntries.tournamentId, tournament.id),
                eq(tournamentEntries.status, "joined"),
                needsSubmission ? isNotNull(tournamentEntries.submittedAt) : undefined
            )
        )
        // Ties go to whoever committed first — the earliest submission, falling
        // back to the join time for xp24h where nothing is ever submitted.
        .orderBy(desc(score), asc(sql`coalesce(${tournamentEntries.submittedAt}, ${tournamentEntries.joinedAt})`))
        .limit(1);

    await db
        .update(tournaments)
        .set({ winnerEntryId: winner?.id ?? null, winnerDecidedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournaments.id, tournament.id));

    return winner?.id ?? null;
}

async function entryCounts(tournamentIds: string[]): Promise<Map<string, number>> {
    if (tournamentIds.length === 0) return new Map();

    const rows = await db
        .select({ tournamentId: tournamentEntries.tournamentId, total: sql<number>`count(*)::int` })
        .from(tournamentEntries)
        .where(
            and(
                inArray(tournamentEntries.tournamentId, tournamentIds),
                eq(tournamentEntries.status, "joined")
            )
        )
        .groupBy(tournamentEntries.tournamentId);

    return new Map(rows.map((row) => [row.tournamentId, row.total]));
}

export async function listTournaments(
    gameId: string,
    viewerUserId: string | null,
    limit = TOURNAMENT_LIMITS.listLimit
): Promise<TournamentSummary[]> {
    const rows = await loadPublished(gameId, Math.min(limit, TOURNAMENT_LIMITS.listLimit));
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);

    // The board only needs a headcount plus the viewer's own row — pulling every
    // entry of every contest would be thousands of rows on a 30-second poll.
    const counts = await entryCounts(ids);

    const mineRows = viewerUserId
        ? await db
            .select()
            .from(tournamentEntries)
            .where(
                and(
                    inArray(tournamentEntries.tournamentId, ids),
                    eq(tournamentEntries.userId, viewerUserId),
                    eq(tournamentEntries.status, "joined")
                )
            )
        : [];
    const mineByTournament = new Map(mineRows.map((row) => [row.tournamentId, row]));

    const myLikes = viewerUserId
        ? await db
            .select({ tournamentId: tournamentLikes.tournamentId, entryId: tournamentLikes.entryId })
            .from(tournamentLikes)
            .where(and(inArray(tournamentLikes.tournamentId, ids), eq(tournamentLikes.userId, viewerUserId)))
        : [];
    const myLikeByTournament = new Map(myLikes.map((row) => [row.tournamentId, row.entryId]));

    const now = Date.now();
    const summaries: TournamentSummary[] = [];

    for (const row of rows) {
        const phase = tournamentPhase(row.startsAt.getTime(), row.endsAt.getTime(), now);
        const mine = mineByTournament.get(row.id) ?? null;

        let winnerEntryId = row.winnerEntryId;
        if (phase === "ended" && row.winnerDecidedAt === null) {
            winnerEntryId = await freezeResults(row);
        }

        summaries.push({
            id: row.id,
            kind: row.kind as TournamentKind,
            title: row.title,
            description: row.description,
            rulesText: row.rulesText,
            rewardAmount: row.rewardAmount,
            rewardCurrency: row.rewardCurrency,
            rewardNote: row.rewardNote,
            accent: row.accent,
            maxEntries: row.maxEntries,
            startsAt: row.startsAt.getTime(),
            endsAt: row.endsAt.getTime(),
            phase,
            entryCount: counts.get(row.id) ?? 0,
            submission: submissionKindOf(row.kind),
            winnerEntryId,
            joined: !!mine,
            submitted: !!mine?.submittedAt,
            myEntryId: mine?.id ?? null,
            myXPostUrl: mine?.xPostUrl ?? null,
            myLikedEntryId: myLikeByTournament.get(row.id) ?? null,
        });
    }

    return summaries;
}

export async function listEntries(
    tournamentId: string,
    viewerUserId: string | null,
    includeRemoved = false
): Promise<{ tournamentId: string; kind: string; entries: TournamentEntryView[] } | null> {
    const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
    if (!tournament) return null;

    const entries = await entriesOf([tournamentId], includeRemoved);
    const likes = await likeCounts([tournamentId]);
    const xp = ranksByLikes(tournament.kind) ? new Map<string, number>() : await xpGainedFor(tournament.gameId, entries);

    const myLike = viewerUserId
        ? await db.query.tournamentLikes.findFirst({
            where: and(eq(tournamentLikes.tournamentId, tournamentId), eq(tournamentLikes.userId, viewerUserId)),
        })
        : null;

    const ranked = rankEntries(tournament.kind, entries, likes, xp).slice(0, TOURNAMENT_LIMITS.entriesLimit);

    return {
        tournamentId,
        kind: tournament.kind,
        entries: ranked.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            wallet: entry.wallet,
            nickname: entry.nickname,
            skinUrl: entry.skinUrl,
            shotUrl: entry.shotUrl,
            xPostUrl: entry.xPostUrl,
            xpGained: xp.get(entry.id) ?? entry.xpGained,
            likeCount: likes.get(entry.id) ?? entry.likeCount,
            submittedAt: epoch(entry.submittedAt),
            isMe: entry.userId === viewerUserId,
            likedByMe: myLike?.entryId === entry.id,
            isWinner: tournament.winnerEntryId === entry.id,
            status: entry.status,
        })),
    };
}

async function openTournament(tournamentId: string): Promise<Tournament | null> {
    const row = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
    if (!row || row.status !== "published") return null;
    if (tournamentPhase(row.startsAt.getTime(), row.endsAt.getTime()) !== "active") return null;
    return row;
}

export async function joinTournament(
    tournamentId: string,
    userId: string
): Promise<TournamentActionResult<{ entryId: string }>> {
    const tournament = await openTournament(tournamentId);
    if (!tournament) return { ok: false, error: "not_open" };

    if (tournament.maxEntries > 0) {
        const [count] = await db
            .select({ total: sql<number>`count(*)::int` })
            .from(tournamentEntries)
            .where(
                and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.status, "joined"))
            );
        if ((count?.total ?? 0) >= tournament.maxEntries) return { ok: false, error: "full" };
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { ok: false, error: "not_found" };

    // An entry an admin hid stays hidden: re-joining must not be a way to undo
    // moderation. Only the admin panel can put it back.
    const existing = await db.query.tournamentEntries.findFirst({
        where: and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId)),
    });
    if (existing && existing.status !== "joined") return { ok: false, error: "not_open" };

    const nickname = await db.query.gameNicknames.findFirst({
        where: and(eq(gameNicknames.userId, userId), eq(gameNicknames.gameId, tournament.gameId)),
    });

    const progression = await db.query.gameCharacterProgression.findFirst({
        where: and(
            eq(gameCharacterProgression.userId, userId),
            eq(gameCharacterProgression.gameId, tournament.gameId)
        ),
    });

    // The unique (tournament_id, user_id) index is what actually prevents a
    // double join; a re-join just refreshes the display name.
    const inserted = await db
        .insert(tournamentEntries)
        .values({
            tournamentId,
            userId,
            gameId: tournament.gameId,
            wallet: user.wallet,
            nickname: nickname?.nickname ?? null,
            xpAtJoin: progression?.totalXp ?? 0,
        })
        .onConflictDoUpdate({
            target: [tournamentEntries.tournamentId, tournamentEntries.userId],
            set: { nickname: nickname?.nickname ?? null, updatedAt: new Date() },
        })
        .returning({ id: tournamentEntries.id });

    const entryId = inserted[0]?.id;
    if (!entryId) return { ok: false, error: "save_failed" };

    return { ok: true, value: { entryId } };
}

async function myEntry(tournamentId: string, userId: string): Promise<Entry | null> {
    const row = await db.query.tournamentEntries.findFirst({
        where: and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId)),
    });
    return row && row.status === "joined" ? row : null;
}

// The painted texture lives in the player's own skins folder, which is pruned to
// the last few uploads. Copying it into a per-entry blob makes the submission
// survive the next repaint.
// The stored URL is written by the game server, which only accepts blob-store
// hosts — re-checked here anyway so this never becomes a way to make the server
// fetch an arbitrary address if that validation is ever loosened upstream.
function isBlobStoreUrl(raw: string): boolean {
    try {
        const parsed = new URL(raw);
        return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
        return false;
    }
}

async function snapshotSkin(tournamentId: string, userId: string, sourceUrl: string): Promise<string | null> {
    if (!isBlobStoreUrl(sourceUrl)) {
        console.warn("[tournamentStore] refusing to snapshot a skin from an unexpected host");
        return null;
    }

    try {
        const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) return null;

        const blob = await put(`tournaments/${tournamentId}/${userId}.png`, buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: "image/png",
        });
        return blob.url;
    } catch (error) {
        console.error("[tournamentStore] skin snapshot failed:", error);
        return null;
    }
}

export async function submitSkin(
    tournamentId: string,
    userId: string,
    kind: TournamentKind
): Promise<TournamentActionResult<{ skinUrl: string }>> {
    const tournament = await openTournament(tournamentId);
    if (!tournament) return { ok: false, error: "not_open" };
    if (tournament.kind !== kind || submissionKindOf(tournament.kind) !== "skin") {
        return { ok: false, error: "wrong_kind" };
    }

    const entry = await myEntry(tournamentId, userId);
    if (!entry) return { ok: false, error: "not_joined" };

    const progress = await db.query.gameProgress.findFirst({
        where: and(eq(gameProgress.userId, userId), eq(gameProgress.gameId, tournament.gameId)),
    });

    let sourceUrl: string | null = null;
    try {
        const parsed = progress?.data ? JSON.parse(progress.data) : null;
        sourceUrl = typeof parsed?.skinTextureUrl === "string" ? parsed.skinTextureUrl : null;
    } catch {
        sourceUrl = null;
    }
    if (!sourceUrl) return { ok: false, error: "no_skin" };

    const snapshot = (await snapshotSkin(tournamentId, userId, sourceUrl)) ?? sourceUrl;

    await db
        .update(tournamentEntries)
        .set({ skinUrl: snapshot, submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournamentEntries.id, entry.id));

    // Resubmitting leaves the previous snapshot orphaned; drop it, but only if it
    // was one of ours (the very first submit may point straight at the player's
    // own skin blob when the copy failed).
    if (entry.skinUrl && entry.skinUrl !== snapshot && entry.skinUrl.includes(`/tournaments/${tournamentId}/`)) {
        await del(entry.skinUrl).catch((error) => {
            console.error("[tournamentStore] stale snapshot delete failed:", error);
        });
    }

    return { ok: true, value: { skinUrl: snapshot } };
}

export async function submitShot(
    tournamentId: string,
    userId: string,
    shotUrl: unknown
): Promise<TournamentActionResult<{ shotUrl: string }>> {
    const tournament = await openTournament(tournamentId);
    if (!tournament) return { ok: false, error: "not_open" };
    if (submissionKindOf(tournament.kind) !== "shot") return { ok: false, error: "wrong_kind" };

    const entry = await myEntry(tournamentId, userId);
    if (!entry) return { ok: false, error: "not_joined" };

    // Only a blob this very player uploaded through our own endpoint counts —
    // the client never gets to point an entry at an arbitrary URL.
    if (typeof shotUrl !== "string" || shotUrl.length > 512) return { ok: false, error: "invalid_shot" };
    let parsed: URL;
    try {
        parsed = new URL(shotUrl);
    } catch {
        return { ok: false, error: "invalid_shot" };
    }
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com")) {
        return { ok: false, error: "invalid_shot" };
    }
    if (!parsed.pathname.startsWith(`/tournament-shots/${userId}/`)) {
        return { ok: false, error: "invalid_shot" };
    }

    await db
        .update(tournamentEntries)
        .set({ shotUrl, submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(tournamentEntries.id, entry.id));

    return { ok: true, value: { shotUrl } };
}

export async function setEntryPost(
    tournamentId: string,
    userId: string,
    postUrl: unknown
): Promise<TournamentActionResult<{ xPostUrl: string | null }>> {
    const tournament = await openTournament(tournamentId);
    if (!tournament) return { ok: false, error: "not_open" };

    const entry = await myEntry(tournamentId, userId);
    if (!entry) return { ok: false, error: "not_joined" };

    const cleared = typeof postUrl === "string" && postUrl.trim().length === 0;
    if (!cleared && !isValidXPostUrl(postUrl)) return { ok: false, error: "invalid_url" };

    const value = cleared ? null : (postUrl as string).trim();

    await db
        .update(tournamentEntries)
        .set({ xPostUrl: value, updatedAt: new Date() })
        .where(eq(tournamentEntries.id, entry.id));

    return { ok: true, value: { xPostUrl: value } };
}

// One vote per account per tournament. Voting for the entry you already voted
// for takes the vote back; voting for another one moves it.
export async function likeEntry(
    tournamentId: string,
    userId: string,
    entryId: unknown
): Promise<TournamentActionResult<{ likedEntryId: string | null; likeCount: number }>> {
    const tournament = await openTournament(tournamentId);
    if (!tournament) return { ok: false, error: "not_open" };
    if (!ranksByLikes(tournament.kind)) return { ok: false, error: "wrong_kind" };
    if (typeof entryId !== "string" || entryId.length === 0) return { ok: false, error: "entry_not_found" };

    const target = await db.query.tournamentEntries.findFirst({ where: eq(tournamentEntries.id, entryId) });
    if (!target || target.tournamentId !== tournamentId || target.status !== "joined") {
        return { ok: false, error: "entry_not_found" };
    }
    if (target.userId === userId) return { ok: false, error: "own_entry" };
    if (target.submittedAt === null) return { ok: false, error: "no_submission" };

    const existing = await db.query.tournamentLikes.findFirst({
        where: and(eq(tournamentLikes.tournamentId, tournamentId), eq(tournamentLikes.userId, userId)),
    });

    if (existing) {
        await db.delete(tournamentLikes).where(eq(tournamentLikes.id, existing.id));
        if (existing.entryId === entryId) {
            const count = await refreshLikeCount(entryId);
            return { ok: true, value: { likedEntryId: null, likeCount: count } };
        }
        await refreshLikeCount(existing.entryId);
    }

    await db
        .insert(tournamentLikes)
        .values({ tournamentId, entryId, userId })
        .onConflictDoNothing({ target: [tournamentLikes.tournamentId, tournamentLikes.userId] });

    const count = await refreshLikeCount(entryId);
    return { ok: true, value: { likedEntryId: entryId, likeCount: count } };
}

async function refreshLikeCount(entryId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(tournamentLikes)
        .where(eq(tournamentLikes.entryId, entryId));

    const total = row?.total ?? 0;
    await db
        .update(tournamentEntries)
        .set({ likeCount: total, updatedAt: new Date() })
        .where(eq(tournamentEntries.id, entryId));

    return total;
}
