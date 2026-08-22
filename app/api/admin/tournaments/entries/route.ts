// app/api/admin/tournaments/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { tournamentEntries, tournaments } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { listEntries } from "@/core/lib/tournamentStore";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const tournamentId = new URL(req.url).searchParams.get("tournamentId") ?? "";
        if (!UUID_RE.test(tournamentId)) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
        if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });

        // The same ranked list the players see, so a disputed result can be
        // checked against exactly what the game showed — plus the hidden entries,
        // which only this view can put back.
        const result = await listEntries(tournamentId, null, true);

        return NextResponse.json({
            tournamentId,
            kind: tournament.kind,
            winnerEntryId: tournament.winnerEntryId,
            entries: result?.entries ?? [],
        });
    } catch (error) {
        console.error("[admin/tournaments/entries] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const entryId = typeof body.entryId === "string" ? body.entryId : "";
        if (!UUID_RE.test(entryId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

        const sigError = await verifyAdminAction(req, body, "tournament_entry_moderate", `entry:${entryId}`);
        if (sigError) return sigError;

        const entry = await db.query.tournamentEntries.findFirst({
            where: eq(tournamentEntries.id, entryId),
        });
        if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });

        // Removing is a soft delete: the votes cast on the entry stay in place so
        // the tallies of the other entries are not silently rewritten.
        const status = body.remove === true ? "removed" : "joined";

        await db
            .update(tournamentEntries)
            .set({ status, updatedAt: new Date() })
            .where(and(eq(tournamentEntries.id, entryId)));

        if (status === "removed") {
            await db
                .update(tournaments)
                .set({ winnerEntryId: null, winnerDecidedAt: null, updatedAt: new Date() })
                .where(
                    and(eq(tournaments.id, entry.tournamentId), eq(tournaments.winnerEntryId, entryId))
                );
        }

        return NextResponse.json({ success: true, entryId, status });
    } catch (error) {
        console.error("[admin/tournaments/entries] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
