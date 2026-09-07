// app/api/faction/[slug]/eligibility/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { factionMembers, factions, gameLicenses } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";
import { canManageFaction } from "@/core/lib/factionAuth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { getPublicFaction } from "@/core/lib/factionPublic";
import { evaluateHolding } from "@/core/lib/factionPromo";
import { bumpPageStatOnce } from "@/core/lib/factionStats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:eligibility:${ip}`, {
      maxAttempts: 20,
      windowMs: 60_000,
      prefix: "api:faction:eligibility",
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

    const userRl = await checkRateLimit(`faction:eligibility:${user.userId}`, {
      maxAttempts: 20,
      windowMs: 60_000,
      prefix: "api:faction:eligibility:user",
    });
    if (!userRl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts", retryAfter: Math.ceil((userRl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: formatRateLimitHeaders(userRl) }
      );
    }

    const { slug } = await params;
    const faction = await getPublicFaction(slug);
    if (!faction) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    const [row, license, membership] = await Promise.all([
      db.query.factions.findFirst({ where: eq(factions.id, faction.id) }),
      db.query.gameLicenses.findFirst({
        where: and(
          eq(gameLicenses.userId, user.userId),
          eq(gameLicenses.gameId, faction.game.id),
          eq(gameLicenses.isActive, true)
        ),
      }),
      db.query.factionMembers.findFirst({
        where: and(eq(factionMembers.userId, user.userId), eq(factionMembers.factionId, faction.id)),
      }),
    ]);

    let holding: { balance: number; valueUsdCents: number; minTokens: number } | null = null;
    let holdingError: string | null = null;

    if (faction.tokenCa) {
      const check = await evaluateHolding({
        wallet: user.wallet,
        tokenCa: faction.tokenCa,
        minUsdCents: faction.promo.minUsdCents,
      });
      if (check.ok) {
        holding = { balance: check.balance, valueUsdCents: check.valueUsdCents, minTokens: check.minTokens };
      } else {
        holdingError = check.error;
      }
    }

    const meetsHold = !faction.tokenCa || (holding !== null && holding.balance >= holding.minTokens);

    await bumpPageStatOnce(faction.id, "connects", user.userId);
    if (meetsHold) await bumpPageStatOnce(faction.id, "eligible", user.userId);

    return NextResponse.json(
      {
        wallet: user.wallet,
        hasLicense: Boolean(license),
        isMember: Boolean(membership),
        joinedAt: membership?.joinedAt ?? null,
        holding,
        holdingError,
        meetsHold,
        minUsdCents: faction.promo.minUsdCents,
        seatsLeft: faction.promo.seatsLeft,
        seats: faction.promo.seats,
        canManage: row ? canManageFaction(row, user.userId) : false,
        canRedeem: Boolean(faction.promo.code) && meetsHold && (faction.promo.seatsLeft > 0 || Boolean(license)),
      },
      { headers: { ...formatRateLimitHeaders(rl), "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[faction/eligibility] Error:", error);
    return NextResponse.json({ error: "eligibility_failed" }, { status: 500 });
  }
}
