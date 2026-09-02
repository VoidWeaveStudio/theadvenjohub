// app/api/game/shop/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { gameProgress, shopPurchases, gameCompanions, gameCosmetics, gameMemeWallet, gameCosmeticWallet } from "@/core/database/schema";
import { and, count, eq, gt } from "drizzle-orm";
import { adjustCompanion, adjustWallet, seedLegacyDog } from "@/core/lib/companionInventory";
import { adjustCosmeticWallet } from "@/core/lib/cosmeticCrates";
import { DEFAULT_COMPANION_ID } from "@/features/game/data/companions";
import { COSMETIC_CRATE_ITEM_ID } from "@/features/game/data/cosmetics";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { claimSignature } from "@/core/lib/paymentLock";
import { SHOP_CATALOG_BY_ID } from "@/core/lib/shopCatalog";
import { requiredTnjForItem, resolveGameId } from "@/core/lib/shopPricing";
import { applyLiveOps } from "@/core/lib/adminLiveSync";

const purchaseSchema = z.object({
    signature: z.string().min(80).max(100),
    itemId: z.string().min(1).max(60),
    gameSlug: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req);

        const rl = await checkRateLimit(`game:shop:purchase:${ip}`, {
            maxAttempts: 5,
            windowMs: 60_000,
            prefix: "api:game:shop:purchase",
        });
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "too_many_attempts" },
                { status: 429, headers: formatRateLimitHeaders(rl) }
            );
        }

        const authResult = await requireAuth(req);
        if (authResult instanceof NextResponse) return authResult;
        const { user } = authResult;

        if (!verifyCSRF(req)) {
            return NextResponse.json(
                { error: "invalid_csrf_token" },
                { status: 403, headers: formatRateLimitHeaders(rl) }
            );
        }

        const body = await req.json();
        const validation = purchaseSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "validation_failed", details: validation.error.flatten() },
                { status: 400, headers: formatRateLimitHeaders(rl) }
            );
        }
        const { signature, itemId, gameSlug } = validation.data;

        const entry = SHOP_CATALOG_BY_ID.get(itemId);
        if (!entry || entry.kind === "faction") {
            return NextResponse.json(
                { error: "unknown_item" },
                { status: 404, headers: formatRateLimitHeaders(rl) }
            );
        }

        const gameId = await resolveGameId(gameSlug ?? null);
        if (!gameId) {
            return NextResponse.json(
                { error: "game_not_found" },
                { status: 404, headers: formatRateLimitHeaders(rl) }
            );
        }

        const pricing = await requiredTnjForItem(gameId, itemId);
        if (!pricing.ok) {
            return NextResponse.json(
                { error: pricing.error },
                { status: pricing.status, headers: formatRateLimitHeaders(rl) }
            );
        }
        if (pricing.price.currency === "ash") {
            return NextResponse.json(
                { error: "not_for_sale" },
                { status: 403, headers: formatRateLimitHeaders(rl) }
            );
        }

        const progress = await db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, user.userId) });
        if (!progress) {
            return NextResponse.json(
                { error: "no_progress" },
                { status: 404, headers: formatRateLimitHeaders(rl) }
            );
        }

        let data: Record<string, any> = {};
        if (progress.data) {
            try {
                data = JSON.parse(progress.data);
            } catch {
                data = {};
            }
        }
        const placeables: Record<string, number> =
            data.placeables && typeof data.placeables === "object" ? data.placeables : {};

        let owned = 0;
        if (entry.kind === "companion") {
            const stack = await db.query.gameCompanions.findFirst({
                where: and(
                    eq(gameCompanions.userId, user.userId),
                    eq(gameCompanions.gameId, gameId),
                    eq(gameCompanions.itemId, itemId)
                ),
            });
            owned = Math.max(0, stack?.quantity ?? 0);
        } else if (entry.kind === "lootbox") {
            if (itemId === COSMETIC_CRATE_ITEM_ID) {
                const wallet = await db.query.gameCosmeticWallet.findFirst({
                    where: and(eq(gameCosmeticWallet.userId, user.userId), eq(gameCosmeticWallet.gameId, gameId)),
                });
                owned = Math.max(0, wallet?.crates ?? 0);
            } else {
                const wallet = await db.query.gameMemeWallet.findFirst({
                    where: and(eq(gameMemeWallet.userId, user.userId), eq(gameMemeWallet.gameId, gameId)),
                });
                owned = Math.max(0, wallet?.crates ?? 0);
            }
        } else if (entry.kind === "cosmetic") {
            const cosmetic = await db.query.gameCosmetics.findFirst({
                where: and(
                    eq(gameCosmetics.userId, user.userId),
                    eq(gameCosmetics.gameId, gameId),
                    eq(gameCosmetics.itemId, itemId)
                ),
            });
            owned = cosmetic ? 1 : 0;
        } else {
            // The blob is only as fresh as the game server's last save, and while
            // the player is in a session that can be a while. Purchases recorded
            // since then have not reached it yet, so they are added on top —
            // otherwise a second purchase made inside the same save window reads
            // the same `owned` as the first and slips past maxOwned.
            const [pending] = await db
                .select({ count: count() })
                .from(shopPurchases)
                .where(and(
                    eq(shopPurchases.userId, user.userId),
                    eq(shopPurchases.gameId, gameId),
                    eq(shopPurchases.itemId, itemId),
                    eq(shopPurchases.status, "completed"),
                    gt(shopPurchases.createdAt, progress.updatedAt)
                ));

            owned = Math.max(0, Math.floor(Number(placeables[itemId]) || 0)) + (pending?.count ?? 0);
        }

        if (entry.maxOwned !== null && owned >= entry.maxOwned) {
            return NextResponse.json(
                { error: "already_owned", maxOwned: entry.maxOwned },
                { status: 409, headers: formatRateLimitHeaders(rl) }
            );
        }

        if (!(await claimSignature(signature, `${user.userId}:shop:${itemId}`))) {
            return NextResponse.json(
                { error: "signature_already_used" },
                { status: 409, headers: formatRateLimitHeaders(rl) }
            );
        }

        const existingUse = await findExistingSignatureUse(signature);
        if (existingUse) {
            if (existingUse.kind === "shop") {
                const existing = await db.query.shopPurchases.findFirst({
                    where: eq(shopPurchases.id, existingUse.id),
                });
                if (existing && existing.userId === user.userId && existing.itemId === itemId) {
                    return NextResponse.json(
                        { success: existing.status === "completed", alreadyProcessed: true, itemId },
                        { headers: formatRateLimitHeaders(rl) }
                    );
                }
            }
            return NextResponse.json(
                { error: "signature_already_used" },
                { status: 409, headers: formatRateLimitHeaders(rl) }
            );
        }

        const verifyResult = await verifyTnjTransferToTreasury({
            signature,
            expectedAmountTnj: pricing.expectedAmountTnj,
            expectedSigner: user.wallet,
        });

        if (!verifyResult.ok) {
            return NextResponse.json(
                {
                    error: verifyResult.error,
                    ...(verifyResult.retryable ? { retryable: true } : {}),
                    ...(verifyResult.details ? { details: verifyResult.details } : {}),
                },
                { status: verifyResult.status, headers: formatRateLimitHeaders(rl) }
            );
        }

        let recorded;
        try {
            [recorded] = await db.insert(shopPurchases).values({
                gameId,
                userId: user.userId,
                wallet: user.wallet,
                itemId,
                quantity: 1,
                priceTnj: pricing.requiredTnj,
                txSignature: signature,
                status: "completed",
            }).returning();
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                const concurrent = await db.query.shopPurchases.findFirst({
                    where: eq(shopPurchases.txSignature, signature),
                });
                if (concurrent) {
                    return NextResponse.json(
                        { success: concurrent.status === "completed", alreadyProcessed: true, itemId },
                        { headers: formatRateLimitHeaders(rl) }
                    );
                }
            }
            console.error("[game/shop/purchase] CRITICAL: payment verified on-chain but not recorded:", {
                itemId, signature, userId: user.userId, error: insertError?.message,
            });
            return NextResponse.json(
                { error: "settlement_record_failed", hint: "Payment confirmed on-chain but recording failed. Contact support with your transaction signature." },
                { status: 500, headers: formatRateLimitHeaders(rl) }
            );
        }

        try {
            if (entry.kind === "companion") {
                await seedLegacyDog(user.userId, gameId, Math.floor(Number(placeables[DEFAULT_COMPANION_ID]) || 0));
                await adjustCompanion(user.userId, gameId, itemId, 1);
            } else if (entry.kind === "lootbox") {
                if (itemId === COSMETIC_CRATE_ITEM_ID) {
                    await adjustCosmeticWallet(user.userId, gameId, 0, 1);
                } else {
                    await adjustWallet(user.userId, gameId, 0, 1);
                }
            } else if (entry.kind === "cosmetic") {
                await db
                    .insert(gameCosmetics)
                    .values({ userId: user.userId, gameId, itemId, pricePaidAsh: 0 })
                    .onConflictDoNothing();
            } else {
                // Placeables live in the progress blob the game server owns while
                // the player is in a session — writing it from here would be
                // overwritten by the next autosave (losing a paid item) and would
                // roll back whatever the server had saved since this request read
                // the row. The delta goes to the session instead, exactly like an
                // admin grant, and falls through to the database when offline.
                await applyLiveOps(user.userId, [{ kind: "placeableDelta", itemId, delta: 1 }]);
            }
        } catch (grantError: any) {
            console.error("[game/shop/purchase] CRITICAL: purchase recorded but item not granted:", {
                itemId, signature, userId: user.userId, purchaseId: recorded?.id, error: grantError?.message,
            });
            return NextResponse.json(
                { error: "grant_failed", hint: "Payment recorded but the item was not delivered. Contact support with your transaction signature." },
                { status: 500, headers: formatRateLimitHeaders(rl) }
            );
        }

        return NextResponse.json(
            { success: true, itemId, owned: owned + 1, priceTnj: pricing.requiredTnj },
            { headers: formatRateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error("[game/shop/purchase] Error:", error);
        return NextResponse.json({ error: "purchase_failed" }, { status: 500 });
    }
}
