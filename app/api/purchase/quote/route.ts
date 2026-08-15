// app/api/purchase/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { gameLicenses, marketplaceLots, games } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`purchase:quote:${ip}`, {
      maxAttempts: 60,
      windowMs: 60_000,
      prefix: "api:purchase:quote",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: authResult.status, headers: formatRateLimitHeaders(rl) }
      );
    }
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");
    const lotId = searchParams.get("lotId");

    if (gameId && !UUID_PATTERN.test(gameId)) {
      return NextResponse.json({ error: "invalid_game_id" }, { status: 400, headers: formatRateLimitHeaders(rl) });
    }
    if (lotId && !UUID_PATTERN.test(lotId)) {
      return NextResponse.json({ error: "invalid_lot_id" }, { status: 400, headers: formatRateLimitHeaders(rl) });
    }
    if (!gameId && !lotId) {
      return NextResponse.json({ error: "missing_target" }, { status: 400, headers: formatRateLimitHeaders(rl) });
    }

    if (gameId) {
      const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
      if (!game || !game.isActive) {
        return NextResponse.json({ error: "game_not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
      }

      const ownedLicense = await db.query.gameLicenses.findFirst({
        where: and(
          eq(gameLicenses.userId, user.userId),
          eq(gameLicenses.gameId, gameId),
          eq(gameLicenses.isActive, true)
        ),
      });

      if (ownedLicense) {
        return NextResponse.json({ error: "already_owned" }, { status: 409, headers: formatRateLimitHeaders(rl) });
      }

      return NextResponse.json(
        { price: game.price, currency: "TNJ" },
        { headers: { "Cache-Control": "no-store", ...formatRateLimitHeaders(rl) } }
      );
    }

    const lot = await db.query.marketplaceLots.findFirst({ where: eq(marketplaceLots.id, lotId!) });
    if (!lot) {
      return NextResponse.json({ error: "lot_not_found" }, { status: 404, headers: formatRateLimitHeaders(rl) });
    }
    if (lot.status !== "available") {
      return NextResponse.json({ error: "lot_unavailable" }, { status: 409, headers: formatRateLimitHeaders(rl) });
    }

    return NextResponse.json(
      { price: lot.price, currency: "TNJ" },
      { headers: { "Cache-Control": "no-store", ...formatRateLimitHeaders(rl) } }
    );

  } catch (error) {
    console.error("[purchase/quote] Error:", error);
    return NextResponse.json({ error: "quote_failed" }, { status: 500 });
  }
}
