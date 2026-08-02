// app/api/admin/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { chatMessages, factions } from "@/core/database/schema";
import { desc, eq, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const page = Math.max(1, Number(searchParams.get("page")) || 1);
        const limit = 100;

        const rows = await db
            .select({
                id: chatMessages.id,
                senderUserId: chatMessages.senderUserId,
                senderWallet: chatMessages.senderWallet,
                senderNickname: chatMessages.senderNickname,
                factionId: chatMessages.factionId,
                factionName: factions.name,
                factionSymbol: factions.symbol,
                message: chatMessages.message,
                createdAt: chatMessages.createdAt,
                deletedAt: chatMessages.deletedAt,
                deletedByAdminWallet: chatMessages.deletedByAdminWallet,
            })
            .from(chatMessages)
            .leftJoin(factions, eq(factions.id, chatMessages.factionId))
            .where(query ? or(
                ilike(chatMessages.senderNickname, `%${query}%`),
                ilike(chatMessages.senderWallet, `%${query}%`),
                ilike(chatMessages.message, `%${query}%`)
            ) : undefined)
            .orderBy(desc(chatMessages.createdAt))
            .limit(limit)
            .offset((page - 1) * limit);

        return NextResponse.json({ messages: rows, page });
    } catch (error) {
        console.error("[admin/chat] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
