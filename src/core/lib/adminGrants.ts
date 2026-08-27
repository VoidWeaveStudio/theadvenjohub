// src/core/lib/adminGrants.ts
import { db } from "@/core/database";
import {
    gameCosmetics,
    gameCosmeticLoadouts,
    gameCompanions,
    gameCompanionLoadouts,
    gameMemeWallet,
    gameCosmeticWallet,
    userAchievements,
    gameLicenses,
    factionMembers,
    gameBuildings,
    placedFurniture,
    users,
} from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { SHOP_CATALOG, SHOP_CATALOG_BY_ID, ShopCatalogEntry } from "@/core/lib/shopCatalog";
import { COSMETIC_CRATE_ITEM_ID, COSMETICS, isCosmeticId } from "@/features/game/data/cosmetics";
import { COMPANIONS, isCompanionId } from "@/features/game/data/companions";
import { adjustCompanion, adjustWallet, equipCompanion } from "@/core/lib/companionInventory";
import { adjustCosmeticWallet } from "@/core/lib/cosmeticCrates";
import { ACHIEVEMENTS } from "@/core/lib/achievements";
import { MAX_LEVEL, totalXpForLevel } from "@/features/game/data/progression";
import { LiveOp } from "@/core/lib/adminGameCommands";
import { DeliveryMode, applyLiveOps } from "@/core/lib/adminLiveSync";

import type { GrantScope, WipeScope } from "@/core/lib/adminScopes";

export { GRANT_SCOPES, WIPE_SCOPES } from "@/core/lib/adminScopes";
export type { GrantScope, WipeScope } from "@/core/lib/adminScopes";
export { readProgress, writeProgress, readPlaceables } from "@/core/lib/adminProgress";
export type { ProgressBundle } from "@/core/lib/adminProgress";

export function isPlaceableKind(entry: ShopCatalogEntry): boolean {
    return entry.kind !== "companion" && entry.kind !== "lootbox" && entry.kind !== "cosmetic";
}

export type GrantableKind = "companion" | "lootbox" | "cosmetic" | "placeable";

export function resolveGrantableKind(itemId: string): GrantableKind | null {
    const entry = SHOP_CATALOG_BY_ID.get(itemId);
    if (entry) {
        if (entry.kind === "companion") return "companion";
        if (entry.kind === "lootbox") return "lootbox";
        if (entry.kind === "cosmetic") return "cosmetic";
        return "placeable";
    }
    if (isCompanionId(itemId)) return "companion";
    if (isCosmeticId(itemId)) return "cosmetic";
    return null;
}

export async function applyCatalogItem(
    userId: string,
    gameId: string,
    itemId: string,
    delta: number
): Promise<{ ok: boolean; reason?: string; mode?: DeliveryMode }> {
    const kind = resolveGrantableKind(itemId);
    if (!kind) return { ok: false, reason: "unknown_item" };

    if (kind === "companion") {
        const applied = await adjustCompanion(userId, gameId, itemId, delta);
        return applied ? { ok: true, mode: "db" } : { ok: false, reason: "not_enough" };
    }

    if (kind === "lootbox") {
        const applied = itemId === COSMETIC_CRATE_ITEM_ID
            ? await adjustCosmeticWallet(userId, gameId, 0, delta)
            : await adjustWallet(userId, gameId, 0, delta);
        return applied ? { ok: true, mode: "db" } : { ok: false, reason: "not_enough" };
    }

    if (kind === "cosmetic") {
        if (delta > 0) {
            const inserted = await db
                .insert(gameCosmetics)
                .values({ userId, gameId, itemId, pricePaidAsh: 0 })
                .onConflictDoNothing()
                .returning({ id: gameCosmetics.id });
            return inserted.length > 0 ? { ok: true, mode: "db" } : { ok: false, reason: "already_owned" };
        }

        const removed = await db
            .delete(gameCosmetics)
            .where(and(eq(gameCosmetics.userId, userId), eq(gameCosmetics.gameId, gameId), eq(gameCosmetics.itemId, itemId)))
            .returning({ id: gameCosmetics.id });
        return removed.length > 0 ? { ok: true, mode: "db" } : { ok: false, reason: "not_owned" };
    }

    const { mode } = await applyLiveOps(userId, [{ kind: "placeableDelta", itemId, delta }]);
    return { ok: true, mode };
}

export interface GrantEverythingOptions {
    scopes: GrantScope[];
    ash: number;
    level: number;
    crates: number;
    fragments: number;
    stackQuantity: number;
}

