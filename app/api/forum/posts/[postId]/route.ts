//app\api\forum\posts\[postId]\route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { forumPosts, forumComments, users } from "@/core/database/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const paramsSchema = z.object({
  postId: z.string().uuid("Invalid post ID format")
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await checkRateLimit(`forum:post:${ip}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    prefix: "api:forum:post:get",
  });

  try {
    const { postId } = paramsSchema.parse(await params);

    const [post] = await db
      .select({
        id: forumPosts.id,
        title: forumPosts.title,
        content: forumPosts.content,
        category: forumPosts.category,
        commentsCount: forumPosts.commentsCount,
        createdAt: forumPosts.createdAt,
        updatedAt: forumPosts.updatedAt,
        user: {
          id: users.id,
          wallet: users.wallet,
        },
      })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.userId, users.id))
      .where(eq(forumPosts.id, postId));

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        {
          status: 404,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const comments = await db
      .select({
        id: forumComments.id,
        content: forumComments.content,
        createdAt: forumComments.createdAt,
        user: {
          id: users.id,
          wallet: users.wallet,
        },
        parentId: forumComments.parentId,
      })
      .from(forumComments)
      .innerJoin(users, eq(forumComments.userId, users.id))
      .where(and(eq(forumComments.postId, postId), isNull(forumComments.parentId)))
      .orderBy(desc(forumComments.createdAt));

    return NextResponse.json(
      { post, comments },
      {
        headers: {
          "Content-Type": "application/json",
          ...formatRateLimitHeaders(rl),
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }
    console.error("Fetch post error:", error);
    return NextResponse.json(
      { error: "Failed to load post" },
      {
        status: 500,
        headers: formatRateLimitHeaders(rl),
      }
    );
  }
}