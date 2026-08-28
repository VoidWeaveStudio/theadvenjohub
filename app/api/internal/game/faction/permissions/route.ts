// app/api/internal/game/faction/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { isFactionHead, sanitizePermissions } from "@/core/lib/factionPermissions";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { actorUserId, gameId, factionId, targetUserId } = body;

        if (!actorUserId || !gameId || !factionId || !targetUserId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        if (!isFactionHead(faction, actorUserId)) {
            return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }

        if (isFactionHead(faction, targetUserId)) {
            return NextResponse.json({ error: "cannot_edit_head" }, { status: 409 });
        }

        const permissions = sanitizePermissions(body.permissions);
        const rawTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim().slice(0, 24) : null;
        const roleTitle = rawTitle && rawTitle.length > 0 ? rawTitle : null;

        const [updated] = await db
            .update(factionMembers)
            .set({ permissions, roleTitle })
            .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, targetUserId)))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "not_a_member" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            targetUserId,
            permissions: updated.permissions,
            roleTitle: updated.roleTitle,
        });
    } catch (error) {
        console.error("[internal/faction/permissions] Error:", error);
        return NextResponse.json({ error: "permissions_failed" }, { status: 500 });
    }
}