export async function grantEverything(
    userId: string,
    gameId: string,
    wallet: string,
    options: GrantEverythingOptions
): Promise<{ applied: string[]; failed: string[]; mode: DeliveryMode }> {
    const applied: string[] = [];
    const failed: string[] = [];
    const scopes = new Set(options.scopes);
    const ops: LiveOp[] = [];

    if (scopes.has("license")) {
        const existing = await db.query.gameLicenses.findFirst({
            where: and(eq(gameLicenses.userId, userId), eq(gameLicenses.gameId, gameId)),
        });
        if (existing) {
            if (!existing.isActive) {
                await db.update(gameLicenses).set({ isActive: true }).where(eq(gameLicenses.id, existing.id));
            }
        } else {
            await db.insert(gameLicenses).values({
                userId,
                gameId,
                wallet,
                txSignature: null,
                price: 0,
                purchasedAt: new Date(),
                isActive: true,
            });
        }
        applied.push("license");
    }

    if (scopes.has("ash")) {
        ops.push({ kind: "ashSet", value: Math.max(0, Math.floor(options.ash)) });
        applied.push("ash");
    }

    if (scopes.has("placeables")) {
        const minimums: Record<string, number> = {};
        for (const entry of SHOP_CATALOG) {
            if (!isPlaceableKind(entry)) continue;
            minimums[entry.itemId] = entry.maxOwned ?? Math.max(1, Math.floor(options.stackQuantity));
        }
        ops.push({ kind: "placeablesEnsure", minimums });
        applied.push("placeables");
    }

    if (scopes.has("companions")) {
        for (const companion of COMPANIONS) {
            await adjustCompanion(userId, gameId, companion.id, Math.max(1, Math.floor(options.stackQuantity))).catch(() => false);
        }
        applied.push("companions");
    }

    if (scopes.has("cosmetics")) {
        for (const cosmetic of COSMETICS) {
            await db
                .insert(gameCosmetics)
                .values({ userId, gameId, itemId: cosmetic.id, pricePaidAsh: 0 })
                .onConflictDoNothing()
                .catch(() => undefined);
        }
        applied.push("cosmetics");
    }

    if (scopes.has("crates")) {
        const crates = Math.max(0, Math.floor(options.crates));
        const fragments = Math.max(0, Math.floor(options.fragments));
        if (crates > 0 || fragments > 0) {
            await adjustWallet(userId, gameId, fragments, crates).catch(() => false);
            await adjustCosmeticWallet(userId, gameId, fragments, crates).catch(() => false);
        }
        applied.push("crates");
    }

    if (scopes.has("progression")) {
        const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(options.level)));
        ops.push({ kind: "progressionSet", level, totalXp: totalXpForLevel(level) });
        applied.push("progression");
    }

    if (scopes.has("achievements")) {
        for (const achievement of ACHIEVEMENTS) {
            await db
                .insert(userAchievements)
                .values({ userId, gameId, achievementKey: achievement.key })
                .onConflictDoNothing()
                .catch(() => undefined);
        }
        applied.push("achievements");
    }

    const { mode } = await applyLiveOps(userId, ops);
    return { applied, failed, mode };
}

export async function wipeEverything(
    userId: string,
    gameId: string,
    scopes: WipeScope[]
): Promise<{ applied: string[]; mode: DeliveryMode }> {
    const applied: string[] = [];
    const wanted = new Set(scopes);
    const ops: LiveOp[] = [];

    if (wanted.has("license")) {
        await db.update(gameLicenses).set({ isActive: false }).where(eq(gameLicenses.userId, userId));
        applied.push("license");
    }

    if (wanted.has("ash")) {
        ops.push({ kind: "ashSet", value: 0 });
        applied.push("ash");
    }

    if (wanted.has("placeables")) {
        ops.push({ kind: "placeablesSet", placeables: {} });
        applied.push("placeables");
    }

    if (wanted.has("storage")) {
        ops.push({ kind: "storageClear" });
        applied.push("storage");
    }

    if (wanted.has("inventory")) {
        ops.push({ kind: "inventoryClear" });
        applied.push("inventory");
    }

    if (wanted.has("companions")) {
        await db.delete(gameCompanions).where(eq(gameCompanions.userId, userId));
        await equipCompanion(userId, gameId, null).catch(() => undefined);
        await db.delete(gameCompanionLoadouts).where(eq(gameCompanionLoadouts.userId, userId));
        applied.push("companions");
    }

    if (wanted.has("cosmetics")) {
        await db.delete(gameCosmetics).where(eq(gameCosmetics.userId, userId));
        await db.delete(gameCosmeticLoadouts).where(eq(gameCosmeticLoadouts.userId, userId));
        applied.push("cosmetics");
    }

    if (wanted.has("crates")) {
        await db.delete(gameMemeWallet).where(eq(gameMemeWallet.userId, userId));
        await db.delete(gameCosmeticWallet).where(eq(gameCosmeticWallet.userId, userId));
        applied.push("crates");
    }

    if (wanted.has("progression")) {
        ops.push({ kind: "progressionReset" });
        applied.push("progression");
    }

    if (wanted.has("achievements")) {
        await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
        applied.push("achievements");
    }

    if (wanted.has("factions")) {
        await db.delete(factionMembers).where(eq(factionMembers.userId, userId));
        applied.push("factions");
    }

    if (wanted.has("buildings")) {
        await db.delete(gameBuildings).where(eq(gameBuildings.userId, userId));
        await db.delete(placedFurniture).where(eq(placedFurniture.userId, userId));
        applied.push("buildings");
    }

    if (wanted.has("statistics")) {
        ops.push({ kind: "statisticsReset" });
        applied.push("statistics");
    }

    const { mode } = await applyLiveOps(userId, ops);
    return { applied, mode };
}

export async function resolveWallet(userId: string): Promise<string | null> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return user?.wallet ?? null;
}
