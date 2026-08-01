// app/api/admin/factions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { desc, ilike, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();

        const rows = await db
            .select({
                id: factions.id,
                number: factions.number,
                name: factions.name,
                symbol: factions.symbol,
                image: factions.image,
                tokenCa: factions.tokenCa,
                founderWallet: factions.founderWallet,
                level: factions.level,
                levelProgressAsh: factions.levelProgressAsh,
                createdAt: factions.createdAt,
                memberCount: sql<number>`(SELECT count(*) FROM ${factionMembers} WHERE ${factionMembers.factionId} = ${factions.id})`,
            })
            .from(factions)
            .where(query ? ilike(factions.name, `%${query}%`) : undefined)
            .orderBy(desc(factions.level), desc(factions.createdAt))
            .limit(200);

        return NextResponse.json({ factions: rows });
    } catch (error) {
        console.error("[admin/factions] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
