// app/api/admin/players/[userId]/companions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import {
    adjustCompanion,
    adjustWallet,
    equipCompanion,
    readCompanionState,
} from "@/core/lib/companionInventory";
import { isCompanionId } from "@/features/game/data/companions";

const SCOPES = ["companion", "fragments", "crates", "equip"] as const;
type Scope = (typeof SCOPES)[number];

function actionNameFor(scope: Scope, delta: number): string {
    if (scope === "equip") return "setCompanion";
    if (scope === "companion") return delta > 0 ? "grantCompanion" : "takeCompanion";
    if (scope === "fragments") return delta > 0 ? "grantFragments" : "takeFragments";
    return delta > 0 ? "grantCrates" : "takeCrates";
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();

        const scope = SCOPES.includes(body.scope) ? (body.scope as Scope) : null;
        if (!scope) {
            return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
        }

        const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
        const delta = scope === "equip" ? 0 : Math.trunc(Number(body.delta));

        if (scope !== "equip" && (!Number.isFinite(delta) || delta === 0)) {
            return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
        }
        if ((scope === "companion" || scope === "equip") && itemId && !isCompanionId(itemId)) {
            return NextResponse.json({ error: "unknown_companion" }, { status: 400 });
        }
        if (scope === "companion" && !itemId) {
            return NextResponse.json({ error: "unknown_companion" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(
            req,
            body,
            actionNameFor(scope, delta),
            `${userId}:${scope}:${itemId}`
        );
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        let applied = false;
        if (scope === "companion") {
            applied = await adjustCompanion(userId, gameId, itemId, delta);
        } else if (scope === "fragments") {
            applied = await adjustWallet(userId, gameId, delta, 0);
        } else if (scope === "crates") {
            applied = await adjustWallet(userId, gameId, 0, delta);
        } else {
            const result = await equipCompanion(userId, gameId, itemId || null);
            applied = result.ok;
        }

        if (!applied) {
            return NextResponse.json(
                { error: "not_enough", companions: await readCompanionState(userId, gameId) },
                { status: 409 }
            );
        }

        return NextResponse.json({ success: true, companions: await readCompanionState(userId, gameId) });
    } catch (error) {
        console.error("[admin/players/:userId/companions] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
