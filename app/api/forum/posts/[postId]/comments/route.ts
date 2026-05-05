//app\api\forum\posts\[postId]\comments\route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { forumComments, forumPosts, users } from "@/core/database/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { sanitizeInput } from "@/core/lib/sanitize";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const paramsSchema = z.object({
  postId: z.string().uuid("Invalid post ID format")
});

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const rl = await checkRateLimit(`forum:comments:get:${ip}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    prefix: "api:forum:comments:get",
  });

  try {
    const { postId } = paramsSchema.parse(await params);

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
      { comments },
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
    console.error("Fetch comments error:", error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      {
        status: 500,
        headers: formatRateLimitHeaders(rl),
      }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  const rl = await checkRateLimit(`forum:comments:create:${ip}`, {
    maxAttempts: 10,
    windowMs: 60_000,
    prefix: "api:forum:comments:create",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many comments. Please wait before posting again." },
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...formatRateLimitHeaders(rl),
        },
      }
    );
  }

  try {
    const { postId } = paramsSchema.parse(await params);

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: authResult.status,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    if (!verifyCSRF(req)) {
      return NextResponse.json(
        { error: "CSRF token invalid" },
        {
          status: 403,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const { user } = authResult;

    const body = await req.json();
    const validation = commentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid comment data", details: validation.error.flatten() },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const { content, parentId } = validation.data;

    const [post] = await db.select({ id: forumPosts.id }).from(forumPosts).where(eq(forumPosts.id, postId));
    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        {
          status: 404,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    if (parentId) {
      const [parent] = await db
        .select({ id: forumComments.id, postId: forumComments.postId })
        .from(forumComments)
        .where(eq(forumComments.id, parentId));

      if (!parent || parent.postId !== postId) {
        return NextResponse.json(
          { error: "Invalid parent comment" },
          {
            status: 400,
            headers: formatRateLimitHeaders(rl),
          }
        );
      }
    }

    const cleanContent = sanitizeInput(content.trim());

    if (!cleanContent) {
      return NextResponse.json(
        { error: "Content cannot be empty after sanitization" },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const [newComment] = await db
      .insert(forumComments)
      .values({
        postId,
        userId: user.userId,
        content: cleanContent,
        parentId: parentId || null,
      })
      .returning();

    await db
      .update(forumPosts)
      .set({
        commentsCount: sql`${forumPosts.commentsCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(forumPosts.id, postId));

    return NextResponse.json(
      { success: true, comment: newComment },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...formatRateLimitHeaders(rl),
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
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      {
        status: 500,
        headers: formatRateLimitHeaders(rl),
      }
    );
  }
}