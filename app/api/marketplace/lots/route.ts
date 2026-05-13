//app\api\marketplace\lots\route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { marketplaceLots, games } from "@/core/database/schema";
import { eq, and, like, sql, desc } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const game = searchParams.get("game") || "";
    const type = searchParams.get("type")?.split(",").filter(Boolean) || [];
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const conditions = [];

    if (search) {
      conditions.push(like(marketplaceLots.name, `%${search}%`));
    }
    if (game) {
      conditions.push(eq(marketplaceLots.gameId, game));
    }
    if (type.length > 0) {
      conditions.push(sql`marketplace_lots.type = ANY(${type})`);
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
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Content-Type": "application/json",
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