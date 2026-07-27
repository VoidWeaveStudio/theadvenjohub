// app/api/internal/game/faction/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db.delete(factionMembers).where(
            and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId))
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/faction/leave] Error:", error);
        return NextResponse.json({ error: "leave_failed" }, { status: 500 });
    }
}
