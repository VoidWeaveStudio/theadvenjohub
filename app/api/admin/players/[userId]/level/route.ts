// app/api/admin/players/[userId]/level/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { gameCharacterProgression, gameProgress } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { MAX_LEVEL, skillPointsForLevel, totalXpForLevel } from "@/features/game/data/progression";
import { queueAdminGameCommand } from "@/core/lib/adminGameCommands";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const level = Math.floor(Number(body.level));

        if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) {
            return NextResponse.json({ error: "invalid_level" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "setLevel", userId);
        if (sigError) return sigError;

        const totalXp = totalXpForLevel(level);
        const existing = await db.query.gameCharacterProgression.findFirst({
            where: eq(gameCharacterProgression.userId, userId),
        });

        if (existing) {
            await db
                .update(gameCharacterProgression)
                .set({ level, totalXp, updatedAt: new Date() })
                .where(eq(gameCharacterProgression.id, existing.id));
        } else {
            const progress = await db.query.gameProgress.findFirst({
                where: eq(gameProgress.userId, userId),
            });
            if (!progress) {
                return NextResponse.json({ error: "no_progress" }, { status: 404 });
            }

            await db.insert(gameCharacterProgression).values({
                userId,
                gameId: progress.gameId,
                level,
                totalXp,
            });
        }

        await queueAdminGameCommand({ type: "setLevel", userId, level, totalXp });

        return NextResponse.json({
            success: true,
            level,
            totalXp,
            skillPoints: skillPointsForLevel(level),
        });
    } catch (error) {
        console.error("[admin/players/:userId/level] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
