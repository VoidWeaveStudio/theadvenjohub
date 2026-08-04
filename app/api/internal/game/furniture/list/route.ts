// app/api/internal/game/furniture/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { placedFurniture, gameNicknames } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { factionId } = body;

        if (!factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const rows = await db
            .select({
                id: placedFurniture.id,
                userId: placedFurniture.userId,
                itemId: placedFurniture.itemId,
                positionX: placedFurniture.positionX,
                positionY: placedFurniture.positionY,
                positionZ: placedFurniture.positionZ,
                rotation: placedFurniture.rotation,
                contentType: placedFurniture.contentType,
                textContent: placedFurniture.textContent,
                drawingUrl: placedFurniture.drawingUrl,
                createdAt: placedFurniture.createdAt,
                ownerNickname: gameNicknames.nickname,
            })
            .from(placedFurniture)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, placedFurniture.userId), eq(gameNicknames.gameId, placedFurniture.gameId))
            )
            .where(eq(placedFurniture.factionId, factionId));

        return NextResponse.json({
            success: true,
            items: rows.map((r) => ({
                id: r.id,
                itemId: r.itemId,
                ownerId: r.userId,
                ownerNickname: r.ownerNickname || "Unnamed",
                factionId,
                position: [Number(r.positionX), Number(r.positionY), Number(r.positionZ)],
                rotation: Number(r.rotation),
                contentType: r.contentType,
                textContent: r.textContent,
                drawingUrl: r.drawingUrl,
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        console.error("[internal/furniture/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
