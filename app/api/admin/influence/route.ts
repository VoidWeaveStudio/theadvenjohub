// app/api/admin/influence/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { getInfluenceState, mergeInfluenceState, InfluenceCommand } from "@/core/lib/influenceState";
import { db } from "@/core/database";
import { influenceEntries } from "@/core/database/schema";
import { desc, eq } from "drizzle-orm";

const ACTIONS: InfluenceCommand["type"][] = ["spawn_breach", "close_breach", "reset_point", "force_siege"];

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const state = await getInfluenceState();

    const entries = await db
        .select({
            id: influenceEntries.id,
            wallet: influenceEntries.wallet,
            currency: influenceEntries.currency,
            amount: influenceEntries.amount,
            credited: influenceEntries.credited,
            createdAt: influenceEntries.createdAt,
        })
        .from(influenceEntries)
        .orderBy(desc(influenceEntries.createdAt))
        .limit(25);

    return NextResponse.json({ state, entries });
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const action = body?.action as InfluenceCommand["type"];

        if (!ACTIONS.includes(action)) {
            return NextResponse.json({ error: "unknown_action" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, `influence_${action}`, "global");
        if (sigError) return sigError;

        const command: InfluenceCommand = { id: randomUUID(), type: action };
        const state = await mergeInfluenceState({ command });

        return NextResponse.json({ success: true, state });
    } catch (error) {
        console.error("[admin/influence] Error:", error);
        return NextResponse.json({ error: "influence_update_failed" }, { status: 500 });
    }
}
