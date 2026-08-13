// app/api/internal/game/player-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameProgress, users } from "@/core/database/schema";
import { inArray } from "drizzle-orm";

interface PlayerStatus {
    id: string;
    mutedUntil: Date | null;
    isBanned: boolean;
    skinTextureUrl: string | null;
    ash: number;
    placeables: Record<string, number>;
}

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

        const ids = userIds.slice(0, 500);

        const [accountRows, progressRows] = await Promise.all([
            db
                .select({ id: users.id, mutedUntil: users.mutedUntil, isBanned: users.isBanned })
                .from(users)
                .where(inArray(users.id, ids)),
            db
                .select({ userId: gameProgress.userId, data: gameProgress.data })
                .from(gameProgress)
                .where(inArray(gameProgress.userId, ids)),
        ]);

        const progressByUserId = new Map(progressRows.map((row) => [row.userId, row.data]));

        const statuses: PlayerStatus[] = accountRows.map((account) => {
            let skinTextureUrl: string | null = null;
            let ash = 0;
            let placeables: Record<string, number> = {};

            const raw = progressByUserId.get(account.id);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    skinTextureUrl = typeof parsed?.skinTextureUrl === "string" ? parsed.skinTextureUrl : null;
                    ash = Math.max(0, Math.floor(Number(parsed?.ash) || 0));
                    if (parsed?.placeables && typeof parsed.placeables === "object") {
                        placeables = parsed.placeables;
                    }
                } catch {
                    skinTextureUrl = null;
                    ash = 0;
                    placeables = {};
                }
            }

            return {
                id: account.id,
                mutedUntil: account.mutedUntil,
                isBanned: account.isBanned,
                skinTextureUrl,
                ash,
                placeables,
            };
        });

        return NextResponse.json({ statuses });
    } catch (error) {
        console.error("[internal/player-status] Error:", error);
        return NextResponse.json({ statuses: [] }, { status: 500 });
    }
}
