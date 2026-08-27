// app/api/admin/players/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import {
    users,
    gameNicknames,
    gameStatistics,
    gameProgress,
    gameCharacterProgression,
    gameInventories,
    factionMembers,
    factions,
    userAchievements,
    gameLicenses,
    games,
    gameCosmetics,
    gameCosmeticLoadouts,
    shopPurchases,
    trades,
    gameBuildings,
} from "@/core/database/schema";
import { eq, desc, or, count } from "drizzle-orm";
import { ACHIEVEMENTS_BY_KEY } from "@/core/lib/achievements";
import { COSMETICS_BY_ID, normalizeLoadout } from "@/features/game/data/cosmetics";
import { EMPTY_COSMETIC_CRATE_STATE, readCosmeticCrateState } from "@/core/lib/cosmeticCrates";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import { EMPTY_COMPANION_STATE, readCompanionState } from "@/core/lib/companionInventory";
import { flushStaleCommands } from "@/core/lib/adminLiveSync";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;

        // Keeps the panel honest: anything queued for a session that never picked
        // it up is written to the row before the numbers below are read.
        await flushStaleCommands(null).catch((error) => {
            console.error("[admin/players/:userId GET] stale flush failed:", error);
        });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const [nicknames, statistics, progress, progression, inventory, memberships, achievements, licenses] = await Promise.all([
            db.query.gameNicknames.findMany({ where: eq(gameNicknames.userId, userId) }),
            db.query.gameStatistics.findFirst({ where: eq(gameStatistics.userId, userId) }),
            db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) }),
            db.query.gameCharacterProgression.findFirst({ where: eq(gameCharacterProgression.userId, userId) }),
            db.query.gameInventories.findMany({ where: eq(gameInventories.userId, userId) }),
            db.query.factionMembers.findMany({ where: eq(factionMembers.userId, userId) }),
            db.query.userAchievements.findMany({ where: eq(userAchievements.userId, userId) }),
            db.select({
                id: gameLicenses.id,
                gameId: gameLicenses.gameId,
                gameTitle: games.title,
                isActive: gameLicenses.isActive,
                purchasedAt: gameLicenses.purchasedAt,
                price: gameLicenses.price,
                txSignature: gameLicenses.txSignature,
                grantedViaPromoFactionId: gameLicenses.grantedViaPromoFactionId,
                promoFactionName: factions.name,
            })
                .from(gameLicenses)
                .innerJoin(games, eq(games.id, gameLicenses.gameId))
                .leftJoin(factions, eq(factions.id, gameLicenses.grantedViaPromoFactionId))
                .where(eq(gameLicenses.userId, userId))
                .orderBy(desc(gameLicenses.purchasedAt)),
        ]);

        let ash = 0;
        let skinTextureUrl: string | null = null;
        let placeables: Record<string, number> = {};
        let storageCount = 0;
        if (progress?.data) {
            try {
                const parsedProgress = JSON.parse(progress.data);
                ash = Number(parsedProgress?.ash) || 0;
                skinTextureUrl = typeof parsedProgress?.skinTextureUrl === "string" ? parsedProgress.skinTextureUrl : null;
                if (parsedProgress?.placeables && typeof parsedProgress.placeables === "object") {
                    placeables = parsedProgress.placeables;
                }
                if (parsedProgress?.storage && typeof parsedProgress.storage === "object") {
                    storageCount = Object.keys(parsedProgress.storage).length;
                }
            } catch {
                ash = 0;
            }
        }

        const [shopHistory, tradeHistory, buildingCount] = await Promise.all([
            db
                .select({
                    id: shopPurchases.id,
                    itemId: shopPurchases.itemId,
                    quantity: shopPurchases.quantity,
                    priceTnj: shopPurchases.priceTnj,
                    status: shopPurchases.status,
                    txSignature: shopPurchases.txSignature,
                    createdAt: shopPurchases.createdAt,
                })
                .from(shopPurchases)
                .where(eq(shopPurchases.userId, userId))
                .orderBy(desc(shopPurchases.createdAt))
                .limit(50),
            db
                .select({
                    id: trades.id,
                    itemName: trades.itemName,
                    quantity: trades.quantity,
                    priceTnj: trades.priceTnj,
                    status: trades.status,
                    createdAt: trades.createdAt,
                    buyerId: trades.buyerId,
                    sellerId: trades.sellerId,
                })
                .from(trades)
                .where(or(eq(trades.buyerId, userId), eq(trades.sellerId, userId)))
                .orderBy(desc(trades.createdAt))
                .limit(50),
            db.select({ value: count() }).from(gameBuildings).where(eq(gameBuildings.userId, userId)),
        ]);

        const spend = {
            gameTnj: licenses.filter((l) => l.txSignature).reduce((sum, l) => sum + (Number(l.price) || 0), 0),
            shopTnj: shopHistory.filter((p) => p.status === "completed").reduce((sum, p) => sum + (Number(p.priceTnj) || 0), 0),
            tradeSpentTnj: tradeHistory
                .filter((t) => t.status === "completed" && t.buyerId === userId)
                .reduce((sum, t) => sum + (Number(t.priceTnj) || 0), 0),
            tradeEarnedTnj: tradeHistory
                .filter((t) => t.status === "completed" && t.sellerId === userId)
                .reduce((sum, t) => sum + (Number(t.priceTnj) || 0), 0),
        };

        const factionsList = [];
        for (const membership of memberships) {
            const faction = await db.query.factions.findFirst({ where: eq(factions.id, membership.factionId) });
            if (!faction) continue;
            factionsList.push({
                id: faction.id,
                number: faction.number,
                name: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                level: faction.level,
                role: membership.role,
                isDisplayed: membership.isDisplayed,
                contributionPoints: membership.contributionPoints,
                tasksContributed: membership.tasksContributed,
                joinedAt: membership.joinedAt,
            });
        }

        const achievementsList = achievements
            .map((row) => {
                const def = ACHIEVEMENTS_BY_KEY.get(row.achievementKey);
                if (!def) return null;
                return { key: def.key, label: def.label, description: def.description, unlockedAt: row.unlockedAt };
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);

        const ownedCosmetics = await db
            .select({ itemId: gameCosmetics.itemId, purchasedAt: gameCosmetics.purchasedAt })
            .from(gameCosmetics)
            .where(eq(gameCosmetics.userId, userId));

        const loadoutRow = await db.query.gameCosmeticLoadouts.findFirst({
            where: eq(gameCosmeticLoadouts.userId, userId),
        });
        const loadout = normalizeLoadout(loadoutRow?.skinId, loadoutRow?.accessoryId);

        const cosmetics = {
            equippedSkin: loadout.skinId
                ? { id: loadout.skinId, name: COSMETICS_BY_ID.get(loadout.skinId)?.name ?? loadout.skinId }
                : null,
            equippedAccessory: loadout.accessoryId
                ? { id: loadout.accessoryId, name: COSMETICS_BY_ID.get(loadout.accessoryId)?.name ?? loadout.accessoryId }
                : null,
            owned: ownedCosmetics.map((c) => ({
                id: c.itemId,
                name: COSMETICS_BY_ID.get(c.itemId as any)?.name ?? c.itemId,
                slot: COSMETICS_BY_ID.get(c.itemId as any)?.slot ?? "unknown",
                purchasedAt: c.purchasedAt,
            })),
        };

        const companionGameId = progress?.gameId ?? (await resolveGameId(null));
        const [companions, cosmeticCrates] = await Promise.all([
            companionGameId
                ? readCompanionState(userId, companionGameId).catch((error) => {
                    console.error("[admin/players/:userId GET] companion state failed:", error);
                    return EMPTY_COMPANION_STATE;
                })
                : EMPTY_COMPANION_STATE,
            companionGameId
                ? readCosmeticCrateState(userId, companionGameId).catch((error) => {
                    console.error("[admin/players/:userId GET] cosmetic crate state failed:", error);
                    return EMPTY_COSMETIC_CRATE_STATE;
                })
                : EMPTY_COSMETIC_CRATE_STATE,
        ]);

        return NextResponse.json({
            player: {
                id: user.id,
                number: user.number,
                wallet: user.wallet,
                isBanned: user.isBanned,
                banReason: user.banReason,
                bannedAt: user.bannedAt,
                isOnline: user.isOnline,
                lastSeenAt: user.lastSeenAt,
                mutedUntil: user.mutedUntil,
                createdAt: user.createdAt,
                nicknames: nicknames.map((n) => n.nickname),
                stats: {
                    kills: statistics?.kills ?? 0,
                    deaths: statistics?.deaths ?? 0,
                    shotsFired: statistics?.shotsFired ?? 0,
                    buildingsPlaced: statistics?.buildingsPlaced ?? 0,
                    playtimeSeconds: statistics?.playtimeSeconds ?? 0,
                    lastPlayedAt: statistics?.lastPlayedAt ?? null,
                },
                ash,
                progression: {
                    level: progression?.level ?? 1,
                    totalXp: progression?.totalXp ?? 0,
                    branch: progression?.branch ?? null,
                    respecCount: progression?.respecCount ?? 0,
                },
                storageCount,
                buildingCount: Number(buildingCount[0]?.value ?? 0) || 0,
                spend,
                shopHistory,
                tradeHistory,
                skinTextureUrl,
                cosmetics,
                cosmeticCrates,
                companions,
                placeables,
                locationId: progress?.locationId ?? null,
                inventory: inventory.map((i) => ({ slot: i.slot, itemId: i.itemId, quantity: i.quantity })),
                factions: factionsList,
                achievements: achievementsList,
                licenses,
            },
        });
    } catch (error) {
        console.error("[admin/players/:userId GET] Error:", error);
        return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const { isBanned, banReason } = body;

        if (typeof isBanned !== "boolean") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, isBanned ? "ban" : "unban", userId);
        if (sigError) return sigError;

        const [updated] = await db
            .update(users)
            .set({
                isBanned,
                bannedAt: isBanned ? new Date() : null,
                banReason: isBanned ? (typeof banReason === "string" ? banReason.slice(0, 500) : null) : null,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, isBanned: updated.isBanned });
    } catch (error) {
        console.error("[admin/players/:userId] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
