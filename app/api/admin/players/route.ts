// app/api/admin/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { users, gameNicknames, gameLicenses, factions } from "@/core/database/schema";
import { desc, eq, and, ilike, or, inArray, isNotNull, exists, not, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const ownsParam = searchParams.get("owns");

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

        const rows = await db
            .select({
                id: users.id,
                wallet: users.wallet,
                isBanned: users.isBanned,
                banReason: users.banReason,
                isOnline: users.isOnline,
                lastSeenAt: users.lastSeenAt,
                createdAt: users.createdAt,
                nickname: sql<string | null>`(${nicknameSubquery})`,
                ownsGame: exists(ownsGameSubquery),
                promoFactionName: sql<string | null>`(${promoFactionSubquery})`,
            })
            .from(users)
            .where(and(
                query ? or(
                    ilike(users.wallet, `%${query}%`),
                    inArray(users.id, db.select({ id: gameNicknames.userId }).from(gameNicknames).where(ilike(gameNicknames.nickname, `%${query}%`)))
                ) : undefined,
                ownsParam === "1" ? exists(ownsGameSubquery) : undefined,
                ownsParam === "0" ? not(exists(ownsGameSubquery)) : undefined
            ))
            .orderBy(desc(users.createdAt))
            .limit(200);

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("[admin/players] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
