// app/api/games/[slug]/full/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import {
  games,
  gameLicenses,
  gameScreenshots,
  gameVideos,
  gameDescriptions,
  gameSystemRequirements,
  gameReviews,
  gameTags,
  gameFeatures,
  gameStats,
  users,
} from "@/core/database/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const lang = req.nextUrl.searchParams.get("lang") || "en";

    const game = await db.query.games.findFirst({
      where: eq(games.slug, slug),
      with: {
        screenshots: {
          orderBy: (s, { asc }) => [asc(s.sortOrder)],
        },
        videos: {
          orderBy: (v, { asc }) => [asc(v.sortOrder)],
        },
        descriptions: true,
        systemRequirements: true,
        tags: true,
        features: {
          orderBy: (f, { asc }) => [asc(f.sortOrder)],
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const description = game.descriptions?.find(d => d.language === lang) ||
      game.descriptions?.find(d => d.language === "en") ||
      null;

    let stats = null;
    try {
      stats = await db.query.gameStats.findFirst({
        where: eq(gameStats.gameId, game.id),
      });
    } catch {
      stats = null;
    }

    let reviews: any[] = [];
    try {
      const reviewsList = await db.query.gameReviews.findMany({
        where: eq(gameReviews.gameId, game.id),
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        limit: 10,
      });

      reviews = await Promise.all(
        reviewsList.map(async (review) => {
          let userWallet = "Unknown";
          try {
            const user = await db.query.users.findFirst({
              where: eq(users.id, review.userId),
            });
            userWallet = user?.wallet || "Unknown";
          } catch {
            userWallet = "Unknown";
          }
          return {
            ...review,
            userWallet,
          };
        })
      );
    } catch {
      reviews = [];
    }

    let isOwned = false;
    const token = req.cookies.get("token")?.value;

    if (token) {
      try {
        const authResult = await requireAuth(req);
        if (!(authResult instanceof NextResponse)) {
          const userId = (authResult.user as any)?.userId || (authResult.user as any)?.id;
          if (userId) {
            const license = await db.query.gameLicenses.findFirst({
              where: and(
                eq(gameLicenses.userId, userId),
                eq(gameLicenses.gameId, game.id),
                eq(gameLicenses.isActive, true)
              ),
            });
            isOwned = !!license;
          }
        }
      } catch {
      }
    }

    return NextResponse.json({
      id: game.id,
      slug: game.slug,
      title: game.title,
      developer: game.developer,
      publisher: game.publisher,
      coverImage: game.coverImage,
      backgroundImage: game.backgroundImage,
      price: game.price,
      releaseDate: game.releaseDate,
      platform: game.platform,
      status: game.status,
      isOwned,
      screenshots: game.screenshots?.map((s: any) => ({ id: s.id, url: s.url })) || [],
      videos: game.videos?.map((v: any) => ({
        id: v.id,
        url: v.url,
        title: v.title,
        type: v.type
      })) || [],
      description: description ? {
        shortDescription: description.shortDescription,
        fullDescription: description.fullDescription,
      } : null,
      systemRequirements: game.systemRequirements || [],
      reviews,
      tags: game.tags?.map((t: any) => t.tag) || [],
      features: game.features?.map((f: any) => f.text) || [],
      stats: stats ? {
        reviewsCount: stats.reviewsCount ?? 0,
        positivePercent: stats.positivePercent ?? 0,
        playersCount: stats.playersCount ?? "0",
      } : {
        reviewsCount: 0,
        positivePercent: 0,
        playersCount: "0",
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });

  } catch (error) {
    console.error("[api/games/[slug]/full] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 }
    );
  }
}