// app/api/admin/players/[userId]/cosmetics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import { db } from "@/core/database";
import { gameCosmetics } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { adjustCosmeticWallet, readCosmeticCrateState } from "@/core/lib/cosmeticCrates";
import { isCosmeticId } from "@/features/game/data/cosmetics";

const SCOPES = ["cosmetic", "fragments", "crates"] as const;
type Scope = (typeof SCOPES)[number];

function actionNameFor(scope: Scope, delta: number): string {
    if (scope === "cosmetic") return delta > 0 ? "grantCosmetic" : "takeCosmetic";
    if (scope === "fragments") return delta > 0 ? "grantCosmeticFragments" : "takeCosmeticFragments";
    return delta > 0 ? "grantCosmeticCrates" : "takeCosmeticCrates";
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
        const delta = Math.trunc(Number(body.delta));

        if (!Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
        }
        if (scope === "cosmetic" && !isCosmeticId(itemId)) {
            return NextResponse.json({ error: "unknown_cosmetic" }, { status: 400 });
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

        if (scope === "cosmetic") {
            if (delta > 0) {
                const inserted = await db
                    .insert(gameCosmetics)
                    .values({ userId, gameId, itemId, pricePaidAsh: 0 })
                    .onConflictDoNothing()
                    .returning({ id: gameCosmetics.id });
                applied = inserted.length > 0;
            } else {
                const removed = await db
                    .delete(gameCosmetics)
                    .where(and(
                        eq(gameCosmetics.userId, userId),
                        eq(gameCosmetics.gameId, gameId),
                        eq(gameCosmetics.itemId, itemId)
                    ))
                    .returning({ id: gameCosmetics.id });
                applied = removed.length > 0;
            }
        } else if (scope === "fragments") {
            applied = await adjustCosmeticWallet(userId, gameId, delta, 0);
        } else {
            applied = await adjustCosmeticWallet(userId, gameId, 0, delta);
        }

        if (!applied) {
            return NextResponse.json(
                { error: "not_applied", cosmeticCrates: await readCosmeticCrateState(userId, gameId) },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            cosmeticCrates: await readCosmeticCrateState(userId, gameId),
        });
    } catch (error) {
        console.error("[admin/players/:userId/cosmetics] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
