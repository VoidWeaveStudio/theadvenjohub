//app\api\game\session\route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireAuth } from "@/core/auth/lib/auth";
import { db } from "@/core/database";
import { games, gameLicenses } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    const rl = await checkRateLimit(`game:session:${ip}`, {
        maxAttempts: 10,
        windowMs: 60_000,
        prefix: "api:game:session",
    });

    if (!rl.allowed) {
        return NextResponse.json(
            { error: "too_many_attempts" },
            { status: 429, headers: formatRateLimitHeaders(rl) }
        );
    }

    try {
        const authResult = await requireAuth(req);
        if (authResult instanceof NextResponse) {
            return authResult;
        }
        const { user } = authResult;

        const body = await req.json();
        const { gameSlug } = body;

        if (!gameSlug || typeof gameSlug !== "string") {
            return NextResponse.json(
                { error: "invalid_game_slug" },
                { status: 400, headers: formatRateLimitHeaders(rl) }
            );
        }

        const game = await db.query.games.findFirst({
            where: eq(games.slug, gameSlug),
        });

        if (!game) {
            return NextResponse.json(
                { error: "game_not_found" },
                { status: 404, headers: formatRateLimitHeaders(rl) }
            );
        }

        const license = await db.query.gameLicenses.findFirst({
            where: and(
                eq(gameLicenses.userId, user.userId),
                eq(gameLicenses.gameId, game.id),
                eq(gameLicenses.isActive, true)
            ),
        });

        if (!license) {
            return NextResponse.json(
                { error: "no_license" },
                { status: 403, headers: formatRateLimitHeaders(rl) }
            );
        }

        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            return NextResponse.json(
                { error: "license_expired" },
                { status: 403, headers: formatRateLimitHeaders(rl) }
            );
        }

        const jwtSecret = process.env.JWT_SECRET;
        const gameTokenSecret = process.env.GAME_TOKEN_SECRET || jwtSecret;

        if (!gameTokenSecret) {
            return NextResponse.json(
                { error: "server_config_error" },
                { status: 500, headers: formatRateLimitHeaders(rl) }
            );
        }

        const gameToken = jwt.sign(
            {
                userId: user.userId,
                wallet: user.wallet,
                gameId: game.id,
                gameSlug: game.slug,
                licenseId: license.id,
                iat: Math.floor(Date.now() / 1000),
            },
            gameTokenSecret,
            {
                expiresIn: "1h",
                issuer: "tanjo-game",
                audience: "tanjo-game-server",
                jwtid: `${user.userId}-${game.id}-${Date.now()}`,
            }
        );

        return NextResponse.json(
            {
                success: true,
                gameToken,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                serverUrl: process.env.NEXT_PUBLIC_GAME_SERVER_URL || "wss://tanjo-game-server.onrender.com",
                userId: user.userId,
                wallet: user.wallet,
            },
            { headers: formatRateLimitHeaders(rl) }
        );

    } catch (error) {
        console.error("[api/game/session] Error:", error);
        return NextResponse.json(
            { error: "session_failed" },
            { status: 500, headers: formatRateLimitHeaders(rl) }
        );
    }
}