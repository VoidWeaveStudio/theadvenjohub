// app/api/user/library/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";
import { db } from "@/core/database";
import { gameLicenses, games, marketplacePurchases, marketplaceLots } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");
    const page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), 100);
    const offset = (page - 1) * limit;

    const licenses = await db
      .select({
        id: gameLicenses.id,
        gameId: gameLicenses.gameId,
        purchasedAt: gameLicenses.purchasedAt,
        gameTitle: games.title,
        gameSlug: games.slug,
        gameCover: games.coverImage,
      })
      .from(gameLicenses)
      .leftJoin(games, eq(gameLicenses.gameId, games.id))
      .where(eq(gameLicenses.userId, user.userId))
      .orderBy(desc(gameLicenses.purchasedAt))
      .limit(limit)
      .offset(offset);

    if (gameId) {
      const inventory = await db
        .select({
          id: marketplacePurchases.id,
          lotId: marketplacePurchases.lotId,
          itemName: marketplaceLots.name,
          itemType: marketplaceLots.type,
          itemImage: marketplaceLots.imageUrl,
          status: marketplacePurchases.status,
          acquiredAt: marketplacePurchases.createdAt,
        })
        .from(marketplacePurchases)
        .leftJoin(marketplaceLots, eq(marketplacePurchases.lotId, marketplaceLots.id))
        .where(
          and(
            eq(marketplacePurchases.userId, user.userId),
            eq(marketplaceLots.gameId, gameId)
          )
        )
        .orderBy(desc(marketplacePurchases.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({
        library: licenses,
        inventory: inventory,
        selectedGameId: gameId,
        pagination: {
          page,
          limit,
          hasMore: licenses.length === limit || inventory.length === limit,
        },
      });
    }

    return NextResponse.json({
      library: licenses,
      pagination: {
        page,
        limit,
        hasMore: licenses.length === limit,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load library" },
      { status: 500 }
    );
  }
}