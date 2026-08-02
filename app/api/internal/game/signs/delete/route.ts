// app/api/internal/game/signs/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameSigns } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { signId, userId } = body;

        if (!signId || !userId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [sign] = await db
            .delete(gameSigns)
            .where(and(eq(gameSigns.id, signId), eq(gameSigns.userId, userId)))
            .returning();

        if (!sign) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/signs/delete] Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
