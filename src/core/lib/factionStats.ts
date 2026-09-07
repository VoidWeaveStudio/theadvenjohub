// src/core/lib/factionStats.ts
import { db } from "@/core/database";
import {
  factionMembers,
  factionPageStats,
  gameLicenses,
  gameNicknames,
  gameStatistics,
} from "@/core/database/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getCache, setCache } from "@/core/lib/cache";

export type PageStatField = "views" | "connects" | "eligible";

const DEDUPE_TTL_SECONDS = 86_400;
const REFERRED_LIMIT = 100;
const ACTIVE_WINDOW_DAYS = 7;

export interface FunnelDay {
  day: string;
  views: number;
  connects: number;
  eligible: number;
  claims: number;
}

export interface ReferredPlayer {
  wallet: string;
  nickname: string | null;
  claimedAt: Date;
  stillMember: boolean;
  lastPlayedAt: Date | null;
  playtimeSeconds: number;
}

export interface FounderFunnel {
  windowDays: number;
  totals: {
    views: number;
    connects: number;
    eligible: number;
    claims: number;
  };
  lifetime: {
    claims: number;
    stillMembers: number;
    activeLastWeek: number;
  };
  daily: FunnelDay[];
  referred: ReferredPlayer[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function bumpPageStat(factionId: string, field: PageStatField): Promise<void> {
  const day = today();
  const seed = { factionId, day, views: 0, connects: 0, eligible: 0, [field]: 1 };

  const increment =
    field === "views"
      ? { views: sql`${factionPageStats.views} + 1` }
      : field === "connects"
        ? { connects: sql`${factionPageStats.connects} + 1` }
        : { eligible: sql`${factionPageStats.eligible} + 1` };

  try {
    await db
      .insert(factionPageStats)
      .values(seed)
      .onConflictDoUpdate({
        target: [factionPageStats.factionId, factionPageStats.day],
        set: increment,
      });
  } catch (error) {
    console.error("[factionStats] bump failed:", error);
  }
}

export async function bumpPageStatOnce(
  factionId: string,
  field: PageStatField,
  dedupeKey: string
): Promise<boolean> {
  const key = `faction-stat:${factionId}:${field}:${today()}:${dedupeKey}`;
  if ((await getCache<number>(key)) !== null) return false;

  await setCache(key, 1, DEDUPE_TTL_SECONDS);
  await bumpPageStat(factionId, field);
  return true;
}

export async function getFounderFunnel(
  factionId: string,
  gameId: string,
  windowDays = 30
): Promise<FounderFunnel> {
  const from = dayOffset(windowDays - 1);
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);

  const [statRows, claimRows, referredRows] = await Promise.all([
    db
      .select()
      .from(factionPageStats)
      .where(and(eq(factionPageStats.factionId, factionId), gte(factionPageStats.day, from)))
      .orderBy(factionPageStats.day),
    db
      .select({
        day: sql<string>`to_char(${gameLicenses.purchasedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(gameLicenses)
      .where(
        and(
          eq(gameLicenses.grantedViaPromoFactionId, factionId),
          gte(gameLicenses.purchasedAt, fromDate)
        )
      )
      .groupBy(sql`to_char(${gameLicenses.purchasedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`),
    db
      .select({
        wallet: gameLicenses.wallet,
        claimedAt: gameLicenses.purchasedAt,
        nickname: gameNicknames.nickname,
        memberId: factionMembers.id,
        lastPlayedAt: gameStatistics.lastPlayedAt,
        playtimeSeconds: gameStatistics.playtimeSeconds,
      })
      .from(gameLicenses)
      .leftJoin(
        gameNicknames,
        and(eq(gameNicknames.userId, gameLicenses.userId), eq(gameNicknames.gameId, gameId))
      )
      .leftJoin(
        factionMembers,
        and(eq(factionMembers.userId, gameLicenses.userId), eq(factionMembers.factionId, factionId))
      )
      .leftJoin(
        gameStatistics,
        and(eq(gameStatistics.userId, gameLicenses.userId), eq(gameStatistics.gameId, gameId))
      )
      .where(eq(gameLicenses.grantedViaPromoFactionId, factionId))
      .orderBy(desc(gameLicenses.purchasedAt))
      .limit(REFERRED_LIMIT),
  ]);

  const claimsByDay = new Map(claimRows.map((row) => [row.day, row.count]));
  const statsByDay = new Map(statRows.map((row) => [row.day, row]));

  const daily: FunnelDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = dayOffset(i);
    const stat = statsByDay.get(day);
    daily.push({
      day,
      views: stat?.views ?? 0,
      connects: stat?.connects ?? 0,
      eligible: stat?.eligible ?? 0,
      claims: claimsByDay.get(day) ?? 0,
    });
  }

  const referred: ReferredPlayer[] = referredRows.map((row) => ({
    wallet: row.wallet,
    nickname: row.nickname,
    claimedAt: row.claimedAt,
    stillMember: row.memberId !== null,
    lastPlayedAt: row.lastPlayedAt,
    playtimeSeconds: row.playtimeSeconds ?? 0,
  }));

  const [lifetimeClaims] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(gameLicenses)
    .where(eq(gameLicenses.grantedViaPromoFactionId, factionId));

  return {
    windowDays,
    totals: daily.reduce(
      (acc, row) => ({
        views: acc.views + row.views,
        connects: acc.connects + row.connects,
        eligible: acc.eligible + row.eligible,
        claims: acc.claims + row.claims,
      }),
      { views: 0, connects: 0, eligible: 0, claims: 0 }
    ),
    lifetime: {
      claims: lifetimeClaims?.value ?? 0,
      stillMembers: referred.filter((row) => row.stillMember).length,
      activeLastWeek: referred.filter((row) => row.lastPlayedAt !== null && row.lastPlayedAt >= activeSince).length,
    },
    daily,
    referred,
  };
}
