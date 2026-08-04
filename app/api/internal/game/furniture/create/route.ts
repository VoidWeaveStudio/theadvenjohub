// app/api/internal/game/furniture/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { placedFurniture } from "@/core/database/schema";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, factionId, itemId, position, rotation } = body;

        if (!userId || !gameId || !factionId || !itemId || !Array.isArray(position) || position.length !== 3) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [item] = await db
            .insert(placedFurniture)
            .values({
                userId,
                gameId,
                factionId,
                itemId: String(itemId).slice(0, 50),
                positionX: String(position[0]),
                positionY: String(position[1]),
                positionZ: String(position[2]),
                rotation: String(rotation ?? 0),
            })
            .returning();

        return NextResponse.json({ success: true, id: item.id, createdAt: item.createdAt });
    } catch (error) {
        console.error("[internal/furniture/create] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
