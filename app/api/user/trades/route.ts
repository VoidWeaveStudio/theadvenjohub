// app/api/user/trades/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";
import { db } from "@/core/database";
import { trades, gameNicknames } from "@/core/database/schema";
import { alias } from "drizzle-orm/pg-core";
import { eq, and, or, desc } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
    try {
        const authResult = await requireAuth(req);
        if (authResult instanceof NextResponse) {
            return authResult;
        }
        const { user } = authResult;

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE)));
        const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), 100);
        const offset = (page - 1) * limit;

        const sellerNick = alias(gameNicknames, "seller_nick");
        const buyerNick = alias(gameNicknames, "buyer_nick");

        const rows = await db
            .select({
                id: trades.id,
                sellerId: trades.sellerId,
                sellerWallet: trades.sellerWallet,
                sellerNickname: sellerNick.nickname,
                buyerId: trades.buyerId,
                buyerWallet: trades.buyerWallet,
                buyerNickname: buyerNick.nickname,
                itemId: trades.itemId,
                itemName: trades.itemName,
                quantity: trades.quantity,
                priceTnj: trades.priceTnj,
                status: trades.status,
                failureReason: trades.failureReason,
                createdAt: trades.createdAt,
            })
            .from(trades)
            .leftJoin(sellerNick, and(eq(sellerNick.userId, trades.sellerId), eq(sellerNick.gameId, trades.gameId)))
            .leftJoin(buyerNick, and(eq(buyerNick.userId, trades.buyerId), eq(buyerNick.gameId, trades.gameId)))
            .where(or(eq(trades.sellerId, user.userId), eq(trades.buyerId, user.userId)))
            .orderBy(desc(trades.createdAt))
            .limit(limit)
            .offset(offset);

        const items = rows.map((row) => {
            const role: "bought" | "sold" = row.buyerId === user.userId ? "bought" : "sold";
            return {
                id: row.id,
                role,
                counterpartyWallet: role === "bought" ? row.sellerWallet : row.buyerWallet,
                counterpartyNickname: role === "bought" ? row.sellerNickname : row.buyerNickname,
                itemId: row.itemId,
                itemName: row.itemName,
                quantity: row.quantity,
                priceTnj: row.priceTnj,
                status: row.status,
                failureReason: row.failureReason,
                createdAt: row.createdAt,
            };
        });

        return NextResponse.json({
            trades: items,
            pagination: { page, limit, hasMore: rows.length === limit },
        });
    } catch (error) {
        console.error("[user/trades] Error:", error);
        return NextResponse.json({ error: "failed_to_load_trades" }, { status: 500 });
    }
}
