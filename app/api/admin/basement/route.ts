// app/api/admin/basement/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { basementColumns, games } from "@/core/database/schema";
import { eq, and, asc } from "drizzle-orm";
import { BASEMENT_COLUMN_COUNT } from "@/core/lib/basementColumns";

async function resolveGame(slug: string | null) {
    if (slug) {
        return db.query.games.findFirst({ where: eq(games.slug, slug) });
    }
    return db.query.games.findFirst();
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const slug = new URL(req.url).searchParams.get("gameSlug");
        const game = await resolveGame(slug);
        if (!game) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const rows = await db
            .select({ slot: basementColumns.slot, tokenCa: basementColumns.tokenCa, updatedAt: basementColumns.updatedAt })
            .from(basementColumns)
            .where(eq(basementColumns.gameId, game.id))
            .orderBy(asc(basementColumns.slot));

        const bySlot = new Map(rows.map((r) => [r.slot, r]));
        const columns = Array.from({ length: BASEMENT_COLUMN_COUNT }, (_, slot) => ({
            slot,
            tokenCa: bySlot.get(slot)?.tokenCa ?? null,
            updatedAt: bySlot.get(slot)?.updatedAt ?? null,
        }));

        return NextResponse.json({ gameSlug: game.slug, gameName: game.title, columns });
    } catch (error) {
        console.error("[admin/basement] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const { gameSlug, slot } = body;

        if (!Number.isInteger(slot) || slot < 0 || slot >= BASEMENT_COLUMN_COUNT) {
            return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
        }

        const rawCa = typeof body.tokenCa === "string" ? body.tokenCa.trim() : "";
        const tokenCa = rawCa.length === 0 ? null : rawCa.slice(0, 64);
        if (tokenCa !== null && (tokenCa.length < 32 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(tokenCa))) {
            return NextResponse.json({ error: "invalid_token_ca" }, { status: 400 });
        }

        const sigError = verifyAdminAction(req, body, tokenCa ? "basement_set" : "basement_clear", `slot:${slot}`);
        if (sigError) return sigError;

        const game = await resolveGame(typeof gameSlug === "string" ? gameSlug : null);
        if (!game) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const existing = await db.query.basementColumns.findFirst({
            where: and(eq(basementColumns.gameId, game.id), eq(basementColumns.slot, slot)),
        });

        if (existing) {
            await db
                .update(basementColumns)
                .set({ tokenCa, updatedAt: new Date() })
                .where(eq(basementColumns.id, existing.id));
        } else {
            await db.insert(basementColumns).values({ gameId: game.id, slot, tokenCa });
        }

        return NextResponse.json({ success: true, slot, tokenCa });
    } catch (error) {
        console.error("[admin/basement] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
