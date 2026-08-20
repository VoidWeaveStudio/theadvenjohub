// app/api/faction/upgrades/promo-code/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { generatePromoCode } from "@/core/lib/promoCode";
import { requiredTnjForItem } from "@/core/lib/shopPricing";
import { canManageFaction } from "@/core/lib/factionAuth";

const purchaseSchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  factionId: z.string().uuid("Invalid factionId format"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:promo:purchase:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:promo:purchase",
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

    const userRl = await checkRateLimit(`faction:promo:purchase:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:promo:purchase:user",
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

    // Same rule as accepting a faction task: founder or verified creator only.
    if (!canManageFaction(faction, user.userId)) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    if (faction.promoCode) {
      return NextResponse.json(
        { error: "already_purchased", promoCode: faction.promoCode },
        { status: 409, headers: formatRateLimitHeaders(rl) }
      );
    }

    const existingUse = await findExistingSignatureUse(signature);
    if (existingUse) {
      if (existingUse.kind === "faction_promo" && existingUse.id === factionId) {
        const fresh = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        return NextResponse.json({
          success: true, type: "faction_upgrade", id: factionId, promoCode: fresh?.promoCode, alreadyProcessed: true,
        });
      }
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    const pricing = await requiredTnjForItem(faction.gameId, "faction_promo_code");
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

    // Narrow the race window — re-check right before writing, same pattern as purchase/verify.
    const raceCheck = await findExistingSignatureUse(signature);
    if (raceCheck) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    let savedCode: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePromoCode();
      try {
        const [updated] = await db.update(factions)
          .set({ promoCode: candidate, promoCodePurchaseTx: signature, promoCodePurchasedAt: new Date() })
          .where(and(eq(factions.id, factionId), isNull(factions.promoCode)))
          .returning();

        if (updated) {
          savedCode = updated.promoCode;
          break;
        }

        // 0 rows updated — someone else claimed this upgrade concurrently.
        // Payment already went through (TNJ is spent); there's no
        // refund_pending ledger for this purchase type (unlike marketplace
        // lots), so this needs manual reconciliation.
        console.error("[faction/upgrades/promo-code/purchase] Paid tx but faction already had a promo code (race):", {
          factionId, signature, userId: user.userId,
        });
        return NextResponse.json(
          {
            error: "already_purchased",
            hint: "Payment received, but this upgrade was just claimed by a concurrent request. Contact support with your transaction signature.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      } catch (err: any) {
        if (err?.code === "23505") continue; // promo_code collision, try another random code
        throw err;
      }
    }

    if (!savedCode) {
      console.error("[faction/upgrades/promo-code/purchase] Exhausted promo code generation attempts", { factionId, signature });
      return NextResponse.json({ error: "promo_code_generation_failed" }, { status: 500, headers: formatRateLimitHeaders(rl) });
    }

    return NextResponse.json(
      { success: true, type: "faction_upgrade", id: factionId, promoCode: savedCode },
      { headers: formatRateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error("[faction/upgrades/promo-code/purchase] Error:", error);
    return NextResponse.json({ error: "purchase_failed" }, { status: 500 });
  }
}
