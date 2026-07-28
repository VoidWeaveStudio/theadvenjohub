// app/api/internal/game/faction/task-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { factionId, taskKey, progress } = body;

        if (!factionId || typeof taskKey !== "string" || !Number.isInteger(progress) || progress < 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .update(factions)
            .set({ activeTaskProgress: progress })
            .where(and(eq(factions.id, factionId), eq(factions.activeTaskKey, taskKey)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/faction/task-progress] Error:", error);
        return NextResponse.json({ error: "progress_failed" }, { status: 500 });
    }
}
