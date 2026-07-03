//app\api\internal\game\verify-token\route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameLicenses } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { token } = body;

        if (!token || typeof token !== "string") {
            return NextResponse.json(
                { valid: false, error: "missing_token" },
                { status: 400 }
            );
        }

        const gameTokenSecret = process.env.GAME_TOKEN_SECRET || process.env.JWT_SECRET;
        if (!gameTokenSecret) {
            return NextResponse.json(
                { valid: false, error: "server_config_error" },
                { status: 500 }
            );
        }

        const decoded = jwt.verify(token, gameTokenSecret, {
            issuer: "tanjo-game",
            audience: "tanjo-game-server",
        }) as {
            userId: string;
            wallet: string;
            gameId: string;
            gameSlug: string;
            licenseId: string;
        };

        const license = await db.query.gameLicenses.findFirst({
            where: and(
                eq(gameLicenses.id, decoded.licenseId),
                eq(gameLicenses.userId, decoded.userId),
                eq(gameLicenses.gameId, decoded.gameId),
                eq(gameLicenses.isActive, true)
            ),
        });

        if (!license) {
            return NextResponse.json({
                valid: false,
                error: "license_invalid",
            });
        }

        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
            return NextResponse.json({
                valid: false,
                error: "license_expired",
            });
        }

        return NextResponse.json({
            valid: true,
            userId: decoded.userId,
            wallet: decoded.wallet,
            gameId: decoded.gameId,
            gameSlug: decoded.gameSlug,
        });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return NextResponse.json({
                valid: false,
                error: "token_expired",
            });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return NextResponse.json({
                valid: false,
                error: "invalid_token",
            });
        }
        console.error("[internal/verify-token] Error:", error);
        return NextResponse.json(
            { valid: false, error: "verification_failed" },
            { status: 500 }
        );
    }
}