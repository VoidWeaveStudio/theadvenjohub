// app/api/admin/games/[slug]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { games, gameScreenshots, gameVideos } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["screenshot", "video", "cover", "background"]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  try {
    const { slug } = await params;

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
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
    if (!ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const sigError = verifyAdminAction(
      req,
      {
        wallet: formData.get("wallet"),
        signature: formData.get("signature"),
        timestamp: Number(formData.get("timestamp")),
      },
      "media_upload",
      slug
    );
    if (sigError) return sigError;

    const safeName = sanitizeFileName(file.name);
    const blob = await put(`${slug}/${type}/${safeName}`, file, {
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
