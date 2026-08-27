// app/api/admin/purchases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import {
    gameLicenses,
    games,
    shopPurchases,
    trades,
    factions,
    factionGates,
    marketplacePurchases,
    marketplaceLots,
} from "@/core/database/schema";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { SHOP_CATALOG_BY_ID } from "@/core/lib/shopCatalog";

export type PurchaseKind = "game" | "shop" | "trade" | "faction" | "marketplace";

interface PurchaseRow {
    id: string;
    kind: PurchaseKind;
    at: string;
    label: string;
    itemId: string | null;
    quantity: number;
    buyerId: string | null;
    buyerWallet: string | null;
    buyerNickname: string | null;
    sellerWallet: string | null;
    sellerNickname: string | null;
    priceTnj: number | null;
    status: string;
    note: string | null;
    tx: string | null;
}

const KINDS: PurchaseKind[] = ["game", "shop", "trade", "faction", "marketplace"];

function parseDate(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function matchesText(row: PurchaseRow, needle: string): boolean {
    if (!needle) return true;
    const haystack = [
        row.label,
        row.itemId,
        row.buyerWallet,
        row.buyerNickname,
        row.sellerWallet,
        row.sellerNickname,
        row.tx,
        row.note,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(needle);
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const kindParam = searchParams.get("kind");
        const kinds: PurchaseKind[] = kindParam && KINDS.includes(kindParam as PurchaseKind) ? [kindParam as PurchaseKind] : KINDS;
        const statusFilter = searchParams.get("status") || "all";
        const query = (searchParams.get("q") || "").trim();
        const needle = query.toLowerCase();
        const from = parseDate(searchParams.get("from"));
        const to = parseDate(searchParams.get("to"));
        const limit = Math.min(500, Math.max(10, Number(searchParams.get("limit")) || 100));
        const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
        const fetchCap = Math.min(2000, offset + limit + 200);
        const like = query ? `%${query}%` : null;

        const rows: PurchaseRow[] = [];

        if (kinds.includes("game")) {
            const licenseRows = await db
                .select({
                    id: gameLicenses.id,
                    at: gameLicenses.purchasedAt,
                    price: gameLicenses.price,
                    tx: gameLicenses.txSignature,
                    isActive: gameLicenses.isActive,
                    wallet: gameLicenses.wallet,
                    userId: gameLicenses.userId,
                    gameTitle: games.title,
                    promoCode: gameLicenses.promoCodeUsed,
                    promoFactionId: gameLicenses.grantedViaPromoFactionId,
                    nickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = game_licenses.user_id limit 1)`,
                })
                .from(gameLicenses)
                .innerJoin(games, eq(games.id, gameLicenses.gameId))
                .where(
                    and(
                        from ? gte(gameLicenses.purchasedAt, from) : undefined,
                        to ? lte(gameLicenses.purchasedAt, to) : undefined,
                        like
                            ? or(
                                ilike(gameLicenses.wallet, like),
                                ilike(games.title, like),
                                sql`exists (select 1 from game_nicknames n where n.user_id = game_licenses.user_id and n.nickname ilike ${like})`
                            )
                            : undefined
                    )
                )
                .orderBy(desc(gameLicenses.purchasedAt))
                .limit(fetchCap);

            for (const row of licenseRows) {
                const paid = !!row.tx;
                rows.push({
                    id: `game:${row.id}`,
                    kind: "game",
                    at: row.at.toISOString(),
                    label: row.gameTitle,
                    itemId: null,
                    quantity: 1,
                    buyerId: row.userId,
                    buyerWallet: row.wallet,
                    buyerNickname: row.nickname,
                    sellerWallet: null,
                    sellerNickname: null,
                    priceTnj: paid ? Number(row.price) || 0 : row.promoFactionId ? 0 : Number(row.price) || 0,
                    status: row.isActive ? (paid ? "completed" : row.promoFactionId ? "promo" : "granted") : "revoked",
                    note: row.promoCode ? `promo ${row.promoCode}` : paid ? null : "granted by admin",
                    tx: row.tx,
                });
            }
        }

        if (kinds.includes("shop")) {
            const shopRows = await db
                .select({
                    id: shopPurchases.id,
                    at: shopPurchases.createdAt,
                    itemId: shopPurchases.itemId,
                    quantity: shopPurchases.quantity,
                    priceTnj: shopPurchases.priceTnj,
                    tx: shopPurchases.txSignature,
                    status: shopPurchases.status,
                    failureReason: shopPurchases.failureReason,
                    wallet: shopPurchases.wallet,
                    userId: shopPurchases.userId,
                    nickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = shop_purchases.user_id limit 1)`,
                })
                .from(shopPurchases)
                .where(
                    and(
                        from ? gte(shopPurchases.createdAt, from) : undefined,
                        to ? lte(shopPurchases.createdAt, to) : undefined,
                        like
                            ? or(
                                ilike(shopPurchases.wallet, like),
                                ilike(shopPurchases.itemId, like),
                                ilike(shopPurchases.txSignature, like),
                                sql`exists (select 1 from game_nicknames n where n.user_id = shop_purchases.user_id and n.nickname ilike ${like})`
                            )
                            : undefined
                    )
                )
                .orderBy(desc(shopPurchases.createdAt))
                .limit(fetchCap);

            for (const row of shopRows) {
                rows.push({
                    id: `shop:${row.id}`,
                    kind: "shop",
                    at: row.at.toISOString(),
                    label: SHOP_CATALOG_BY_ID.get(row.itemId)?.name ?? row.itemId,
                    itemId: row.itemId,
                    quantity: row.quantity,
                    buyerId: row.userId,
                    buyerWallet: row.wallet,
                    buyerNickname: row.nickname,
                    sellerWallet: null,
                    sellerNickname: null,
                    priceTnj: Number(row.priceTnj) || 0,
                    status: row.status,
                    note: row.failureReason,
                    tx: row.tx,
                });
            }
        }

        if (kinds.includes("trade")) {
            const tradeRows = await db
                .select({
                    id: trades.id,
                    at: trades.createdAt,
                    itemId: trades.itemId,
                    itemName: trades.itemName,
                    quantity: trades.quantity,
                    priceTnj: trades.priceTnj,
                    tx: trades.txSignature,
                    status: trades.status,
                    failureReason: trades.failureReason,
                    buyerId: trades.buyerId,
                    buyerWallet: trades.buyerWallet,
                    sellerWallet: trades.sellerWallet,
                    buyerNickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = trades.buyer_id limit 1)`,
                    sellerNickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = trades.seller_id limit 1)`,
                })
                .from(trades)
                .where(
                    and(
                        from ? gte(trades.createdAt, from) : undefined,
                        to ? lte(trades.createdAt, to) : undefined,
                        like
                            ? or(
                                ilike(trades.buyerWallet, like),
                                ilike(trades.sellerWallet, like),
                                ilike(trades.itemName, like),
                                ilike(trades.txSignature, like)
                            )
                            : undefined
                    )
                )
                .orderBy(desc(trades.createdAt))
                .limit(fetchCap);

            for (const row of tradeRows) {
                rows.push({
                    id: `trade:${row.id}`,
                    kind: "trade",
                    at: row.at.toISOString(),
                    label: row.itemName || row.itemId,
                    itemId: row.itemId,
                    quantity: row.quantity,
                    buyerId: row.buyerId,
                    buyerWallet: row.buyerWallet,
                    buyerNickname: row.buyerNickname,
                    sellerWallet: row.sellerWallet,
                    sellerNickname: row.sellerNickname,
                    priceTnj: Number(row.priceTnj) || 0,
                    status: row.status,
                    note: row.failureReason,
                    tx: row.tx,
                });
            }
        }

        if (kinds.includes("marketplace")) {
            const marketRows = await db
                .select({
                    id: marketplacePurchases.id,
                    at: marketplacePurchases.createdAt,
                    amount: marketplacePurchases.amount,
                    tx: marketplacePurchases.txSignature,
                    status: marketplacePurchases.status,
                    wallet: marketplacePurchases.wallet,
                    userId: marketplacePurchases.userId,
                    lotName: marketplaceLots.name,
                    nickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = marketplace_purchases.user_id limit 1)`,
                })
                .from(marketplacePurchases)
                .leftJoin(marketplaceLots, eq(marketplaceLots.id, marketplacePurchases.lotId))
                .where(
                    and(
                        from ? gte(marketplacePurchases.createdAt, from) : undefined,
                        to ? lte(marketplacePurchases.createdAt, to) : undefined,
                        like ? or(ilike(marketplacePurchases.wallet, like), ilike(marketplacePurchases.txSignature, like)) : undefined
                    )
                )
                .orderBy(desc(marketplacePurchases.createdAt))
                .limit(fetchCap);

            for (const row of marketRows) {
                rows.push({
                    id: `marketplace:${row.id}`,
                    kind: "marketplace",
                    at: row.at.toISOString(),
                    label: row.lotName || "Marketplace lot",
                    itemId: null,
                    quantity: 1,
                    buyerId: row.userId,
                    buyerWallet: row.wallet,
                    buyerNickname: row.nickname,
                    sellerWallet: null,
                    sellerNickname: null,
                    priceTnj: Number(row.amount) || 0,
                    status: row.status,
                    note: null,
                    tx: row.tx,
                });
            }
        }

        if (kinds.includes("faction")) {
            const factionRows = await db
                .select({
                    id: factions.id,
                    name: factions.name,
                    number: factions.number,
                    founderWallet: factions.founderWallet,
                    founderUserId: factions.founderUserId,
                    createdAt: factions.createdAt,
                    creationTx: factions.creationTx,
                    promoCode: factions.promoCode,
                    promoTx: factions.promoCodePurchaseTx,
                    promoAt: factions.promoCodePurchasedAt,
                    nickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = factions.founder_user_id limit 1)`,
                })
                .from(factions)
                .where(like ? or(ilike(factions.name, like), ilike(factions.founderWallet, like)) : undefined)
                .orderBy(desc(factions.createdAt))
                .limit(fetchCap);

            const gateRows = await db
                .select({
                    id: factionGates.id,
                    factionId: factionGates.factionId,
                    purchaseTx: factionGates.purchaseTx,
                    purchasedAt: factionGates.purchasedAt,
                    factionName: factions.name,
                    founderWallet: factions.founderWallet,
                    nickname: sql<string | null>`(select n.nickname from game_nicknames n where n.user_id = factions.founder_user_id limit 1)`,
                })
                .from(factionGates)
                .innerJoin(factions, eq(factions.id, factionGates.factionId))
                .where(like ? or(ilike(factions.name, like), ilike(factions.founderWallet, like)) : undefined)
                .orderBy(desc(factionGates.purchasedAt))
                .limit(fetchCap);

            for (const row of factionRows) {
                rows.push({
                    id: `faction-create:${row.id}`,
                    kind: "faction",
                    at: row.createdAt.toISOString(),
                    label: `Faction creation — ${row.name} #${row.number}`,
                    itemId: "faction_creation",
                    quantity: 1,
                    buyerId: row.founderUserId,
                    buyerWallet: row.founderWallet,
                    buyerNickname: row.nickname,
                    sellerWallet: null,
                    sellerNickname: null,
                    priceTnj: null,
                    status: row.creationTx ? "completed" : "granted",
                    note: row.creationTx ? null : "created by admin",
                    tx: row.creationTx,
                });

                if (row.promoCode || row.promoTx) {
                    rows.push({
                        id: `faction-promo:${row.id}`,
                        kind: "faction",
                        at: (row.promoAt ?? row.createdAt).toISOString(),
                        label: `Promo code — ${row.name} #${row.number}`,
                        itemId: "faction_promo_code",
                        quantity: 1,
                        buyerId: row.founderUserId,
                        buyerWallet: row.founderWallet,
                        buyerNickname: row.nickname,
                        sellerWallet: null,
                        sellerNickname: null,
                        priceTnj: null,
                        status: row.promoTx ? "completed" : "granted",
                        note: row.promoCode ? `code ${row.promoCode}` : null,
                        tx: row.promoTx,
                    });
                }
            }

            for (const row of gateRows) {
                rows.push({
                    id: `faction-gate:${row.id}`,
                    kind: "faction",
                    at: row.purchasedAt.toISOString(),
                    label: `Token gate room — ${row.factionName}`,
                    itemId: "faction_gate",
                    quantity: 1,
                    buyerId: null,
                    buyerWallet: row.founderWallet,
                    buyerNickname: row.nickname,
                    sellerWallet: null,
                    sellerNickname: null,
                    priceTnj: null,
                    status: row.purchaseTx ? "completed" : "granted",
                    note: row.purchaseTx ? null : "granted by admin",
                    tx: row.purchaseTx,
                });
            }
        }

        const filtered = rows
            .filter((row) => matchesText(row, needle))
            .filter((row) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "completed") return row.status === "completed";
                if (statusFilter === "free") return row.status === "promo" || row.status === "granted";
                if (statusFilter === "failed") return row.status !== "completed" && row.status !== "promo" && row.status !== "granted";
                return true;
            })
            .filter((row) => {
                if (!from && !to) return true;
                const at = new Date(row.at).getTime();
                if (from && at < from.getTime()) return false;
                if (to && at > to.getTime()) return false;
                return true;
            })
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        const totals = { count: filtered.length, tnj: 0, paidCount: 0, freeCount: 0, failedCount: 0 };
        const byKind: Record<string, { count: number; tnj: number }> = {};

        for (const row of filtered) {
            const bucket = (byKind[row.kind] ||= { count: 0, tnj: 0 });
            bucket.count += 1;
            if (row.status === "completed" && row.priceTnj) {
                totals.tnj += row.priceTnj;
                bucket.tnj += row.priceTnj;
            }
            if (row.status === "completed") totals.paidCount += 1;
            else if (row.status === "promo" || row.status === "granted") totals.freeCount += 1;
            else totals.failedCount += 1;
        }

        return NextResponse.json({
            rows: filtered.slice(offset, offset + limit),
            totals,
            byKind,
            hasMore: filtered.length > offset + limit,
        });
    } catch (error) {
        console.error("[admin/purchases] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
