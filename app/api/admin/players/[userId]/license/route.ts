// app/api/admin/players/[userId]/license/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { resolveGameId } from "@/core/lib/shopPricing";
import { db } from "@/core/database";
import { gameLicenses, users } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();

        if (typeof body.grant !== "boolean") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(
            req,
            body,
            body.grant ? "grantLicense" : "revokeLicense",
            userId
        );
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof body.gameSlug === "string" ? body.gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const existing = await db.query.gameLicenses.findFirst({
            where: and(
                eq(gameLicenses.userId, userId),
                eq(gameLicenses.gameId, gameId),
                eq(gameLicenses.isActive, true)
            ),
        });

        if (body.grant) {
            // A revoked license is reactivated rather than duplicated: the unique
            // index only covers active rows, so a second insert would collide the
            // moment the first one is switched back on.
            if (existing) {
                return NextResponse.json({ success: true, ownsGame: true });
            }

            const revoked = await db.query.gameLicenses.findFirst({
                where: and(eq(gameLicenses.userId, userId), eq(gameLicenses.gameId, gameId)),
            });

            if (revoked) {
                await db
                    .update(gameLicenses)
                    .set({ isActive: true })
                    .where(eq(gameLicenses.id, revoked.id));
            } else {
                await db.insert(gameLicenses).values({
                    userId,
                    gameId,
                    wallet: user.wallet,
                    txSignature: null,
                    price: 0,
                    purchasedAt: new Date(),
                    isActive: true,
                });
            }

            return NextResponse.json({ success: true, ownsGame: true });
        }

        if (!existing) {
            return NextResponse.json({ success: true, ownsGame: false });
        }

        await db
            .update(gameLicenses)
            .set({ isActive: false })
            .where(eq(gameLicenses.id, existing.id));

        return NextResponse.json({ success: true, ownsGame: false });
    } catch (error) {
        console.error("[admin/players/:userId/license] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
