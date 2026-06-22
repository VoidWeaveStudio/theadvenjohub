// app/api/admin/games/[slug]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { games, gameScreenshots, gameVideos } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { verifyAdminToken } from "@/core/admin/auth";
import { put } from "@vercel/blob";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const admin = verifyAdminToken(token);
    if (!admin) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const game = await db.query.games.findFirst({
      where: eq(games.slug, slug),
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const type = formData.get("type") as string;
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = await put(`${slug}/${type}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    if (type === "screenshot") {
      const sortOrder = formData.get("sortOrder");
      await db.insert(gameScreenshots).values({
        gameId: game.id,
        url: blob.url,
        sortOrder: sortOrder ? parseInt(sortOrder as string) : 0,
      });
    } else if (type === "video") {
      const videoTitle = formData.get("title") as string;
      const videoType = formData.get("videoType") as string || "trailer";
      const sortOrder = formData.get("sortOrder");

      await db.insert(gameVideos).values({
        gameId: game.id,
        url: blob.url,
        title: videoTitle,
        type: videoType,
        sortOrder: sortOrder ? parseInt(sortOrder as string) : 0,
      });
    } else if (type === "cover") {
      await db.update(games)
        .set({ coverImage: blob.url, updatedAt: new Date() })
        .where(eq(games.id, game.id));
    } else if (type === "background") {
      await db.update(games)
        .set({ backgroundImage: blob.url, updatedAt: new Date() })
        .where(eq(games.id, game.id));
    }

    return NextResponse.json({ url: blob.url, type });

  } catch (error) {
    console.error("[media upload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}