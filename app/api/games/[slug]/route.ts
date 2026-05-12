// app/api/games/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { games, gameLicenses, gameScreenshots, gameFeatures, gameStats } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";


function normalizeSystemRequirements(
  raw: unknown
): { minimum: Record<string, string> } | null {
  if (!raw || typeof raw !== "object") return null;
  
  const req = raw as { minimum?: unknown };
  
  if (req.minimum && typeof req.minimum === "object" && !Array.isArray(req.minimum)) {
    return {
      minimum: req.minimum as Record<string, string>,
    };
  }
  
  return { minimum: {} };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const game = await db.query.games.findFirst({
      where: eq(games.slug, slug),
      with: {
        screenshots: {
          orderBy: (screenshots, { asc }) => [asc(screenshots.sortOrder)],
        },
        features: true,
        stats: true,
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    let isOwned = false;
    const token = req.cookies.get("token")?.value;
    
    if (token) {
      try {
        const authResult = await requireAuth(req);
        if (!(authResult instanceof NextResponse)) {
          const license = await db.query.gameLicenses.findFirst({
            where: and(
              eq(gameLicenses.userId, authResult.user.userId),
              eq(gameLicenses.gameId, game.id),
              eq(gameLicenses.isActive, true)
            ),
          });
          isOwned = !!license;
        }
      } catch {
      }
    }

    const normalizedSystemRequirements = normalizeSystemRequirements(game.systemRequirements);

    return NextResponse.json({
      id: game.id,
      slug: game.slug,
      title: game.title,
      description: game.description,
      coverImage: game.coverImage,
      developer: game.developer,
      publisher: game.publisher,
      releaseDate: game.releaseDate,
      price: game.price,
      isOwned,
      screenshots: game.screenshots?.map(s => s.url) || [],
      features: game.features?.map(f => f.text) || [],
      systemRequirements: normalizedSystemRequirements,
      stats: game.stats ? {
        reviewsCount: game.stats.reviewsCount,
        positiveReviews: game.stats.positivePercent,
        playersCount: game.stats.playersCount,
      } : null,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/games/[slug]] Error:", error);
    }
    
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 }
    );
  }
}