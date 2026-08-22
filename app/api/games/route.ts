// app/api/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { games } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { resolveGamePrice } from "@/core/lib/gamePricing";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active") === "true";
    const page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const where = active ? and(eq(games.isActive, true)) : undefined;

    const [gamesList, totalCount] = await Promise.all([
      db
        .select({
          id: games.id,
          slug: games.slug,
          title: games.title,
          coverImage: games.coverImage,
          publisher: games.publisher,
          price: games.price,
          priceCurrency: games.priceCurrency,
          priceUsdCents: games.priceUsdCents,
          isActive: games.isActive,
        })
        .from(games)
        .where(where)
        .orderBy(games.title)
        .limit(limit)
        .offset(offset),
      db.$count(games, where),
    ]);

    // `price` stays the TNJ number the storefront has always rendered; for a
    // USDT-priced game it is the live conversion. The USDT source is sent along
    // so the card can label it instead of implying a fixed TNJ tag.
    const priced = await Promise.all(
      gamesList.map(async (game) => {
        const resolved = await resolveGamePrice(game);
        return {
          ...game,
          price: resolved.payableTnj ?? game.price,
          priceCurrency: resolved.currency,
          priceUsdCents: resolved.priceUsdCents,
          priceUnavailable: resolved.payableTnj === null,
        };
      })
    );

    return NextResponse.json({
      games: priced,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + gamesList.length < totalCount,
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/games] Error:", error);
    }

    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}