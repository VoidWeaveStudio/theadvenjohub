// app/api/internal/game/presence/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, online } = body;

        if (!userId || typeof online !== "boolean") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .update(users)
            .set({ isOnline: online, lastSeenAt: new Date() })
            .where(eq(users.id, userId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/presence] Error:", error);
        return NextResponse.json({ error: "presence_failed" }, { status: 500 });
    }
}
