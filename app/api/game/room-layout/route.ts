// app/api/game/room-layout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { roomLayouts } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { canEditLot } from "@/core/lib/roomLayoutAccess";
import { resolveGameId } from "@/core/lib/shopPricing";

const MAX_PIECES = 20000;

const pieceSchema = z.object({
    t: z.string().max(40),
    x: z.number().int().min(0).max(1024),
    z: z.number().int().min(0).max(1024),
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

        const [existing] = await db
            .select({ id: roomLayouts.id, revision: roomLayouts.revision })
            .from(roomLayouts)
            .where(and(
                eq(roomLayouts.gameId, gameId),
                eq(roomLayouts.ownerType, payload.ownerType),
                eq(roomLayouts.ownerId, payload.ownerId)
            ))
            .limit(1);

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
