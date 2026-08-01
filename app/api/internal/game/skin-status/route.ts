// app/api/internal/game/skin-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameProgress } from "@/core/database/schema";
import { inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userIds } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ statuses: [] });
        }

        const rows = await db
            .select({ userId: gameProgress.userId, data: gameProgress.data })
            .from(gameProgress)
            .where(inArray(gameProgress.userId, userIds.slice(0, 500)));

        const statuses = rows.map((row) => {
            let skinTextureUrl: string | null = null;
            if (row.data) {
                try {
                    const parsed = JSON.parse(row.data);
                    skinTextureUrl = typeof parsed?.skinTextureUrl === "string" ? parsed.skinTextureUrl : null;
                } catch {
                    skinTextureUrl = null;
                }
            }
            return { id: row.userId, skinTextureUrl };
        });

        return NextResponse.json({ statuses });
    } catch (error) {
        console.error("[internal/skin-status] Error:", error);
        return NextResponse.json({ statuses: [] }, { status: 500 });
    }
}
