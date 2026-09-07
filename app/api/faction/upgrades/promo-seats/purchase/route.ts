// app/api/faction/upgrades/promo-seats/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions, shopPurchases } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { claimSignature } from "@/core/lib/paymentLock";
import { requiredTnjForItem } from "@/core/lib/shopPricing";
import { canManageFaction } from "@/core/lib/factionAuth";
import { PROMO_SEAT_PACK_SIZE } from "@/core/lib/factionPromo";

const ITEM_ID = "faction_promo_seats";

const purchaseSchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  factionId: z.string().uuid("Invalid factionId format"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:seats:purchase:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:seats:purchase",
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authResult.status, headers: formatRateLimitHeaders(rl) });
    }
    const { user } = authResult;

    const userRl = await checkRateLimit(`faction:seats:purchase:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:seats:purchase:user",
    });
    if (!userRl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((userRl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(userRl) }
      );
    }

    if (!verifyCSRF(req)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    const body = await req.json();
    const validation = purchaseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "validation_failed", details: validation.error.flatten() },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }
    const { signature, factionId } = validation.data;

    const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
    if (!faction) {
      return NextResponse.json({ error: "faction_not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    if (!canManageFaction(faction, user.userId)) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    if (!faction.promoCode) {
      return NextResponse.json({ error: "promo_code_required" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    if (!(await claimSignature(signature, `${user.userId}:faction-seats`))) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409 });
    }

    const existingUse = await findExistingSignatureUse(signature);
    if (existingUse) {
      if (existingUse.kind === "shop") {
        const existing = await db.query.shopPurchases.findFirst({ where: eq(shopPurchases.id, existingUse.id) });
        if (existing?.itemId === ITEM_ID) {
          const fresh = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
          return NextResponse.json({
            success: true,
            type: "faction_upgrade",
            id: factionId,
            promoSeats: fresh?.promoSeats ?? faction.promoSeats,
            alreadyProcessed: true,
          });
        }
      }
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    const pricing = await requiredTnjForItem(faction.gameId, ITEM_ID);
    if (!pricing.ok) {
      return NextResponse.json(
        { error: pricing.error },
        { status: pricing.status, headers: formatRateLimitHeaders(rl) }
      );
    }

    const verifyResult = await verifyTnjTransferToTreasury({
      signature,
      expectedAmountTnj: pricing.expectedAmountTnj,
      expectedSigner: user.wallet,
    });
    if (!verifyResult.ok) {
      return NextResponse.json(
        { error: verifyResult.error, ...(verifyResult.details ? { details: verifyResult.details } : {}) },
        { status: verifyResult.status, headers: formatRateLimitHeaders(rl) }
      );
    }

    try {
      await db.insert(shopPurchases).values({
        gameId: faction.gameId,
        userId: user.userId,
        wallet: user.wallet,
        itemId: ITEM_ID,
        quantity: 1,
        priceTnj: pricing.expectedAmountTnj,
        txSignature: signature,
        status: "completed",
      });
    } catch (insertError: any) {
      if (insertError?.code === "23505") {
        return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
      }
      throw insertError;
    }

    const [updated] = await db
      .update(factions)
      .set({ promoSeats: sql`${factions.promoSeats} + ${PROMO_SEAT_PACK_SIZE}` })
      .where(eq(factions.id, factionId))
      .returning({ promoSeats: factions.promoSeats });

    if (!updated) {
      console.error("[faction/upgrades/promo-seats/purchase] Paid but seats not credited:", {
        factionId, signature, userId: user.userId,
      });
      return NextResponse.json(
        {
          error: "seats_not_credited",
          hint: "Payment received but the seats were not added. Contact support with your transaction signature.",
        },
        { status: 500, headers: formatRateLimitHeaders(rl) }
      );
    }

    return NextResponse.json(
      { success: true, type: "faction_upgrade", id: factionId, promoSeats: updated.promoSeats, added: PROMO_SEAT_PACK_SIZE },
      { headers: formatRateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error("[faction/upgrades/promo-seats/purchase] Error:", error);
    return NextResponse.json({ error: "purchase_failed" }, { status: 500 });
  }
}
