// app/api/admin/players/[userId]/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import { applyCatalogItem, resolveGrantableKind } from "@/core/lib/adminGrants";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
        const delta = Math.trunc(Number(body.delta));

        const kind = resolveGrantableKind(itemId);
        if (!kind) {
            return NextResponse.json({ error: "unknown_item" }, { status: 400 });
        }
        if (!Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(
            req,
            body,
            delta > 0 ? "grantCatalogItem" : "takeCatalogItem",
            `${userId}:${itemId}`
        );
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const effective = kind === "cosmetic" ? (delta > 0 ? 1 : -1) : delta;
        const result = await applyCatalogItem(userId, gameId, itemId, effective);

        if (!result.ok) {
            return NextResponse.json({ error: result.reason || "not_applied" }, { status: 409 });
        }

        return NextResponse.json({ success: true, itemId, applied: effective, mode: result.mode ?? "db" });
    } catch (error) {
        console.error("[admin/players/:userId/grant] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
