// app/api/internal/game/faction/turrets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { roomLayouts } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import {
    FACTION_TURRET_PIECE,
    FACTION_TURRET_MAX,
    cellToWorld,
    levelBaseY,
} from "@/core/lib/roomLayoutGrid";
import { FACTION_PLOT_SIZE } from "@/features/game/world/building/BuildLayout";

interface StoredPiece {
    t?: string;
    x?: number;
    z?: number;
    l?: number;
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, factionId } = body;

        if (typeof gameId !== "string" || typeof factionId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [row] = await db
            .select({ data: roomLayouts.data, revision: roomLayouts.revision })
            .from(roomLayouts)
            .where(and(
                eq(roomLayouts.gameId, gameId),
                eq(roomLayouts.ownerType, "faction"),
                eq(roomLayouts.ownerId, factionId)
            ))
            .limit(1);

        const pieces = (row?.data as { pieces?: StoredPiece[] } | null)?.pieces;
        if (!Array.isArray(pieces)) {
            return NextResponse.json({ success: true, revision: row?.revision ?? 0, turrets: [] });
        }

        const turrets = pieces
            .filter((piece) => piece?.t === FACTION_TURRET_PIECE)
            .slice(0, FACTION_TURRET_MAX)
            .map((piece, index) => ({
                id: `${factionId}:${index}`,
                x: cellToWorld(Number(piece.x) || 0, FACTION_PLOT_SIZE),
                y: levelBaseY(Number(piece.l) || 0) + 1.4,
                z: cellToWorld(Number(piece.z) || 0, FACTION_PLOT_SIZE),
            }));

        return NextResponse.json({ success: true, revision: row?.revision ?? 0, turrets });
    } catch (error) {
        console.error("[internal/faction/turrets] Error:", error);
        return NextResponse.json({ error: "turrets_failed" }, { status: 500 });
    }
}
