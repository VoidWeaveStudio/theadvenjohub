// app/api/admin/players/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import {
    users,
    gameNicknames,
    gameStatistics,
    gameProgress,
    gameInventories,
    factionMembers,
    factions,
    userAchievements,
    gameLicenses,
    games,
    gameCosmetics,
    gameCosmeticLoadouts,
} from "@/core/database/schema";
import { eq, desc } from "drizzle-orm";
import { ACHIEVEMENTS_BY_KEY } from "@/core/lib/achievements";
import { COSMETICS_BY_ID, normalizeLoadout } from "@/features/game/data/cosmetics";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const [nicknames, statistics, progress, inventory, memberships, achievements, licenses] = await Promise.all([
            db.query.gameNicknames.findMany({ where: eq(gameNicknames.userId, userId) }),
            db.query.gameStatistics.findFirst({ where: eq(gameStatistics.userId, userId) }),
            db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) }),
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
        if (progress?.data) {
            try {
                const parsedProgress = JSON.parse(progress.data);
                ash = Number(parsedProgress?.ash) || 0;
                skinTextureUrl = typeof parsedProgress?.skinTextureUrl === "string" ? parsedProgress.skinTextureUrl : null;
                if (parsedProgress?.placeables && typeof parsedProgress.placeables === "object") {
                    placeables = parsedProgress.placeables;
                }
            } catch {
                ash = 0;
            }
        }

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

        return NextResponse.json({
            player: {
                id: user.id,
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
                skinTextureUrl,
                cosmetics,
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

        const sigError = verifyAdminAction(req, body, isBanned ? "ban" : "unban", userId);
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
