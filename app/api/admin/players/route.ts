// app/api/admin/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import {
    users,
    gameNicknames,
    gameLicenses,
    factions,
    factionMembers,
} from "@/core/database/schema";
import { desc, asc, eq, and, ilike, or, inArray, isNotNull, exists, not, sql, count, SQL } from "drizzle-orm";

const SORTS = {
    created: users.createdAt,
    lastSeen: users.lastSeenAt,
} as const;

type SortKey = keyof typeof SORTS | "level" | "playtime" | "kills";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const ownsParam = searchParams.get("owns") || "all";
        const statusParam = searchParams.get("status") || "all";
        const factionParam = searchParams.get("faction") || "all";
        const sortParam = (searchParams.get("sort") || "created") as SortKey;
        const dir = searchParams.get("dir") === "asc" ? asc : desc;
        const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit")) || 50));
        const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

        const nicknameSubquery = db
            .select({ nickname: gameNicknames.nickname })
            .from(gameNicknames)
            .where(eq(gameNicknames.userId, users.id))
            .orderBy(desc(gameNicknames.updatedAt))
            .limit(1);

        const ownsGameSubquery = db
            .select({ one: sql`1` })
            .from(gameLicenses)
            .where(and(eq(gameLicenses.userId, users.id), eq(gameLicenses.isActive, true)));

        const promoFactionSubquery = db
            .select({ name: factions.name })
            .from(gameLicenses)
            .innerJoin(factions, eq(factions.id, gameLicenses.grantedViaPromoFactionId))
            .where(and(
                eq(gameLicenses.userId, users.id),
                eq(gameLicenses.isActive, true),
                isNotNull(gameLicenses.grantedViaPromoFactionId)
            ))
            .orderBy(desc(gameLicenses.purchasedAt))
            .limit(1);

        const memberFactionSubquery = db
            .select({ name: factions.name })
            .from(factionMembers)
            .innerJoin(factions, eq(factions.id, factionMembers.factionId))
            .where(eq(factionMembers.userId, users.id))
            .orderBy(desc(factionMembers.isDisplayed), desc(factionMembers.joinedAt))
            .limit(1);

        const inAnyFaction = db
            .select({ one: sql`1` })
            .from(factionMembers)
            .where(eq(factionMembers.userId, users.id));

        const filters: (SQL | undefined)[] = [
            query
                ? or(
                    ilike(users.wallet, `%${query}%`),
                    inArray(
                        users.id,
                        db.select({ id: gameNicknames.userId }).from(gameNicknames).where(ilike(gameNicknames.nickname, `%${query}%`))
                    )
                )
                : undefined,
            ownsParam === "1" ? exists(ownsGameSubquery) : undefined,
            ownsParam === "0" ? not(exists(ownsGameSubquery)) : undefined,
            statusParam === "online" ? eq(users.isOnline, true) : undefined,
            statusParam === "offline" ? eq(users.isOnline, false) : undefined,
            statusParam === "banned" ? eq(users.isBanned, true) : undefined,
            statusParam === "muted" ? sql`${users.mutedUntil} > now()` : undefined,
            factionParam === "in" ? exists(inAnyFaction) : undefined,
            factionParam === "out" ? not(exists(inAnyFaction)) : undefined,
        ];

        const where = and(...filters);

        // Outer columns are spelled out rather than interpolated: drizzle renders
        // an interpolated column as a bare name, which a subquery resolves against
        // its own table first and then silently matches nothing.
        const ashExpr = sql<string | null>`(
            select case when p.data ~ '^\\s*\\{' then (p.data::jsonb ->> 'ash') end
            from game_progress p where p.user_id = users.id limit 1
        )`;

        const spentExpr = sql<string | null>`(
            coalesce((select sum(l.price) from game_licenses l where l.user_id = users.id and l.tx_signature is not null), 0)
            + coalesce((select sum(s.price_tnj) from shop_purchases s where s.user_id = users.id and s.status = 'completed'), 0)
        )`;

        const orderBy =
            sortParam === "level"
                ? dir(sql`coalesce((select cp.level from game_character_progression cp where cp.user_id = users.id limit 1), 0)`)
                : sortParam === "playtime"
                    ? dir(sql`coalesce((select st.playtime_seconds from game_statistics st where st.user_id = users.id limit 1), 0)`)
                    : sortParam === "kills"
                        ? dir(sql`coalesce((select st.kills from game_statistics st where st.user_id = users.id limit 1), 0)`)
                        : dir(SORTS[(sortParam in SORTS ? sortParam : "created") as keyof typeof SORTS]);

        const baseSelection = {
            id: users.id,
            number: users.number,
            wallet: users.wallet,
            isBanned: users.isBanned,
            banReason: users.banReason,
            isOnline: users.isOnline,
            mutedUntil: users.mutedUntil,
            lastSeenAt: users.lastSeenAt,
            createdAt: users.createdAt,
            nickname: sql<string | null>`(${nicknameSubquery})`,
            ownsGame: exists(ownsGameSubquery),
            promoFactionName: sql<string | null>`(${promoFactionSubquery})`,
            factionName: sql<string | null>`(${memberFactionSubquery})`,
            level: sql<number | null>`(select cp.level from game_character_progression cp where cp.user_id = users.id limit 1)`,
            kills: sql<number | null>`(select st.kills from game_statistics st where st.user_id = users.id limit 1)`,
            deaths: sql<number | null>`(select st.deaths from game_statistics st where st.user_id = users.id limit 1)`,
            playtimeSeconds: sql<number | null>`(select st.playtime_seconds from game_statistics st where st.user_id = users.id limit 1)`,
        };

        let rows: Record<string, unknown>[];
        try {
            rows = await db
                .select({ ...baseSelection, ash: ashExpr, spentTnj: spentExpr })
                .from(users)
                .where(where)
                .orderBy(orderBy)
                .limit(limit)
                .offset(offset);
        } catch (enrichError) {
            console.error("[admin/players] enriched query failed, falling back:", enrichError);
            rows = await db.select(baseSelection).from(users).where(where).orderBy(orderBy).limit(limit).offset(offset);
        }

        const [{ value: total }] = await db.select({ value: count() }).from(users).where(where);

        return NextResponse.json({
            players: rows.map((row) => ({
                ...row,
                level: Number(row.level ?? 0) || 0,
                kills: Number(row.kills ?? 0) || 0,
                deaths: Number(row.deaths ?? 0) || 0,
                playtimeSeconds: Number(row.playtimeSeconds ?? 0) || 0,
                ash: Number(row.ash ?? 0) || 0,
                spentTnj: Number(row.spentTnj ?? 0) || 0,
            })),
            total: Number(total) || 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error("[admin/players] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
