//app\api\forum\posts\route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { forumPosts, users } from "@/core/database/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";
import { sanitizeInput } from "@/core/lib/sanitize";

const querySchema = z.object({
  category: z.enum(["general", "bug-report", "suggestion", "discussion", "all"]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`forum:posts:get:${ip}`, {
      maxAttempts: 30,
      windowMs: 60_000,
      prefix: "api:forum:posts:get",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...formatRateLimitHeaders(rl),
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const queryData = querySchema.safeParse({
      category: searchParams.get("category") || undefined,
      limit: searchParams.get("limit"),
      cursor: searchParams.get("cursor") || undefined,
    });

    if (!queryData.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryData.error.flatten() },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const { category, limit, cursor } = queryData.data;

    const whereConditions = [];

    if (category && category !== "all") {
      whereConditions.push(eq(forumPosts.category, category));
    }

    if (cursor) {
      whereConditions.push(lt(forumPosts.createdAt, new Date(cursor)));
    }

    const posts = await db
      .select({
        id: forumPosts.id,
        title: forumPosts.title,
        content: forumPosts.content,
        category: forumPosts.category,
        commentsCount: forumPosts.commentsCount,
        createdAt: forumPosts.createdAt,
        user: {
          id: users.id,
          wallet: users.wallet,
        },
      })
      .from(forumPosts)
      .leftJoin(users, eq(forumPosts.userId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(forumPosts.createdAt))
      .limit(limit);

    const response = {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.createdAt.toISOString() : null,
    };

    return NextResponse.json(response, {
      headers: {
        "Content-Type": "application/json",
        ...formatRateLimitHeaders(rl),
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("Forum posts fetch error:", error);

    if (error.message?.includes("ECONNRESET") || error.message?.includes("fetch failed") || error.message?.includes("DB_TIMEOUT")) {
      return NextResponse.json(
        { error: "Database temporarily unavailable" },
        {
          status: 503,
          headers: { "Retry-After": "3" }
        }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`forum:posts:create:${ip}`, {
      maxAttempts: 3,
      windowMs: 60_000,
      prefix: "api:forum:posts:create",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many posts created. Please wait before creating another." },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...formatRateLimitHeaders(rl),
          },
        }
      );
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
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

    const postSchema = z.object({
      title: z.string().min(3).max(200),
      content: z.string().min(10).max(10000),
      category: z.enum(["general", "bug-report", "suggestion", "discussion"]).optional().default("general"),
    });

    const validation = postSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid post data", details: validation.error.flatten() },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const { title, content, category } = validation.data;

    const cleanTitle = sanitizeInput(title.trim());
    const cleanContent = sanitizeInput(content.trim());

    if (!cleanTitle || !cleanContent) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        {
          status: 400,
          headers: formatRateLimitHeaders(rl),
        }
      );
    }

    const [newPost] = await db
      .insert(forumPosts)
      .values({
        userId: user.userId,
        title: cleanTitle,
        content: cleanContent,
        category,
      })
      .returning();

    return NextResponse.json(
      { success: true, post: newPost },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          ...formatRateLimitHeaders(rl),
        },
      }
    );
  } catch (error: any) {
    console.error("Create post error:", error);

    if (error.message?.includes("ECONNRESET") || error.message?.includes("fetch failed") || error.message?.includes("DB_TIMEOUT")) {
      return NextResponse.json(
        { error: "Database temporarily unavailable" },
        {
          status: 503,
          headers: { "Retry-After": "3" }
        }
      );
    }

    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}