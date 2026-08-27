// app/api/admin/support/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { supportTickets, gameNicknames } from "@/core/database/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const status = searchParams.get("status");

        const rows = await db
            .select({
                id: supportTickets.id,
                userId: supportTickets.userId,
                wallet: supportTickets.wallet,
                subject: supportTickets.subject,
                message: supportTickets.message,
                status: supportTickets.status,
                reply: supportTickets.reply,
                repliedAt: supportTickets.repliedAt,
                createdAt: supportTickets.createdAt,
                nickname: gameNicknames.nickname,
            })
            .from(supportTickets)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, supportTickets.userId), eq(gameNicknames.gameId, supportTickets.gameId))
            )
            .where(and(
                status && status !== "all" ? eq(supportTickets.status, status) : undefined,
                query
                    ? or(
                        ilike(supportTickets.wallet, `%${query}%`),
                        ilike(supportTickets.subject, `%${query}%`),
                        ilike(supportTickets.message, `%${query}%`),
                        ilike(gameNicknames.nickname, `%${query}%`)
                    )
                    : undefined
            ))
            .orderBy(desc(supportTickets.status), desc(supportTickets.createdAt))
            .limit(300);

        return NextResponse.json({ tickets: rows });
    } catch (error) {
        console.error("[admin/support] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
