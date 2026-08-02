// app/api/promo-code/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions, gameLicenses } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { normalizePromoCode } from "@/core/lib/promoCode";
import { joinFactionForUser } from "@/core/lib/factionMembership";

const redeemSchema = z.object({
  code: z.string().min(4).max(20),
  gameId: z.string().uuid("Invalid gameId format"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`promo:redeem:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:promo:redeem",
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

    const userRl = await checkRateLimit(`promo:redeem:${user.userId}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:promo:redeem:user",
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
    const validation = redeemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "validation_failed", details: validation.error.flatten() },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const normalizedCode = normalizePromoCode(validation.data.code);
    const { gameId } = validation.data;

    const faction = await db.query.factions.findFirst({
      where: and(eq(factions.promoCode, normalizedCode), eq(factions.gameId, gameId)),
    });
    if (!faction) {
      return NextResponse.json({ error: "invalid_code" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    const joinResult = await joinFactionForUser({
      userId: user.userId,
      gameId: faction.gameId,
      wallet: user.wallet,
      factionId: faction.id,
    });
    if (!joinResult.ok) {
      // faction_not_found is practically unreachable here (we just found the
      // faction above) — only possible on a concurrent-delete race. Map it to
      // invalid_code so the client doesn't need a case it can't otherwise hit.
      const mappedError = joinResult.error === "faction_not_found" ? "invalid_code" : joinResult.error;
      const mappedStatus = joinResult.error === "faction_not_found" ? 404 : joinResult.status;
      return NextResponse.json({ error: mappedError }, { status: mappedStatus, headers: formatRateLimitHeaders(rl) });
    }

    const existingLicense = await db.query.gameLicenses.findFirst({
      where: and(
        eq(gameLicenses.userId, user.userId),
        eq(gameLicenses.gameId, faction.gameId),
        eq(gameLicenses.isActive, true)
      ),
    });

    if (!existingLicense) {
      await db.insert(gameLicenses).values({
        userId: user.userId,
        gameId: faction.gameId,
        wallet: user.wallet,
        txSignature: null,
        // The real payment (1,000,000 TNJ) is recorded on
        // factions.promoCodePurchaseTx — leaving price at 0 here avoids
        // double-counting revenue if game.price is ever summed across licenses.
        price: 0,
        purchasedAt: new Date(),
        isActive: true,
        grantedViaPromoFactionId: faction.id,
        promoCodeUsed: normalizedCode,
      });
    }

    return NextResponse.json({ success: true, factionId: faction.id, gameId: faction.gameId });
  } catch (error) {
    console.error("[promo-code/redeem] Error:", error);
    return NextResponse.json({ error: "redeem_failed" }, { status: 500 });
  }
}
