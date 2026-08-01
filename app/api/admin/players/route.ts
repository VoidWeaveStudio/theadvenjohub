// app/api/admin/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { users, gameNicknames } from "@/core/database/schema";
import { desc, ilike, or, inArray, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();

        const rows = await db
            .select({
                id: users.id,
                wallet: users.wallet,
                isBanned: users.isBanned,
                banReason: users.banReason,
                isOnline: users.isOnline,
                lastSeenAt: users.lastSeenAt,
                createdAt: users.createdAt,
                nickname: sql<string | null>`(SELECT ${gameNicknames.nickname} FROM ${gameNicknames} WHERE ${gameNicknames.userId} = ${users.id} ORDER BY ${gameNicknames.updatedAt} DESC LIMIT 1)`,
            })
            .from(users)
            .where(query ? or(
                ilike(users.wallet, `%${query}%`),
                inArray(users.id, db.select({ id: gameNicknames.userId }).from(gameNicknames).where(ilike(gameNicknames.nickname, `%${query}%`)))
            ) : undefined)
            .orderBy(desc(users.createdAt))
            .limit(200);

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("[admin/players] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
