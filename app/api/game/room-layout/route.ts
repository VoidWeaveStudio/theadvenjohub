// app/api/game/room-layout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { gameProgress, roomLayouts } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { canEditLot } from "@/core/lib/roomLayoutAccess";
import { resolveGameId } from "@/core/lib/shopPricing";
import {
    SPAWN_BEACON_PIECE,
    STORAGE_CRATE_PIECE,
    FACTION_TURRET_PIECE,
    FACTION_TURRET_COST_ASH,
    FACTION_TURRET_MAX,
    countPieces,
} from "@/core/lib/roomLayoutGrid";
import { moveTreasury } from "@/core/lib/factionTreasury";
import { factionPlotBounds } from "@/core/lib/roomLayoutBounds";

const MAX_PIECES = 20000;

const pieceSchema = z.object({
    t: z.string().max(40),
    x: z.number().int().min(-1024).max(2048),
    z: z.number().int().min(-1024).max(2048),
    l: z.number().int().min(0).max(15),
    r: z.number().int().min(0).max(3),
    d: z.string().url().max(300).optional(),
});

const layoutSchema = z.object({
    v: z.number().int(),
    plot: z.number().int().min(1).max(2048),
    env: z.object({
        sky: z.string().max(24),
        light: z.string().max(24),
    }),
    pieces: z.array(pieceSchema).max(MAX_PIECES),
});

const saveSchema = z.object({
    ownerType: z.enum(["personal", "faction"]),
    ownerId: z.string().uuid(),
    data: layoutSchema,
    slug: z.string().max(80).optional(),
});

const TURRET_REFUND_RATIO = 0.5;

function storedTurretCount(data: unknown): number {
    const pieces = (data as { pieces?: Array<{ t?: string }> } | null)?.pieces;
    if (!Array.isArray(pieces)) return 0;
    return pieces.filter((piece) => piece?.t === FACTION_TURRET_PIECE).length;
}

async function ownedStorageCrates(userId: string): Promise<number> {
    const [row] = await db
        .select({ data: gameProgress.data })
        .from(gameProgress)
        .where(eq(gameProgress.userId, userId))
        .limit(1);

    if (!row?.data) return 0;

    try {
        const parsed = JSON.parse(row.data);
        const owned = Number(parsed?.placeables?.[STORAGE_CRATE_PIECE]);
        return Number.isFinite(owned) ? Math.max(0, Math.floor(owned)) : 0;
    } catch {
        return 0;
    }
}

export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { user } = authResult;

    const ownerType = req.nextUrl.searchParams.get("ownerType");
    const ownerId = req.nextUrl.searchParams.get("ownerId");

    if (ownerType !== "personal" && ownerType !== "faction") {
        return NextResponse.json({ error: "bad_owner_type" }, { status: 400 });
    }
    if (!ownerId) {
        return NextResponse.json({ error: "bad_owner" }, { status: 400 });
    }

    try {
        const gameId = await resolveGameId(req.nextUrl.searchParams.get("slug"));
        if (!gameId) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const [row] = await db
            .select({ data: roomLayouts.data, revision: roomLayouts.revision })
            .from(roomLayouts)
            .where(and(
                eq(roomLayouts.gameId, gameId),
                eq(roomLayouts.ownerType, ownerType),
                eq(roomLayouts.ownerId, ownerId)
            ))
            .limit(1);

        const canEdit = await canEditLot(ownerType, ownerId, user.userId);

        return NextResponse.json({
            data: row?.data ?? null,
            revision: row?.revision ?? 0,
            canEdit,
        });
    } catch (error) {
        console.error("[room-layout] load failed:", error);
        return NextResponse.json({ error: "load_failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "csrf_failed" }, { status: 403 });
    }
    const { user } = authResult;

    let payload: z.infer<typeof saveSchema>;
    try {
        payload = saveSchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "bad_payload" }, { status: 400 });
    }

    try {
        const gameId = await resolveGameId(payload.slug);
        if (!gameId) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const allowed = await canEditLot(payload.ownerType, payload.ownerId, user.userId);
        if (!allowed) {
            return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }

        const bounds = await factionPlotBounds(payload.ownerType, payload.ownerId, payload.data.plot);
        const outOfBounds = payload.data.pieces.some(
            (piece) =>
                piece.x < bounds.min || piece.x > bounds.max ||
                piece.z < bounds.min || piece.z > bounds.max
        );

        if (outOfBounds) {
            return NextResponse.json({ error: "piece_out_of_bounds" }, { status: 400 });
        }

        const beacons = countPieces(payload.data.pieces, SPAWN_BEACON_PIECE);
        const crates = countPieces(payload.data.pieces, STORAGE_CRATE_PIECE);

        if (beacons > 0 || crates > 0) {
            if (payload.ownerType !== "personal" || payload.ownerId !== user.userId) {
                return NextResponse.json({ error: "personal_lot_only" }, { status: 400 });
            }
            if (beacons > 1) {
                return NextResponse.json({ error: "too_many_beacons" }, { status: 400 });
            }
            if (crates > await ownedStorageCrates(user.userId)) {
                return NextResponse.json({ error: "too_many_crates" }, { status: 400 });
            }
        }

        const [existing] = await db
            .select({ id: roomLayouts.id, revision: roomLayouts.revision, data: roomLayouts.data })
            .from(roomLayouts)
            .where(and(
                eq(roomLayouts.gameId, gameId),
                eq(roomLayouts.ownerType, payload.ownerType),
                eq(roomLayouts.ownerId, payload.ownerId)
            ))
            .limit(1);

        const turrets = countPieces(payload.data.pieces, FACTION_TURRET_PIECE);

        if (turrets > 0 && payload.ownerType !== "faction") {
            return NextResponse.json({ error: "faction_lot_only" }, { status: 400 });
        }

        if (turrets > FACTION_TURRET_MAX) {
            return NextResponse.json({ error: "too_many_turrets" }, { status: 400 });
        }

        if (payload.ownerType === "faction") {
            const before = storedTurretCount(existing?.data ?? null);
            const delta = turrets - before;

            if (delta > 0) {
                const charge = await moveTreasury(
                    payload.ownerId,
                    gameId,
                    "turret",
                    { ash: -delta * FACTION_TURRET_COST_ASH },
                    { userId: user.userId, note: `build:${delta}` }
                );

                if (!charge.ok) {
                    return NextResponse.json(
                        { error: charge.error === "not_found" ? "faction_not_found" : "treasury_short" },
                        { status: charge.error === "not_found" ? 404 : 409 }
                    );
                }
            } else if (delta < 0) {
                const refund = Math.round(-delta * FACTION_TURRET_COST_ASH * TURRET_REFUND_RATIO);
                await moveTreasury(
                    payload.ownerId,
                    gameId,
                    "turret",
                    { ash: refund },
                    { userId: user.userId, note: `salvage:${-delta}` }
                );
            }
        }

        if (existing) {
            const revision = existing.revision + 1;
            await db
                .update(roomLayouts)
                .set({
                    data: payload.data,
                    revision,
                    updatedByUserId: user.userId,
                    updatedAt: new Date(),
                })
                .where(eq(roomLayouts.id, existing.id));
            return NextResponse.json({ success: true, revision });
        }

        await db.insert(roomLayouts).values({
            gameId,
            ownerType: payload.ownerType,
            ownerId: payload.ownerId,
            revision: 1,
            data: payload.data,
            updatedByUserId: user.userId,
        });

        return NextResponse.json({ success: true, revision: 1 });
    } catch (error) {
        console.error("[room-layout] save failed:", error);
        return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
}
