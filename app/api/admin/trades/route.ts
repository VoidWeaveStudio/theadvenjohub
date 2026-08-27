// app/api/admin/trades/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { trades, gameNicknames } from "@/core/database/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const status = searchParams.get("status") || "all";
        const page = Math.max(1, Number(searchParams.get("page")) || 1);
        const limit = 100;

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
                txSignature: trades.txSignature,
                status: trades.status,
                failureReason: trades.failureReason,
                createdAt: trades.createdAt,
            })
            .from(trades)
            .leftJoin(sellerNick, and(eq(sellerNick.userId, trades.sellerId), eq(sellerNick.gameId, trades.gameId)))
            .leftJoin(buyerNick, and(eq(buyerNick.userId, trades.buyerId), eq(buyerNick.gameId, trades.gameId)))
            .where(and(
                query ? or(
                    ilike(sellerNick.nickname, `%${query}%`),
                    ilike(buyerNick.nickname, `%${query}%`),
                    ilike(trades.sellerWallet, `%${query}%`),
                    ilike(trades.buyerWallet, `%${query}%`),
                    ilike(trades.itemName, `%${query}%`),
                    ilike(trades.txSignature, `%${query}%`)
                ) : undefined,
                status === "completed" ? eq(trades.status, "completed") : undefined,
                status === "failed" ? ne(trades.status, "completed") : undefined
            ))
            .orderBy(desc(trades.createdAt))
            .limit(limit)
            .offset((page - 1) * limit);

        return NextResponse.json({ trades: rows, page });
    } catch (error) {
        console.error("[admin/trades] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
