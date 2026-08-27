// app/api/internal/game/load-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import {
    gameProgress,
    gameNicknames,
    gameBuildings,
    gameInventories,
    gameStatistics,
    gameCharacterProgression,
} from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { flushPendingForUser } from "@/core/lib/adminLiveSync";

function safeJsonParse(text: string | null): Record<string, unknown> {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json(
                { error: "missing_required_fields" },
                { status: 400 }
            );
        }

        // Anything an admin queued while this player was between sessions has to
        // land in the row before it is handed over, otherwise the session would
        // load stale values and save them straight back over the change.
        await flushPendingForUser(userId).catch((error) => {
            console.error("[internal/load-progress] pending admin flush failed:", error);
        });

        const [progress, nickname, buildings, inventory, statistics, progression] = await Promise.all([
            db.query.gameProgress.findFirst({
                where: and(
                    eq(gameProgress.userId, userId),
                    eq(gameProgress.gameId, gameId)
                ),
            }),
            db.query.gameNicknames.findFirst({
                where: and(
                    eq(gameNicknames.userId, userId),
                    eq(gameNicknames.gameId, gameId)
                ),
            }),
            db.query.gameBuildings.findMany({
                where: and(
                    eq(gameBuildings.userId, userId),
                    eq(gameBuildings.gameId, gameId)
                ),
            }),
            db.query.gameInventories.findMany({
                where: and(
                    eq(gameInventories.userId, userId),
                    eq(gameInventories.gameId, gameId)
                ),
            }),
            db.query.gameStatistics.findFirst({
                where: and(
                    eq(gameStatistics.userId, userId),
                    eq(gameStatistics.gameId, gameId)
                ),
            }),
            db.query.gameCharacterProgression
                .findFirst({
                    where: and(
                        eq(gameCharacterProgression.userId, userId),
                        eq(gameCharacterProgression.gameId, gameId)
                    ),
                })
                .catch((error) => {
                    console.error("[internal/load-progress] progression read failed:", error);
                    return null;
                }),
        ]);

        return NextResponse.json({
            progress: progress ? {
                locationId: progress.locationId,
                position: [
                    parseFloat(progress.positionX),
                    parseFloat(progress.positionY),
                    parseFloat(progress.positionZ),
                ],
                rotation: parseFloat(progress.rotation),
                health: progress.health,
                data: safeJsonParse(progress.data),
            } : null,
            nickname: nickname?.nickname || null,
            buildings: buildings.map((b) => ({
                id: b.id,
                locationId: b.locationId,
                gridX: b.gridX,
                gridZ: b.gridZ,
                type: b.type,
                rotation: b.rotation,
                data: safeJsonParse(b.data),
            })),
            inventory: inventory.map((i) => ({
                slot: i.slot,
                itemId: i.itemId,
                quantity: i.quantity,
                data: safeJsonParse(i.data),
            })),
            statistics: statistics ? {
                playtimeSeconds: statistics.playtimeSeconds,
                kills: statistics.kills,
                deaths: statistics.deaths,
                shotsFired: statistics.shotsFired,
                buildingsPlaced: statistics.buildingsPlaced,
                lastPlayedAt: statistics.lastPlayedAt,
            } : null,
            progression: progression ? {
                totalXp: progression.totalXp,
                level: progression.level,
                branch: progression.branch,
                skills: safeJsonParse(progression.skills),
                loadout: safeJsonParse(progression.loadout),
                fireMode: progression.fireMode,
                respecCount: progression.respecCount,
            } : null,
        });

    } catch (error) {
        console.error("[internal/load-progress] Error:", error);
        return NextResponse.json(
            { error: "load_failed" },
            { status: 500 }
        );
    }
}