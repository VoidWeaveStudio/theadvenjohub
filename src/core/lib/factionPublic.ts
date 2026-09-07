// src/core/lib/factionPublic.ts
import { cache } from "react";
import { db } from "@/core/database";
import {
  factionGates,
  factionMembers,
  factionTaskLog,
  factions,
  gameNicknames,
  games,
} from "@/core/database/schema";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { getCache, setCache } from "@/core/lib/cache";
import { getTokenByCa } from "@/core/lib/dexscreener";
import { xpForLevel } from "@/core/lib/factionLeveling";
import { getFactionsRankedByGame } from "@/core/lib/factionRank";
import { minHoldUsdCents, seatsRemaining } from "@/core/lib/factionPromo";
import { normalizeHandle } from "@/core/lib/factionSlug";
import { accentHue } from "@/core/lib/accentHue";

export { accentHue };

const TOP_MEMBERS = 12;
const ACTIVITY_ROWS = 8;
const MIN_MEMBERS_TO_INDEX = 3;
const RANK_CACHE_SECONDS = 60;

export interface PublicMarket {
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  dexUrl: string | null;
  hasPair: boolean;
}

export interface PublicMember {
  nickname: string | null;
  wallet: string;
  role: string;
  roleTitle: string | null;
  contributionPoints: number;
  joinedAt: Date;
  isFounder: boolean;
  isVerifiedCreator: boolean;
}

export interface PublicActivity {
  id: string;
  taskKey: string;
  rewardAsh: number;
  nickname: string | null;
  completedAt: Date;
}

export interface PublicFaction {
  id: string;
  number: number;
  slug: string;
  name: string;
  symbol: string | null;
  image: string | null;
  description: string;
  tokenCa: string | null;
  createdAt: Date;
  level: number;
  levelProgressAsh: number;
  xpForNextLevel: number;
  memberCount: number;
  rank: number | null;
  hasGate: boolean;
  verified: boolean;
  founderWallet: string;
  game: { id: string; slug: string; title: string };
  market: PublicMarket;
  promo: {
    code: string | null;
    seats: number;
    seatsUsed: number;
    seatsLeft: number;
    minUsdCents: number;
    minTokens: number | null;
  };
  members: PublicMember[];
  activity: PublicActivity[];
  indexable: boolean;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function cachedRank(gameId: string, factionId: string): Promise<number | null> {
  const key = `faction-rank-order:${gameId}`;
  let order = await getCache<string[]>(key);

  if (order === null) {
    const ranked = await getFactionsRankedByGame(gameId);
    order = ranked.map((row) => row.id);
    await setCache(key, order, RANK_CACHE_SECONDS);
  }

  const index = order.indexOf(factionId);
  return index === -1 ? null : index + 1;
}

async function resolveFaction(handle: string) {
  const slug = normalizeHandle(handle);
  const parsed = Number(handle.replace(/^[Ff]/, ""));
  const number = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  if (!slug && number === null) return null;

  const matchers = [
    ...(slug ? [eq(factions.slug, slug)] : []),
    ...(number !== null ? [eq(factions.number, number)] : []),
  ];

  const rows = await db
    .select({ faction: factions, game: games })
    .from(factions)
    .innerJoin(games, eq(games.id, factions.gameId))
    .where(and(or(...matchers), eq(games.isActive, true)))
    .limit(4);

  const bySlug = slug ? rows.find((row) => row.faction.slug === slug) : undefined;
  if (bySlug) return bySlug;

  return (number !== null ? rows.find((row) => row.faction.number === number) : undefined) ?? null;
}

export async function resolveFactionRef(handle: string): Promise<{ id: string; gameId: string } | null> {
  const resolved = await resolveFaction(handle);
  if (!resolved || resolved.faction.pageHidden) return null;
  return { id: resolved.faction.id, gameId: resolved.faction.gameId };
}

export async function getPublicFaction(handle: string): Promise<PublicFaction | null> {
  const resolved = await resolveFaction(handle);
  if (!resolved) return null;

  const { faction, game } = resolved;
  if (faction.pageHidden) return null;

  const [memberCountRows, gate, rank, token, memberRows, activityRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(factionMembers)
      .where(eq(factionMembers.factionId, faction.id)),
    db.query.factionGates.findFirst({ where: eq(factionGates.factionId, faction.id) }),
    cachedRank(faction.gameId, faction.id),
    faction.tokenCa ? getTokenByCa(faction.tokenCa) : Promise.resolve(null),
    db
      .select({
        wallet: factionMembers.wallet,
        role: factionMembers.role,
        roleTitle: factionMembers.roleTitle,
        contributionPoints: factionMembers.contributionPoints,
        joinedAt: factionMembers.joinedAt,
        nickname: gameNicknames.nickname,
      })
      .from(factionMembers)
      .leftJoin(
        gameNicknames,
        and(eq(gameNicknames.userId, factionMembers.userId), eq(gameNicknames.gameId, faction.gameId))
      )
      .where(eq(factionMembers.factionId, faction.id))
      .orderBy(desc(factionMembers.contributionPoints), factionMembers.joinedAt)
      .limit(TOP_MEMBERS),
    db
      .select({
        id: factionTaskLog.id,
        taskKey: factionTaskLog.taskKey,
        rewardAsh: factionTaskLog.rewardAsh,
        completedAt: factionTaskLog.completedAt,
        nickname: gameNicknames.nickname,
      })
      .from(factionTaskLog)
      .leftJoin(
        gameNicknames,
        and(eq(gameNicknames.userId, factionTaskLog.rewardUserId), eq(gameNicknames.gameId, faction.gameId))
      )
      .where(eq(factionTaskLog.factionId, faction.id))
      .orderBy(desc(factionTaskLog.completedAt))
      .limit(ACTIVITY_ROWS),
  ]);

