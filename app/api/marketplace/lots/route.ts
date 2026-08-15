// app/api/marketplace/lots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { marketplaceLots, games } from "@/core/database/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = ["standard", "premium", "rare", "legendary"];

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`marketplace:lots:${ip}`, {
      maxAttempts: 60,
      windowMs: 60_000,
      prefix: "api:marketplace:lots",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const { searchParams } = new URL(req.url);

    const rawPage = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;

    const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

    const offset = (page - 1) * limit;

    const search = (searchParams.get("search") || "").trim().slice(0, MAX_SEARCH_LENGTH);
    const game = searchParams.get("game") || "";
    const type = (searchParams.get("type")?.split(",").filter(Boolean) || [])
      .filter((entry) => ALLOWED_TYPES.includes(entry));
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    if (game && !UUID_PATTERN.test(game)) {
      return NextResponse.json(
        { error: "invalid_game_id" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const conditions = [];

    if (search) {
      conditions.push(like(marketplaceLots.name, `%${escapeLikePattern(search)}%`));
    }
    if (game) {
      conditions.push(eq(marketplaceLots.gameId, game));
    }
    if (type.length > 0) {
      conditions.push(sql`${marketplaceLots.type} = ANY(${type})`);
    }
    if (minPrice) {
      const min = parseInt(minPrice);
      if (!isNaN(min)) conditions.push(sql`${marketplaceLots.price} >= ${min}`);
    }
    if (maxPrice) {
      const max = parseInt(maxPrice);
      if (!isNaN(max)) conditions.push(sql`${marketplaceLots.price} <= ${max}`);
    }

    conditions.push(eq(marketplaceLots.status, "available"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy = (() => {
      const validColumns = ["createdAt", "price", "name"] as const;
      const col = validColumns.includes(sortBy as any)
        ? marketplaceLots[sortBy as keyof typeof marketplaceLots]
        : marketplaceLots.createdAt;
      return sortOrder === "asc" ? sql`${col} ASC` : sql`${col} DESC`;
    })();

    const [lotsList, totalCount] = await Promise.all([
      db
        .select({
          id: marketplaceLots.id,
          name: marketplaceLots.name,
          price: marketplaceLots.price,
          type: marketplaceLots.type,
          imageUrl: marketplaceLots.imageUrl,
          status: marketplaceLots.status,
          createdAt: marketplaceLots.createdAt,
          game: {
            id: games.id,
            title: games.title,
            slug: games.slug,
          },
        })
        .from(marketplaceLots)
        .leftJoin(games, eq(marketplaceLots.gameId, games.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db.$count(marketplaceLots, where),
    ]);

    return NextResponse.json({
      lots: lotsList,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + lotsList.length < totalCount,
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        "Content-Type": "application/json",
        ...formatRateLimitHeaders(rl),
      },
    });

  } catch (error: any) {
    console.error("[api/marketplace/lots] Error:", error?.message || error);

    return NextResponse.json(
      { error: "Failed to fetch lots", details: process.env.NODE_ENV === "development" ? error?.message : undefined },
      { status: 500 }
    );
  }
}
