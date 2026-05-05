//app\api\marketplace\items\route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { marketplaceItems, games } from "@/core/database/schema";
import { eq, and, or, like, desc, asc, lt, gt, count } from "drizzle-orm";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const ITEMS_PER_PAGE = 24;

const SORTABLE_COLUMNS = {
  createdAt: marketplaceItems.createdAt,
  updatedAt: marketplaceItems.updatedAt,
  price: marketplaceItems.price,
  name: marketplaceItems.name,
  rarity: marketplaceItems.rarity,
  type: marketplaceItems.type,
} as const;

type SortableColumn = keyof typeof SORTABLE_COLUMNS;

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`marketplace:items:${ip}`, {
      maxAttempts: 60,
      windowMs: 60_000,
      prefix: "api:marketplace:items",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...formatRateLimitHeaders(rl),
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || String(ITEMS_PER_PAGE))));
    const offset = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const gameSlug = searchParams.get("game");
    const rarity = searchParams.get("rarity")?.split(",").filter(Boolean) || [];
    const type = searchParams.get("type")?.split(",").filter(Boolean) || [];
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const isActive = searchParams.get("active") !== "false";

    const sortByParam = searchParams.get("sortBy") as SortableColumn | null;
    const sortBy: SortableColumn = sortByParam && sortByParam in SORTABLE_COLUMNS ? sortByParam : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? asc : desc;

    const conditions = [];

    if (isActive) {
      conditions.push(eq(marketplaceItems.isActive, true));
    }

    if (search) {
      conditions.push(like(marketplaceItems.name, `%${search}%`));
    }

    if (gameSlug) {
      const game = await db.query.games.findFirst({
        where: eq(games.slug, gameSlug),
        columns: { id: true },
      });
      if (game) {
        conditions.push(eq(marketplaceItems.gameId, game.id));
      }
    }

    if (rarity.length > 0) {
      conditions.push(or(...rarity.map(r => eq(marketplaceItems.rarity, r))));
    }

    if (type.length > 0) {
      conditions.push(or(...type.map(t => eq(marketplaceItems.type, t))));
    }

    if (minPrice && !isNaN(parseInt(minPrice))) {
      conditions.push(gt(marketplaceItems.price, parseInt(minPrice)));
    }

    if (maxPrice && !isNaN(parseInt(maxPrice))) {
      conditions.push(lt(marketplaceItems.price, parseInt(maxPrice)));
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(marketplaceItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const orderByColumn = SORTABLE_COLUMNS[sortBy];

    const items = await db
      .select({
        id: marketplaceItems.id,
        name: marketplaceItems.name,
        description: marketplaceItems.description,
        price: marketplaceItems.price,
        rarity: marketplaceItems.rarity,
        type: marketplaceItems.type,
        imageUrl: marketplaceItems.imageUrl,
        stock: marketplaceItems.stock,
        createdAt: marketplaceItems.createdAt,
        game: {
          id: games.id,
          title: games.title,
          slug: games.slug,
        },
      })
      .from(marketplaceItems)
      .leftJoin(games, eq(marketplaceItems.gameId, games.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder(orderByColumn))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
      filters: {
        search,
        game: gameSlug,
        rarity,
        type,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder: searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
      },
    }, {
      headers: {
        "Content-Type": "application/json",
        ...formatRateLimitHeaders(rl),
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      },
    });

  } catch (error) {
    console.error("Failed to fetch marketplace items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}