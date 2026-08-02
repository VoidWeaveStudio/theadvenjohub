// app/api/internal/game/economy-status/route.ts
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
            .select({ userId: gameProgress.userId, data: gameProgress.data, updatedAt: gameProgress.updatedAt })
            .from(gameProgress)
            .where(inArray(gameProgress.userId, userIds.slice(0, 500)));

        const statuses = rows.map((row) => {
            let ash = 0;
            let placeables: Record<string, number> = {};
            if (row.data) {
                try {
                    const parsed = JSON.parse(row.data);
                    ash = Math.max(0, Math.floor(Number(parsed?.ash) || 0));
                    if (parsed?.placeables && typeof parsed.placeables === "object") {
                        placeables = parsed.placeables;
                    }
                } catch {
                    ash = 0;
                    placeables = {};
                }
            }
            return { id: row.userId, ash, placeables, updatedAt: row.updatedAt };
        });

        return NextResponse.json({ statuses });
    } catch (error) {
        console.error("[internal/economy-status] Error:", error);
        return NextResponse.json({ statuses: [] }, { status: 500 });
    }
}
