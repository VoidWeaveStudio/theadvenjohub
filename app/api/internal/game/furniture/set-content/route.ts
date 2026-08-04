// app/api/internal/game/furniture/set-content/route.ts
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
        const { itemId, userId, contentType, textContent, drawingUrl } = body;

        if (!itemId || !userId || (contentType !== "text" && contentType !== "draw")) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        // Unlike signs (paint-once, isNull(contentType) guard), furniture is
        // repaintable — it's the owner's own piece in their own room, not a
        // one-shot public message board.
        const [item] = await db
            .update(placedFurniture)
            .set({
                contentType,
                textContent: contentType === "text" ? String(textContent || "").slice(0, 200) : null,
                drawingUrl: contentType === "draw" ? String(drawingUrl || "").slice(0, 512) : null,
                contentSetAt: new Date(),
            })
            .where(and(eq(placedFurniture.id, itemId), eq(placedFurniture.userId, userId)))
            .returning();

        if (!item) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/furniture/set-content] Error:", error);
        return NextResponse.json({ error: "set_content_failed" }, { status: 500 });
    }
}
