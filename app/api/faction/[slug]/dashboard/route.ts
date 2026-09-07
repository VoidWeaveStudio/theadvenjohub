// app/api/faction/[slug]/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { canManageFaction } from "@/core/lib/factionAuth";
import { resolveFactionRef } from "@/core/lib/factionPublic";
import { getFounderFunnel } from "@/core/lib/factionStats";
import { minHoldUsdCents, seatsRemaining } from "@/core/lib/factionPromo";

const WINDOW_DAYS = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:dashboard:${ip}`, {
      maxAttempts: 30,
      windowMs: 60_000,
      prefix: "api:faction:dashboard",
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429, headers: formatRateLimitHeaders(rl) });
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authResult.status, headers: formatRateLimitHeaders(rl) });
    }
    const { user } = authResult;

    const { slug } = await params;
    const ref = await resolveFactionRef(slug);
    if (!ref) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    const faction = await db.query.factions.findFirst({ where: eq(factions.id, ref.id) });
    if (!faction) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }

    if (!canManageFaction(faction, user.userId)) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403, headers: formatRateLimitHeaders(rl) });
    }

    const funnel = await getFounderFunnel(faction.id, faction.gameId, WINDOW_DAYS);

    return NextResponse.json(
      {
        faction: {
          id: faction.id,
          number: faction.number,
          name: faction.name,
          symbol: faction.symbol,
          slug: faction.slug || `F${faction.number}`,
        },
        promo: {
          code: faction.promoCode,
          seats: faction.promoSeats,
          seatsUsed: faction.promoSeatsUsed,
          seatsLeft: seatsRemaining(faction),
          minUsdCents: minHoldUsdCents(faction),
        },
        funnel,
      },
      { headers: { ...formatRateLimitHeaders(rl), "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[faction/dashboard] Error:", error);
    return NextResponse.json({ error: "dashboard_failed" }, { status: 500 });
  }
}
