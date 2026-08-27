// app/api/admin/players/[userId]/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import {
    GRANT_SCOPES,
    WIPE_SCOPES,
    GrantScope,
    WipeScope,
    grantEverything,
    wipeEverything,
    resolveWallet,
} from "@/core/lib/adminGrants";
import { MAX_LEVEL } from "@/features/game/data/progression";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const mode = body.mode === "wipe" ? "wipe" : body.mode === "grant" ? "grant" : null;

        if (!mode) {
            return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
        }

        const requested: string[] = Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string") : [];
        if (requested.length === 0) {
            return NextResponse.json({ error: "no_scopes" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, mode === "grant" ? "bulkGrant" : "bulkWipe", userId);
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        if (mode === "wipe") {
            const scopes = requested.filter((s): s is WipeScope => (WIPE_SCOPES as readonly string[]).includes(s));
            if (scopes.length === 0) return NextResponse.json({ error: "no_scopes" }, { status: 400 });

            const result = await wipeEverything(userId, gameId, scopes);
            return NextResponse.json({ success: true, ...result });
        }

        const wallet = await resolveWallet(userId);
        if (!wallet) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const scopes = requested.filter((s): s is GrantScope => (GRANT_SCOPES as readonly string[]).includes(s));
        if (scopes.length === 0) return NextResponse.json({ error: "no_scopes" }, { status: 400 });

        const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(body.level) || MAX_LEVEL)));
        const result = await grantEverything(userId, gameId, wallet, {
            scopes,
            ash: Math.max(0, Math.floor(Number(body.ash) || 0)),
            level,
            crates: Math.max(0, Math.floor(Number(body.crates) || 0)),
            fragments: Math.max(0, Math.floor(Number(body.fragments) || 0)),
            stackQuantity: Math.max(1, Math.floor(Number(body.stackQuantity) || 1)),
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[admin/players/:userId/bulk] Error:", error);
        return NextResponse.json({ error: "bulk_failed" }, { status: 500 });
    }
}
