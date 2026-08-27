// app/api/admin/players/[userId]/achievements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import { db } from "@/core/database";
import { userAchievements } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_KEY } from "@/core/lib/achievements";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const grant = body.grant !== false;
        const all = body.all === true;
        const key = typeof body.key === "string" ? body.key.trim() : "";

        if (!all && !ACHIEVEMENTS_BY_KEY.has(key)) {
            return NextResponse.json({ error: "unknown_achievement" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(
            req,
            body,
            grant ? "grantAchievement" : "revokeAchievement",
            `${userId}:${all ? "*" : key}`
        );
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        if (all) {
            if (grant) {
                for (const achievement of ACHIEVEMENTS) {
                    await db
                        .insert(userAchievements)
                        .values({ userId, gameId, achievementKey: achievement.key })
                        .onConflictDoNothing();
                }
            } else {
                await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
            }
            return NextResponse.json({ success: true });
        }

        if (grant) {
            await db
                .insert(userAchievements)
                .values({ userId, gameId, achievementKey: key })
                .onConflictDoNothing();
        } else {
            await db
                .delete(userAchievements)
                .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementKey, key)));
        }

        return NextResponse.json({ success: true, key, granted: grant });
    } catch (error) {
        console.error("[admin/players/:userId/achievements] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
