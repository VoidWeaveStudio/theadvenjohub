//app\api\internal\game\save-progress\route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import {
    gameProgress,
    gameNicknames,
    gameBuildings,
    gameInventories,
    gameStatistics,
} from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const {
            userId,
            gameId,
            progress,
            nickname,
            buildings,
            inventory,
            statistics,
        } = body;

        if (!userId || !gameId) {
            return NextResponse.json(
                { success: false, error: "missing_required_fields" },
                { status: 400 }
            );
        }

        const queries: any[] = [];

        if (progress) {
            const num = (v: unknown, fallback: number) =>
                typeof v === "number" && Number.isFinite(v) ? v : fallback;

            const locationId =
                typeof progress.locationId === "string" && progress.locationId.length > 0
                    ? progress.locationId.slice(0, 50)
                    : "main-world";
            const positionX = String(num(progress.position?.[0], 0));
            const positionY = String(num(progress.position?.[1], 0));
            const positionZ = String(num(progress.position?.[2], 0));
            const rotation = String(num(progress.rotation, 0));
            const health = Math.max(0, Math.min(100, Math.round(num(progress.health, 100))));

            queries.push(
                db
                    .insert(gameProgress)
                    .values({
                        userId,
                        gameId,
                        locationId,
                        positionX,
                        positionY,
                        positionZ,
                        rotation,
                        health,
                        data: progress.data ? JSON.stringify(progress.data) : "{}",
                        lastSavedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: [gameProgress.userId, gameProgress.gameId],
                        set: {
                            locationId,
                            positionX,
                            positionY,
                            positionZ,
                            rotation,
                            health,
                            data: progress.data ? JSON.stringify(progress.data) : "{}",
                            lastSavedAt: new Date(),
                            updatedAt: new Date(),
                        },
                    })
            );
        }

        if (nickname && typeof nickname === "string") {
            queries.push(
                db
                    .insert(gameNicknames)
                    .values({
                        userId,
                        gameId,
                        nickname: nickname.slice(0, 30),
                        updatedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: [gameNicknames.userId, gameNicknames.gameId],
                        set: {
                            nickname: nickname.slice(0, 30),
                            updatedAt: new Date(),
                        },
                    })
            );
        }

        if (Array.isArray(buildings)) {
            queries.push(
                db
                    .delete(gameBuildings)
                    .where(and(
                        eq(gameBuildings.userId, userId),
                        eq(gameBuildings.gameId, gameId)
                    ))
            );

            if (buildings.length > 0) {
                queries.push(
                    db.insert(gameBuildings).values(
                        buildings.map((b: any) => ({
                            userId,
                            gameId,
                            locationId: b.locationId || "main-world",
                            gridX: b.gridX,
                            gridZ: b.gridZ,
                            type: b.type,
                            rotation: b.rotation || 0,
                            data: b.data ? JSON.stringify(b.data) : "{}",
                        }))
                    )
                );
            }
        }

        if (Array.isArray(inventory)) {
            queries.push(
                db
                    .delete(gameInventories)
                    .where(and(
                        eq(gameInventories.userId, userId),
                        eq(gameInventories.gameId, gameId)
                    ))
            );

            if (inventory.length > 0) {
                queries.push(
                    db.insert(gameInventories).values(
                        inventory.map((i: any) => ({
                            userId,
                            gameId,
                            slot: i.slot,
                            itemId: i.itemId,
                            quantity: i.quantity || 1,
                            data: i.data ? JSON.stringify(i.data) : "{}",
                        }))
                    )
                );
            }
        }

        if (statistics) {
            queries.push(
                db
                    .insert(gameStatistics)
                    .values({
                        userId,
                        gameId,
                        playtimeSeconds: statistics.playtimeSeconds ?? 0,
                        kills: statistics.kills ?? 0,
                        deaths: statistics.deaths ?? 0,
                        shotsFired: statistics.shotsFired ?? 0,
                        buildingsPlaced: statistics.buildingsPlaced ?? 0,
                        lastPlayedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: [gameStatistics.userId, gameStatistics.gameId],
                        set: {
                            playtimeSeconds: statistics.playtimeSeconds ?? 0,
                            kills: statistics.kills ?? 0,
                            deaths: statistics.deaths ?? 0,
                            shotsFired: statistics.shotsFired ?? 0,
                            buildingsPlaced: statistics.buildingsPlaced ?? 0,
                            lastPlayedAt: new Date(),
                            updatedAt: new Date(),
                        },
                    })
            );
        }

        if (queries.length > 0) {
            await db.batch(queries as [any, ...any[]]);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("[internal/save-progress] Error:", error);
        return NextResponse.json(
            { success: false, error: "save_failed" },
            { status: 500 }
        );
    }
}
