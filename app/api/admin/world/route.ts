// app/api/admin/world/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { getWorldState, mergeWorldState, WorldCommand } from "@/core/lib/worldState";

const MAX_TIER = 8;

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const state = await getWorldState();
    return NextResponse.json({ state });
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const action = body?.action;

        if (action !== "force_portal" && action !== "set_tier" && action !== "clear_tier") {
            return NextResponse.json({ error: "unknown_action" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, `world_${action}`, "global");
        if (sigError) return sigError;

        let tier: number | null = null;
        if (action === "set_tier") {
            const parsed = Math.floor(Number(body.tier));
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_TIER) {
                return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
            }
            tier = parsed;
        }

        const command: WorldCommand = { id: randomUUID(), type: action, tier };
        const state = await mergeWorldState({ command });

        return NextResponse.json({ success: true, state });
    } catch (error) {
        console.error("[admin/world] Error:", error);
        return NextResponse.json({ error: "world_update_failed" }, { status: 500 });
    }
}
