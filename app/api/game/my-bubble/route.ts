// app/api/game/my-bubble/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";

export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const [row] = await db
            .select({ number: users.number })
            .from(users)
            .where(eq(users.id, authResult.user.userId))
            .limit(1);

        if (!row?.number) {
            return NextResponse.json({ bubbleIndex: null });
        }

        return NextResponse.json({ bubbleIndex: row.number - 1 });
    } catch (error) {
        console.error("[game/my-bubble] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
