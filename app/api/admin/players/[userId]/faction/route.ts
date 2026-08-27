// app/api/admin/players/[userId]/faction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factionMembers, factions, users } from "@/core/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { reassignDisplayedIfNeeded } from "@/core/lib/factionDetail";

const ROLES = ["member", "officer", "founder"] as const;

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const action = body.action;
        const factionId = typeof body.factionId === "string" ? body.factionId.trim() : "";

        if (!["join", "leave", "setRole"].includes(action) || !factionId) {
            return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, `faction_${action}`, `${userId}:${factionId}`);
        if (sigError) return sigError;

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        if (action === "leave") {
            await db
                .delete(factionMembers)
                .where(and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, factionId)));
            await reassignDisplayedIfNeeded(userId, faction.gameId);
            return NextResponse.json({ success: true });
        }

        if (action === "setRole") {
            const role = ROLES.includes(body.role) ? body.role : null;
            if (!role) return NextResponse.json({ error: "invalid_role" }, { status: 400 });

            const [updated] = await db
                .update(factionMembers)
                .set({ role })
                .where(and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, factionId)))
                .returning({ id: factionMembers.id });

            if (!updated) return NextResponse.json({ error: "not_a_member" }, { status: 404 });
            return NextResponse.json({ success: true, role });
        }

        try {
            await db.insert(factionMembers).values({
                factionId,
                userId,
                gameId: faction.gameId,
                wallet: user.wallet,
                role: "member",
                isDisplayed: sql`NOT EXISTS (SELECT 1 FROM faction_members WHERE user_id = ${userId} AND game_id = ${faction.gameId})`,
            });
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                try {
                    await db.insert(factionMembers).values({
                        factionId,
                        userId,
                        gameId: faction.gameId,
                        wallet: user.wallet,
                        role: "member",
                        isDisplayed: false,
                    });
                } catch (retryError: any) {
                    if (retryError?.code !== "23505") throw retryError;
                    return NextResponse.json({ success: true, alreadyMember: true });
                }
            } else {
                throw insertError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/players/:userId/faction] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
