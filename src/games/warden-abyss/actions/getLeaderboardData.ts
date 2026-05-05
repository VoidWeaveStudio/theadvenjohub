//src\games\warden-abyss\actions\getLeaderboardData.ts
"use server";

import { db } from "@/core/database";
import { users, gameWardenProgress } from "@/core/database/schema";
import { eq, sql, sum } from "drizzle-orm";

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  totalEarned: number;
  burned: number;
  withdrawn: number;
  blocked: number;
}

export interface GlobalStats {
  totalBurned: number;
  totalWithdrawn: number;
  totalBlocked: number;
  totalPlayers: number;
}

export interface LeaderboardData {
  globalStats: GlobalStats;
  topPlayers: LeaderboardEntry[];
}

export async function getLeaderboardData(limit = 100): Promise<LeaderboardData> {
  try {
    const statsResult = await db
      .select({
        totalBurned: sum(gameWardenProgress.burned),
        totalWithdrawn: sum(gameWardenProgress.withdrawn),
        totalBlocked: sum(gameWardenProgress.blocked),
        totalPlayers: sql<number>`COUNT(DISTINCT ${gameWardenProgress.userId})`,
      })
      .from(gameWardenProgress)
      .execute();

    const stats = statsResult[0] || {};

    const topPlayersResult = await db
      .select({
        wallet: users.wallet,
        totalEarned: gameWardenProgress.totalEarned,
        burned: gameWardenProgress.burned,
        withdrawn: gameWardenProgress.withdrawn,
        blocked: gameWardenProgress.blocked,
      })
      .from(gameWardenProgress)
      .innerJoin(users, eq(gameWardenProgress.userId, users.id))
      .orderBy(sql`${gameWardenProgress.totalEarned} DESC`)
      .limit(limit)
      .execute();

    const topPlayers: LeaderboardEntry[] = topPlayersResult.map((row, index) => ({
      rank: index + 1,
      wallet: formatWallet(row.wallet),
      totalEarned: Number(row.totalEarned) || 0,
      burned: Number(row.burned) || 0,
      withdrawn: Number(row.withdrawn) || 0,
      blocked: Number(row.blocked) || 0,
    }));

    return {
      globalStats: {
        totalBurned: Number(stats.totalBurned) || 0,
        totalWithdrawn: Number(stats.totalWithdrawn) || 0,
        totalBlocked: Number(stats.totalBlocked) || 0,
        totalPlayers: Number(stats.totalPlayers) || 0,
      },
      topPlayers,
    };
  } catch (error: unknown) {
    return {
      globalStats: {
        totalBurned: 0,
        totalWithdrawn: 0,
        totalBlocked: 0,
        totalPlayers: 0,
      },
      topPlayers: [],
    };
  }
}

function formatWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}