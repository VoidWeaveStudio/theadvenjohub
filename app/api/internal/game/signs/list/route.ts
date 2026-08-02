// app/api/internal/game/signs/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameSigns, gameNicknames } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId } = body;

        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const rows = await db
            .select({
                id: gameSigns.id,
                userId: gameSigns.userId,
                positionX: gameSigns.positionX,
                positionY: gameSigns.positionY,
                positionZ: gameSigns.positionZ,
                rotation: gameSigns.rotation,
                contentType: gameSigns.contentType,
                textContent: gameSigns.textContent,
                drawingUrl: gameSigns.drawingUrl,
                createdAt: gameSigns.createdAt,
                ownerNickname: gameNicknames.nickname,
            })
            .from(gameSigns)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, gameSigns.userId), eq(gameNicknames.gameId, gameSigns.gameId))
            )
            .where(and(eq(gameSigns.gameId, gameId), eq(gameSigns.locationId, "main-world")));

        return NextResponse.json({
            success: true,
            signs: rows.map((r) => ({
                id: r.id,
                ownerId: r.userId,
                ownerNickname: r.ownerNickname || "Unnamed",
                position: [Number(r.positionX), Number(r.positionY), Number(r.positionZ)],
                rotation: Number(r.rotation),
                contentType: r.contentType,
                textContent: r.textContent,
                drawingUrl: r.drawingUrl,
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        console.error("[internal/signs/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
