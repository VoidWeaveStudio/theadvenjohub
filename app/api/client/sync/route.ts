//app\api\client\sync\route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";
import { db } from "@/core/database";
import { gameLicenses, games, marketplacePurchases, marketplaceLots } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || String(PAGE_SIZE)), 100);
    const offset = (page - 1) * limit;

    const licensesResult = await db
      .select({
        gameId: gameLicenses.gameId,
        gameSlug: games.slug,
        gameTitle: games.title,
        gameCoverImage: games.coverImage,
        purchasedAt: gameLicenses.purchasedAt,
        isActive: gameLicenses.isActive,
      })
      .from(gameLicenses)
      .leftJoin(games, eq(gameLicenses.gameId, games.id))
      .where(eq(gameLicenses.userId, user.userId))
      .limit(limit)
      .offset(offset);

    const licenses = licensesResult.map((row) => ({
      id: row.gameId,
      gameId: row.gameId,
      title: row.gameTitle ?? "",
      slug: row.gameSlug ?? "",
      gameSlug: row.gameSlug ?? "",
      gameTitle: row.gameTitle ?? "",
      coverImage: row.gameCoverImage,
      purchasedAt: row.purchasedAt,
      status: row.isActive ? "owned" as const : "expired" as const,
    }));

    const inventoryResult = await db
      .select({
        lotId: marketplacePurchases.lotId,
        itemName: marketplaceLots.name,
        itemType: marketplaceLots.type,
        gameId: marketplaceLots.gameId,
        status: marketplacePurchases.status,
        acquiredAt: marketplacePurchases.createdAt,
      })
      .from(marketplacePurchases)
      .leftJoin(marketplaceLots, eq(marketplacePurchases.lotId, marketplaceLots.id))
      .where(eq(marketplacePurchases.userId, user.userId))
      .limit(limit)
      .offset(offset);

    const inventory = inventoryResult.map((row) => ({
      lotId: row.lotId,
      itemName: row.itemName ?? "",
      itemType: row.itemType ?? "",
      gameId: row.gameId,
      status: row.status,
      acquiredAt: row.acquiredAt,
    }));

    return NextResponse.json({
      library: licenses,
      inventory: inventory,
      user: {
        wallet: user.wallet,
      },
      pagination: {
        page,
        limit,
        hasMore: licensesResult.length === limit || inventoryResult.length === limit,
      },
      syncTimestamp: new Date().toISOString(),
    }, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed" },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}