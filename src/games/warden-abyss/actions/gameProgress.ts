//src\games\warden-abyss\actions\gameProgress.ts
"use server";

import { db } from "@/core/database";
import { users, gameWardenProgress } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";
import { validateWallet, verifySession } from "@/games/warden-abyss/utils/security";

async function ensureUser(wallet: string) {
  const validWallet = validateWallet(wallet);
  
  const existing = await db.query.users.findFirst({
    where: eq(users.wallet, validWallet)
  });
  
  if (existing) return existing;
  
  const [newUser] = await db.insert(users)
    .values({ wallet: validWallet })
    .onConflictDoNothing()
    .returning();
    
  return newUser || await db.query.users.findFirst({ 
    where: eq(users.wallet, validWallet) 
  });
}

export async function loadProgress(wallet: string) {
  try {
    await verifySession(wallet);
    
    const user = await ensureUser(wallet);
    if (!user) throw new Error("User sync failed");

    let progress = await db.query.gameWardenProgress.findFirst({
      where: eq(gameWardenProgress.userId, user.id)
    });

    if (!progress) {
      const [newProg] = await db.insert(gameWardenProgress)
        .values({ 
          userId: user.id,
          balance: "0",
          totalEarned: "0"
        })
        .returning();
      progress = newProg;
    }

    return {
      userId: user.id,
      totalEarned: Number(progress.totalEarned),
      balance: Number(progress.balance),
      burned: Number(progress.burned),
      withdrawn: Number(progress.withdrawn),
      blocked: Number(progress.blocked),
      burnBonusPercent: progress.burnBonusPercent,
      upgrades: progress.upgrades as Record<string, number> || {},
      skins: progress.skins as Record<string, { owned: boolean }> || {},
    };
  } catch (error: unknown) {
    return {
      userId: null,
      totalEarned: 0,
      balance: 0,
      burned: 0,
      withdrawn: 0,
      blocked: 0,
      burnBonusPercent: 0,
      upgrades: {},
      skins: {},
    };
  }
}

export async function recordAction(
  wallet: string, 
  type: "burn" | "withdraw" | "block" | "upgrade" | "skin", 
  amount: number,
  extra?: { upgradeId?: string; skinId?: string }
) {
  try {
    const user = await ensureUser(wallet);
    if (!user) throw new Error("User not found");

    if (["burn", "withdraw", "block"].includes(type)) {
      const colMap = { burn: "burned", withdraw: "withdrawn", block: "blocked" } as const;
      const col = colMap[type as keyof typeof colMap];

      await db.execute(sql`
        UPDATE game_warden_progress 
        SET 
          ${sql.identifier(col)} = ${sql.identifier(col)} + ${amount.toFixed(2)},
          updated_at = NOW()
        WHERE user_id = ${user.id}
      `);
    }
  } catch (error: unknown) {
  }
}

export interface SaveProgressData {
  totalEarned: number;
  balance: number;
  burnBonusPercent: number;
  upgrades: Record<string, number>;
  skins: Record<string, { owned: boolean }>;
}

export async function saveFullProgress(
  wallet: string, 
  data: SaveProgressData
) {
  try {
    const user = await ensureUser(wallet);
    if (!user) throw new Error("User not found");

    await db.update(gameWardenProgress)
      .set({
        totalEarned: data.totalEarned.toFixed(2),
        balance: data.balance.toFixed(2),
        burnBonusPercent: data.burnBonusPercent,
        upgrades: data.upgrades,
        skins: data.skins,
        updatedAt: new Date(),
      })
      .where(eq(gameWardenProgress.userId, user.id));
  } catch (error: unknown) {
  }
}

export async function syncTotalEarned(wallet: string, totalEarned: number, balance: number) {
  try {
    const user = await ensureUser(wallet);
    if (!user) throw new Error("User not found");

    const now = new Date();
    const updatePromise = db.update(gameWardenProgress)
      .set({
        totalEarned: totalEarned.toFixed(2),
        balance: balance.toFixed(2),
        updatedAt: now,
      })
      .where(eq(gameWardenProgress.userId, user.id));
    
    await Promise.race([
      updatePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 5000)
      )
    ]);
      
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return { success: false, error: message };
  }
}

export async function getLeaderboard(limit = 50) {
  try {
    const results = await db.select({
      wallet: users.wallet,
      totalEarned: gameWardenProgress.totalEarned,
      balance: gameWardenProgress.balance,
      burned: gameWardenProgress.burned,
    })
    .from(gameWardenProgress)
    .innerJoin(users, eq(gameWardenProgress.userId, users.id))
    .orderBy(sql`${gameWardenProgress.totalEarned} DESC`)
    .limit(limit);

    return results.map(r => ({
      wallet: r.wallet.slice(0, 6) + "..." + r.wallet.slice(-4),
      totalEarned: Number(r.totalEarned),
      balance: Number(r.balance),
      burned: Number(r.burned),
    }));
  } catch (error: unknown) {
    return [];
  }
}