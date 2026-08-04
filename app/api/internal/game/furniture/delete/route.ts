// app/api/internal/game/furniture/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { placedFurniture } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { itemId, userId } = body;

        if (!itemId || !userId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [item] = await db
            .delete(placedFurniture)
            .where(and(eq(placedFurniture.id, itemId), eq(placedFurniture.userId, userId)))
            .returning();

        if (!item) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/furniture/delete] Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