  const memberCount = memberCountRows[0]?.value ?? 0;
  const priceUsd = toNumber(token?.price);
  const market: PublicMarket = {
    priceUsd: priceUsd !== null && priceUsd > 0 ? priceUsd : null,
    marketCapUsd: toNumber(token?.mc) ?? (faction.marketCap > 0 ? faction.marketCap : null),
    liquidityUsd: toNumber(token?.liquidity),
    change24h: toNumber(token?.priceChange?.h24),
    volume24h: toNumber(token?.volume?.h24),
    dexUrl: token?.url ?? null,
    hasPair: Boolean(token),
  };

  const minUsdCents = minHoldUsdCents(faction);
  const seatsLeft = seatsRemaining(faction);

  return {
    id: faction.id,
    number: faction.number,
    slug: faction.slug || `F${faction.number}`,
    name: faction.name,
    symbol: faction.symbol,
    image: faction.image,
    description: faction.description ?? "",
    tokenCa: faction.tokenCa,
    createdAt: faction.createdAt,
    level: faction.level,
    levelProgressAsh: faction.levelProgressAsh,
    xpForNextLevel: xpForLevel(faction.level),
    memberCount,
    rank,
    hasGate: Boolean(gate),
    verified: Boolean(faction.verifiedCreatorUserId),
    founderWallet: faction.founderWallet,
    game: { id: game.id, slug: game.slug, title: game.title },
    market,
    promo: {
      code: faction.promoCode,
      seats: faction.promoSeats,
      seatsUsed: faction.promoSeatsUsed,
      seatsLeft,
      minUsdCents,
      minTokens: market.priceUsd ? minUsdCents / 100 / market.priceUsd : null,
    },
    members: memberRows.map((row) => ({
      nickname: row.nickname,
      wallet: row.wallet,
      role: row.role,
      roleTitle: row.roleTitle,
      contributionPoints: row.contributionPoints,
      joinedAt: row.joinedAt,
      isFounder: row.wallet === faction.founderWallet,
      isVerifiedCreator: Boolean(faction.verifiedCreatorWallet) && row.wallet === faction.verifiedCreatorWallet,
    })),
    activity: activityRows.map((row) => ({
      id: row.id,
      taskKey: row.taskKey,
      rewardAsh: row.rewardAsh,
      nickname: row.nickname,
      completedAt: row.completedAt,
    })),
    indexable: Boolean(gate) && memberCount >= MIN_MEMBERS_TO_INDEX && market.hasPair,
  };
}

export const getPublicFactionCached = cache(getPublicFaction);

export async function listIndexableFactions(): Promise<{ slug: string; createdAt: Date }[]> {
  const memberCount = count(factionMembers.id);

  const rows = await db
    .select({ slug: factions.slug, number: factions.number, createdAt: factions.createdAt, memberCount })
    .from(factions)
    .innerJoin(games, eq(games.id, factions.gameId))
    .innerJoin(factionGates, eq(factionGates.factionId, factions.id))
    .leftJoin(factionMembers, eq(factionMembers.factionId, factions.id))
    .where(and(eq(games.isActive, true), eq(factions.pageHidden, false)))
    .groupBy(factions.id)
    .having(sql`count(${factionMembers.id}) >= ${MIN_MEMBERS_TO_INDEX}`);

  return rows.map((row) => ({ slug: row.slug || `F${row.number}`, createdAt: row.createdAt }));
}

export interface FactionListRow {
  slug: string;
  number: number;
  name: string;
  symbol: string | null;
  image: string | null;
  level: number;
  memberCount: number;
  marketCap: number;
  hasPromo: boolean;
  seatsLeft: number;
  verified: boolean;
}

export async function listPublicFactions(limit = 60): Promise<FactionListRow[]> {
  const memberCount = count(factionMembers.id);

  const rows = await db
    .select({
      slug: factions.slug,
      number: factions.number,
      name: factions.name,
      symbol: factions.symbol,
      image: factions.image,
      level: factions.level,
      marketCap: factions.marketCap,
      promoCode: factions.promoCode,
      promoSeats: factions.promoSeats,
      promoSeatsUsed: factions.promoSeatsUsed,
      verifiedCreatorUserId: factions.verifiedCreatorUserId,
      memberCount,
    })
    .from(factions)
    .innerJoin(games, eq(games.id, factions.gameId))
    .leftJoin(factionMembers, eq(factionMembers.factionId, factions.id))
    .where(and(eq(games.isActive, true), eq(factions.pageHidden, false)))
    .groupBy(factions.id)
    .orderBy(desc(factions.level), desc(memberCount))
    .limit(limit);

  return rows.map((row) => ({
    slug: row.slug || `F${row.number}`,
    number: row.number,
    name: row.name,
    symbol: row.symbol,
    image: row.image,
    level: row.level,
    memberCount: row.memberCount,
    marketCap: row.marketCap,
    hasPromo: Boolean(row.promoCode),
    seatsLeft: Math.max(row.promoSeats - row.promoSeatsUsed, 0),
    verified: Boolean(row.verifiedCreatorUserId),
  }));
}
