// app/api/internal/game/signs/set-content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameSigns } from "@/core/database/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { signId, userId, contentType, textContent, drawingUrl } = body;

        if (!signId || !userId || (contentType !== "text" && contentType !== "draw")) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [sign] = await db
            .update(gameSigns)
            .set({
                contentType,
                textContent: contentType === "text" ? String(textContent || "").slice(0, 200) : null,
                drawingUrl: contentType === "draw" ? String(drawingUrl || "").slice(0, 512) : null,
                contentSetAt: new Date(),
            })
            .where(and(eq(gameSigns.id, signId), eq(gameSigns.userId, userId), isNull(gameSigns.contentType)))
            .returning();

        if (!sign) {
            return NextResponse.json({ error: "not_found_or_locked" }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/signs/set-content] Error:", error);
        return NextResponse.json({ error: "set_content_failed" }, { status: 500 });
    }
}
