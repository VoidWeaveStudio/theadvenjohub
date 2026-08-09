// app/api/game/room-access/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { factions, factionMembers, personalRooms } from "@/core/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";
import { canManageFaction } from "@/core/lib/factionAuth";
import { resolveGameId } from "@/core/lib/shopPricing";
import { ROOM_ACCESS_VALUES, isRoomAccess } from "@/core/lib/roomAccess";

const updateSchema = z.object({
    scope: z.enum(["personal", "faction"]),
    factionId: z.string().uuid().optional(),
    access: z.enum(ROOM_ACCESS_VALUES),
    slug: z.string().max(80).optional(),
});

export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { user } = authResult;

    try {
        const gameId = await resolveGameId(req.nextUrl.searchParams.get("slug"));
        if (!gameId) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        const [personal] = await db
            .select({ access: personalRooms.access })
            .from(personalRooms)
            .where(and(eq(personalRooms.userId, user.userId), eq(personalRooms.gameId, gameId)))
            .limit(1);

        const memberships = await db
            .select({ factionId: factionMembers.factionId })
            .from(factionMembers)
            .where(and(eq(factionMembers.userId, user.userId), eq(factionMembers.gameId, gameId)));

        const factionIds = memberships.map((m) => m.factionId);
        const managed = factionIds.length
            ? await db
                .select({
                    id: factions.id,
                    name: factions.name,
                    roomAccess: factions.roomAccess,
                    founderUserId: factions.founderUserId,
                    verifiedCreatorUserId: factions.verifiedCreatorUserId,
                })
                .from(factions)
                .where(inArray(factions.id, factionIds))
            : [];

        return NextResponse.json({
            personalAccess: personal?.access ?? "public",
            factions: managed.map((f) => ({
                id: f.id,
                name: f.name,
                access: f.roomAccess,
                canManage: canManageFaction(f, user.userId),
            })),
        });
    } catch (error) {
        console.error("[game/room-access] GET error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { user } = authResult;

    try {
        const parsed = updateSchema.safeParse(await req.json());
        if (!parsed.success || !isRoomAccess(parsed.data.access)) {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }
        const { scope, factionId, access, slug } = parsed.data;

        const gameId = await resolveGameId(slug);
        if (!gameId) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        if (scope === "personal") {
            await db
                .insert(personalRooms)
                .values({ userId: user.userId, gameId, access })
                .onConflictDoUpdate({
                    target: [personalRooms.userId, personalRooms.gameId],
                    set: { access, updatedAt: new Date() },
                });
            return NextResponse.json({ success: true, access });
        }

        if (!factionId) return NextResponse.json({ error: "faction_required" }, { status: 400 });

        const [faction] = await db
            .select({
                id: factions.id,
                founderUserId: factions.founderUserId,
                verifiedCreatorUserId: factions.verifiedCreatorUserId,
            })
            .from(factions)
            .where(eq(factions.id, factionId))
            .limit(1);

        if (!faction) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        if (!canManageFaction(faction, user.userId)) {
            return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }

        await db.update(factions).set({ roomAccess: access }).where(eq(factions.id, factionId));
        return NextResponse.json({ success: true, access });
    } catch (error) {
        console.error("[game/room-access] POST error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
