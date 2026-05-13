//app\api\user\inventory\route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";
import { db } from "@/core/database";
import { marketplacePurchases, marketplaceLots, games } from "@/core/database/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");
    const page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(marketplacePurchases.userId, user.userId)];
    
    if (gameId && gameId !== "all") {
      conditions.push(eq(marketplaceLots.gameId, gameId));
    }

    const purchases = await db
      .select({
        id: marketplacePurchases.id,
        lotId: marketplacePurchases.lotId,
        amount: marketplacePurchases.amount,
        status: marketplacePurchases.status,
        createdAt: marketplacePurchases.createdAt,
        lotName: marketplaceLots.name,
        lotType: marketplaceLots.type,
        lotImage: marketplaceLots.imageUrl,
        lotGameId: marketplaceLots.gameId,
        gameTitle: games.title,
        gameSlug: games.slug,
      })
      .from(marketplacePurchases)
      .leftJoin(marketplaceLots, eq(marketplacePurchases.lotId, marketplaceLots.id))
      .leftJoin(games, and(eq(marketplaceLots.gameId, games.id), isNotNull(marketplaceLots.gameId)))
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(marketplacePurchases.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedItems = purchases.map(item => ({
      id: item.id,
      lotId: item.lotId,
      itemName: item.lotName,
      itemType: item.lotType,
      itemImage: item.lotImage,
      gameTitle: item.gameTitle,
      gameSlug: item.gameSlug,
      amount: item.amount,
      status: item.status,
      acquiredAt: item.createdAt,
    }));

    return NextResponse.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        hasMore: purchases.length === limit,
      },
    }, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load inventory" },
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}