// app/api/admin/overview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import {
    users,
    gameLicenses,
    shopPurchases,
    trades,
    factions,
    factionGates,
    factionQuests,
    supportTickets,
    tournaments,
    marketplacePurchases,
    gameStatistics,
    gameCharacterProgression,
} from "@/core/database/schema";
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getTnjUsdPrice } from "@/core/lib/tnjPricing";

async function scalar(query: Promise<{ value: unknown }[]>): Promise<number> {
    const rows = await query;
    return Number(rows[0]?.value ?? 0) || 0;
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const now = Date.now();
        const day = new Date(now - 24 * 60 * 60 * 1000);
        const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const month = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            newUsersDay,
            newUsersWeek,
            onlineUsers,
            bannedUsers,
            mutedUsers,
            owners,
            licensesPaid,
            licensesPromo,
            licenseTnj,
            licenseTnjWeek,
            shopCount,
            shopTnj,
            shopTnjWeek,
            shopFailed,
            tradeCount,
            tradeTnj,
            marketplaceCount,
            marketplaceTnj,
            factionCount,
            factionCreationPaid,
            factionPromoPaid,
            factionGateCount,
            factionGatePaid,
            questsActive,
            ticketsOpen,
            tournamentsLive,
            playtimeSeconds,
            avgLevel,
        ] = await Promise.all([
            scalar(db.select({ value: count() }).from(users)),
            scalar(db.select({ value: count() }).from(users).where(gte(users.createdAt, day))),
            scalar(db.select({ value: count() }).from(users).where(gte(users.createdAt, week))),
            scalar(db.select({ value: count() }).from(users).where(eq(users.isOnline, true))),
            scalar(db.select({ value: count() }).from(users).where(eq(users.isBanned, true))),
            scalar(db.select({ value: count() }).from(users).where(sql`${users.mutedUntil} > now()`)),
            scalar(db.select({ value: sql`count(distinct ${gameLicenses.userId})` }).from(gameLicenses).where(eq(gameLicenses.isActive, true))),
            scalar(db.select({ value: count() }).from(gameLicenses).where(isNotNull(gameLicenses.txSignature))),
            scalar(db.select({ value: count() }).from(gameLicenses).where(isNotNull(gameLicenses.grantedViaPromoFactionId))),
            scalar(db.select({ value: sql`coalesce(sum(${gameLicenses.price}), 0)` }).from(gameLicenses).where(isNotNull(gameLicenses.txSignature))),
            scalar(db.select({ value: sql`coalesce(sum(${gameLicenses.price}), 0)` }).from(gameLicenses).where(and(isNotNull(gameLicenses.txSignature), gte(gameLicenses.purchasedAt, week)))),
            scalar(db.select({ value: count() }).from(shopPurchases).where(eq(shopPurchases.status, "completed"))),
            scalar(db.select({ value: sql`coalesce(sum(${shopPurchases.priceTnj}), 0)` }).from(shopPurchases).where(eq(shopPurchases.status, "completed"))),
            scalar(db.select({ value: sql`coalesce(sum(${shopPurchases.priceTnj}), 0)` }).from(shopPurchases).where(and(eq(shopPurchases.status, "completed"), gte(shopPurchases.createdAt, week)))),
            scalar(db.select({ value: count() }).from(shopPurchases).where(sql`${shopPurchases.status} <> 'completed'`)),
            scalar(db.select({ value: count() }).from(trades).where(eq(trades.status, "completed"))),
            scalar(db.select({ value: sql`coalesce(sum(${trades.priceTnj}), 0)` }).from(trades).where(eq(trades.status, "completed"))),
            scalar(db.select({ value: count() }).from(marketplacePurchases)),
            scalar(db.select({ value: sql`coalesce(sum(${marketplacePurchases.amount}), 0)` }).from(marketplacePurchases)),
            scalar(db.select({ value: count() }).from(factions)),
            scalar(db.select({ value: count() }).from(factions).where(isNotNull(factions.creationTx))),
            scalar(db.select({ value: count() }).from(factions).where(isNotNull(factions.promoCodePurchaseTx))),
            scalar(db.select({ value: count() }).from(factionGates)),
            scalar(db.select({ value: count() }).from(factionGates).where(isNotNull(factionGates.purchaseTx))),
            scalar(db.select({ value: count() }).from(factionQuests).where(eq(factionQuests.status, "active"))),
            scalar(db.select({ value: count() }).from(supportTickets).where(eq(supportTickets.status, "open"))),
            scalar(db.select({ value: count() }).from(tournaments).where(eq(tournaments.status, "published"))),
            scalar(db.select({ value: sql`coalesce(sum(${gameStatistics.playtimeSeconds}), 0)` }).from(gameStatistics)),
            scalar(db.select({ value: sql`coalesce(round(avg(${gameCharacterProgression.level})), 0)` }).from(gameCharacterProgression)),
        ]);

        const activeMonth = await scalar(
            db.select({ value: count() }).from(gameStatistics).where(gte(gameStatistics.lastPlayedAt, month))
        );

        const tnjUsd = await getTnjUsdPrice();
        const grossTnj = licenseTnj + shopTnj;

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            tnjUsdPrice: tnjUsd,
            players: {
                total: totalUsers,
                newDay: newUsersDay,
                newWeek: newUsersWeek,
                online: onlineUsers,
                banned: bannedUsers,
                muted: mutedUsers,
                owners,
                activeMonth,
                playtimeHours: Math.round(playtimeSeconds / 3600),
                avgLevel,
            },
            revenue: {
                grossTnj,
                grossUsd: tnjUsd ? grossTnj * tnjUsd : null,
                gameSalesCount: licensesPaid,
                gameSalesTnj: licenseTnj,
                gameSalesTnjWeek: licenseTnjWeek,
                promoLicenses: licensesPromo,
                shopCount,
                shopTnj,
                shopTnjWeek,
                shopFailed,
                tradeCount,
                tradeTnj,
                marketplaceCount,
                marketplaceTnj,
                factionCreationPaid,
                factionPromoPaid,
                factionGatePaid,
            },
            world: {
                factions: factionCount,
                gates: factionGateCount,
                questsActive,
                ticketsOpen,
                tournamentsLive,
            },
        });
    } catch (error) {
        console.error("[admin/overview] Error:", error);
        return NextResponse.json({ error: "overview_failed" }, { status: 500 });
    }
}
