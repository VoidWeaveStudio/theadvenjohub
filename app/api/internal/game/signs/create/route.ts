// app/api/internal/game/signs/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameSigns } from "@/core/database/schema";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, position, rotation } = body;

        if (!userId || !gameId || !Array.isArray(position) || position.length !== 3) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [sign] = await db
            .insert(gameSigns)
            .values({
                userId,
                gameId,
                locationId: "main-world",
                positionX: String(position[0]),
                positionY: String(position[1]),
                positionZ: String(position[2]),
                rotation: String(rotation ?? 0),
            })
            .returning();

        return NextResponse.json({ success: true, id: sign.id, createdAt: sign.createdAt });
    } catch (error) {
        console.error("[internal/signs/create] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
