// app/api/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { games } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

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
          description: games.description,
          coverImage: games.coverImage,
          price: games.price,
          isActive: games.isActive,
        })
        .from(games)
        .where(where)
        .orderBy(games.title)
        .limit(limit)
        .offset(offset),
      db.$count(games, where),
    ]);

    return NextResponse.json({
      games: gamesList,
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
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}