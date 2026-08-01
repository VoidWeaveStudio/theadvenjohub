// app/api/internal/game/nickname/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameNicknames } from "@/core/database/schema";
import { eq, and, ne, ilike } from "drizzle-orm";

async function isTaken(gameId: string, userId: string, nickname: string): Promise<boolean> {
    const existing = await db.query.gameNicknames.findFirst({
        where: and(
            eq(gameNicknames.gameId, gameId),
            ne(gameNicknames.userId, userId),
            ilike(gameNicknames.nickname, nickname)
        ),
    });
    return !!existing;
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, nickname, allowSuffix } = body;

        if (!userId || !gameId || typeof nickname !== "string" || nickname.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        let finalNickname = nickname.trim().slice(0, 30);

        if (await isTaken(gameId, userId, finalNickname)) {
            if (!allowSuffix) {
                return NextResponse.json({ error: "nickname_taken" }, { status: 409 });
            }
            let suffix = 1;
            let candidate = `${finalNickname}${suffix}`.slice(0, 30);
            while (await isTaken(gameId, userId, candidate)) {
                suffix++;
                candidate = `${finalNickname}${suffix}`.slice(0, 30);
            }
            finalNickname = candidate;
        }

        await db
            .insert(gameNicknames)
            .values({ userId, gameId, nickname: finalNickname, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: [gameNicknames.userId, gameNicknames.gameId],
                set: { nickname: finalNickname, updatedAt: new Date() },
            });

        return NextResponse.json({ success: true, nickname: finalNickname });
    } catch (error: any) {
        if (error?.code === "23505") {
            return NextResponse.json({ error: "nickname_taken" }, { status: 409 });
        }
        console.error("[internal/nickname/set] Error:", error);
        return NextResponse.json({ error: "set_failed" }, { status: 500 });
    }
}
