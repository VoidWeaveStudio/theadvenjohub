// app/api/faction/gate/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions, factionGates } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { verifyTnjTransferToTreasury, findExistingSignatureUse } from "@/core/lib/tnjPayment";
import { claimSignature } from "@/core/lib/paymentLock";
import { canManageFaction } from "@/core/lib/factionAuth";
import { requiredTnjForItem } from "@/core/lib/shopPricing";

const purchaseSchema = z.object({
  signature: z.string().min(80).max(100, "Invalid signature length"),
  factionId: z.string().uuid("Invalid factionId format"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:gate:purchase:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:gate:purchase",
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

    const userRl = await checkRateLimit(`faction:gate:purchase:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:faction:gate:purchase:user",
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

    const existingGate = await db.query.factionGates.findFirst({ where: eq(factionGates.factionId, factionId) });
    if (existingGate) {
      return NextResponse.json({ error: "already_purchased" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    if (!(await claimSignature(signature, `${user.userId}:faction-gate`))) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409 });
    }

    const existingUse = await findExistingSignatureUse(signature);
    if (existingUse) {
      if (existingUse.kind === "faction_gate") {
        const fresh = await db.query.factionGates.findFirst({ where: eq(factionGates.id, existingUse.id) });
        if (fresh && fresh.factionId === factionId) {
          return NextResponse.json({ success: true, alreadyProcessed: true }, { headers: formatRateLimitHeaders(rl) });
        }
      }
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    const pricing = await requiredTnjForItem(faction.gameId, "faction_gate");
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

    const raceCheck = await findExistingSignatureUse(signature);
    if (raceCheck) {
      return NextResponse.json({ error: "signature_already_used" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    let created;
    try {
      [created] = await db.insert(factionGates).values({
        factionId,
        purchaseTx: signature,
      }).returning();
    } catch (insertError: any) {
      if (insertError?.code === "23505") {
        return NextResponse.json(
          {
            error: "already_purchased",
            hint: "Payment received, but this faction's gate was just purchased by a concurrent request. Contact support with your transaction signature.",
          },
          { status: 409, headers: formatRateLimitHeaders(rl) }
        );
      }
      throw insertError;
    }

    return NextResponse.json(
      { success: true, gate: { id: created.id, factionId: created.factionId, purchasedAt: created.purchasedAt } },
      { headers: formatRateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error("[faction/gate/purchase] Error:", error);
    return NextResponse.json({ error: "purchase_failed" }, { status: 500 });
  }
}
