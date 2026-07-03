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

        if (progress) {
            await db
                .insert(gameProgress)
                .values({
                    userId,
                    gameId,
                    locationId: progress.locationId || "main-world",
                    positionX: String(progress.position?.[0] ?? 0),
                    positionY: String(progress.position?.[1] ?? 0),
                    positionZ: String(progress.position?.[2] ?? 0),
                    rotation: String(progress.rotation ?? 0),
                    health: progress.health ?? 100,
                    data: progress.data ? JSON.stringify(progress.data) : "{}",
                    lastSavedAt: new Date(),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: [gameProgress.userId, gameProgress.gameId],
                    set: {
                        locationId: progress.locationId || "main-world",
                        positionX: String(progress.position?.[0] ?? 0),
                        positionY: String(progress.position?.[1] ?? 0),
                        positionZ: String(progress.position?.[2] ?? 0),
                        rotation: String(progress.rotation ?? 0),
                        health: progress.health ?? 100,
                        data: progress.data ? JSON.stringify(progress.data) : "{}",
                        lastSavedAt: new Date(),
                        updatedAt: new Date(),
                    },
                });
        }

        if (nickname && typeof nickname === "string") {
            await db
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
                });
        }

        if (Array.isArray(buildings)) {
            await db
                .delete(gameBuildings)
                .where(and(
                    eq(gameBuildings.userId, userId),
                    eq(gameBuildings.gameId, gameId)
                ));

            if (buildings.length > 0) {
                await db.insert(gameBuildings).values(
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
                );
            }
        }

        if (Array.isArray(inventory)) {
            await db
                .delete(gameInventories)
                .where(and(
                    eq(gameInventories.userId, userId),
                    eq(gameInventories.gameId, gameId)
                ));

            if (inventory.length > 0) {
                await db.insert(gameInventories).values(
                    inventory.map((i: any) => ({
                        userId,
                        gameId,
                        slot: i.slot,
                        itemId: i.itemId,
                        quantity: i.quantity || 1,
                        data: i.data ? JSON.stringify(i.data) : "{}",
                    }))
                );
            }
        }

        if (statistics) {
            await db
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
                });
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