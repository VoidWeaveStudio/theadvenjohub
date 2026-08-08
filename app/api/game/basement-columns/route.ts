// app/api/game/basement-columns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { basementColumns, games } from "@/core/database/schema";
import { eq, asc } from "drizzle-orm";
import { BASEMENT_COLUMN_COUNT } from "@/core/lib/basementColumns";

export async function GET(req: NextRequest) {
    try {
        const slug = new URL(req.url).searchParams.get("gameSlug");
        if (!slug) {
            return NextResponse.json({ error: "missing_game_slug" }, { status: 400 });
        }

        const game = await db.query.games.findFirst({ where: eq(games.slug, slug) });
        if (!game) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const rows = await db
            .select({ slot: basementColumns.slot, tokenCa: basementColumns.tokenCa })
            .from(basementColumns)
            .where(eq(basementColumns.gameId, game.id))
            .orderBy(asc(basementColumns.slot));

        const columns: (string | null)[] = new Array(BASEMENT_COLUMN_COUNT).fill(null);
        for (const row of rows) {
            if (row.slot >= 0 && row.slot < BASEMENT_COLUMN_COUNT) {
                columns[row.slot] = row.tokenCa;
            }
        }

        return NextResponse.json({ columns }, {
            headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
        });
    } catch (error) {
        console.error("[game/basement-columns] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
