// app/api/internal/game/player-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameCompanionLoadouts, gameCompanions, gameMemeWallet, gameProgress, roomLayouts, users } from "@/core/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { readLayoutFixtures, type StorageFixture, type WorldPoint } from "@/core/lib/roomLayoutGrid";

interface PlayerStatus {
    id: string;
    mutedUntil: Date | null;
    isBanned: boolean;
    skinTextureUrl: string | null;
    ash: number;
    placeables: Record<string, number>;
    fixtures: boolean;
    homeSpawn: WorldPoint | null;
    storages: StorageFixture[];
    companions: { owned: { itemId: string; quantity: number }[]; equipped: string | null; fragments: number; crates: number };
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userIds, gameId } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ statuses: [] });
        }

        const ids = userIds.slice(0, 500);
        const hasLayoutAccess = typeof gameId === "string" && gameId.length > 0;

        const [accountRows, progressRows, layoutRows] = await Promise.all([
            db
                .select({ id: users.id, mutedUntil: users.mutedUntil, isBanned: users.isBanned })
                .from(users)
                .where(inArray(users.id, ids)),
            db
                .select({ userId: gameProgress.userId, data: gameProgress.data })
                .from(gameProgress)
                .where(inArray(gameProgress.userId, ids)),
            hasLayoutAccess
                ? db
                    .select({ ownerId: roomLayouts.ownerId, data: roomLayouts.data })
                    .from(roomLayouts)
                    .where(and(
                        eq(roomLayouts.gameId, gameId),
                        eq(roomLayouts.ownerType, "personal"),
                        inArray(roomLayouts.ownerId, ids)
                    ))
                : Promise.resolve([]),
        ]);

        const [companionRows, companionLoadoutRows, walletRows] = hasLayoutAccess
            ? await Promise.all([
                db
                    .select({ userId: gameCompanions.userId, itemId: gameCompanions.itemId, quantity: gameCompanions.quantity })
                    .from(gameCompanions)
                    .where(and(eq(gameCompanions.gameId, gameId), inArray(gameCompanions.userId, ids))),
                db
                    .select({ userId: gameCompanionLoadouts.userId, companionId: gameCompanionLoadouts.companionId })
                    .from(gameCompanionLoadouts)
                    .where(and(eq(gameCompanionLoadouts.gameId, gameId), inArray(gameCompanionLoadouts.userId, ids))),
                db
                    .select({ userId: gameMemeWallet.userId, fragments: gameMemeWallet.fragments, crates: gameMemeWallet.crates })
                    .from(gameMemeWallet)
                    .where(and(eq(gameMemeWallet.gameId, gameId), inArray(gameMemeWallet.userId, ids))),
            ]).catch((error) => {
                console.error("[internal/player-status] companion read failed:", error);
                return [[], [], []] as [
                    { userId: string; itemId: string; quantity: number }[],
                    { userId: string; companionId: string | null }[],
                    { userId: string; fragments: number; crates: number }[],
                ];
            })
            : [[], [], []];

        const progressByUserId = new Map(progressRows.map((row) => [row.userId, row.data]));
        const layoutByOwnerId = new Map(layoutRows.map((row) => [row.ownerId, row.data]));

        const companionsByUserId = new Map<string, { itemId: string; quantity: number }[]>();
        for (const row of companionRows) {
            if (row.quantity <= 0) continue;
            const list = companionsByUserId.get(row.userId) ?? [];
            list.push({ itemId: row.itemId, quantity: row.quantity });
            companionsByUserId.set(row.userId, list);
        }
        const equippedByUserId = new Map(companionLoadoutRows.map((row) => [row.userId, row.companionId]));
        const walletByUserId = new Map(walletRows.map((row) => [row.userId, row]));

        const statuses: PlayerStatus[] = accountRows.map((account) => {
            let skinTextureUrl: string | null = null;
            let ash = 0;
            let placeables: Record<string, number> = {};

            const raw = progressByUserId.get(account.id);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    skinTextureUrl = typeof parsed?.skinTextureUrl === "string" ? parsed.skinTextureUrl : null;
                    ash = Math.max(0, Math.floor(Number(parsed?.ash) || 0));
                    if (parsed?.placeables && typeof parsed.placeables === "object") {
                        placeables = parsed.placeables;
                    }
                } catch {
                    skinTextureUrl = null;
                    ash = 0;
                    placeables = {};
                }
            }

            const fixtures = readLayoutFixtures(layoutByOwnerId.get(account.id));

            const ownedCompanions = (companionsByUserId.get(account.id) ?? [])
                .slice()
                .sort((a, b) => a.itemId.localeCompare(b.itemId));
            const requestedCompanion = equippedByUserId.get(account.id) ?? null;
            const wallet = walletByUserId.get(account.id);

            return {
                id: account.id,
                mutedUntil: account.mutedUntil,
                isBanned: account.isBanned,
                skinTextureUrl,
                ash,
                placeables,
                fixtures: hasLayoutAccess,
                homeSpawn: fixtures.homeSpawn,
                storages: fixtures.storages,
                companions: {
                    owned: ownedCompanions,
                    equipped: requestedCompanion && ownedCompanions.some((c) => c.itemId === requestedCompanion)
                        ? requestedCompanion
                        : null,
                    fragments: Math.max(0, wallet?.fragments ?? 0),
                    crates: Math.max(0, wallet?.crates ?? 0),
                },
            };
        });

        return NextResponse.json({ statuses });
    } catch (error) {
        console.error("[internal/player-status] Error:", error);
        return NextResponse.json({ statuses: [] }, { status: 500 });
    }
}
