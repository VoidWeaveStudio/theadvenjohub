// app/api/game/shop/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { gameProgress, shopPurchases } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { SHOP_CATALOG_BY_ID } from "@/core/lib/shopCatalog";
import { requiredTnjForItem, resolveGameId } from "@/core/lib/shopPricing";

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
        const owned = Math.max(0, Math.floor(Number(placeables[itemId]) || 0));

        if (entry.maxOwned !== null && owned >= entry.maxOwned) {
            return NextResponse.json(
                { error: "already_owned", maxOwned: entry.maxOwned },
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

        placeables[itemId] = owned + 1;
        data.placeables = placeables;

        try {
            await db
                .update(gameProgress)
                .set({ data: JSON.stringify(data), updatedAt: new Date() })
                .where(eq(gameProgress.id, progress.id));
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
            { success: true, itemId, owned: placeables[itemId], priceTnj: pricing.requiredTnj },
            { headers: formatRateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error("[game/shop/purchase] Error:", error);
        return NextResponse.json({ error: "purchase_failed" }, { status: 500 });
    }
}
