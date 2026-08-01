// app/api/internal/game/mute-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userIds } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ statuses: [] });
        }

        const rows = await db
            .select({ id: users.id, mutedUntil: users.mutedUntil, isBanned: users.isBanned })
            .from(users)
            .where(inArray(users.id, userIds.slice(0, 500)));

        return NextResponse.json({ statuses: rows });
    } catch (error) {
        console.error("[internal/mute-status] Error:", error);
        return NextResponse.json({ statuses: [] }, { status: 500 });
    }
}
