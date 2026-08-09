// app/api/internal/game/room/can-enter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers, personalRooms, roomInvites } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { canEnterRoom, isRoomAccess, roomAccessDenialReason, type RoomAccess } from "@/core/lib/roomAccess";

const FACTION_PREFIX = "faction-gate-";
const PLAYER_PREFIX = "player-room-";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, locationId } = await req.json();
        if (typeof userId !== "string" || typeof locationId !== "string") {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        if (locationId.startsWith(PLAYER_PREFIX)) {
            const ownerId = locationId.slice(PLAYER_PREFIX.length);
            if (ownerId === userId) return NextResponse.json({ allowed: true });

            const [room] = await db
                .select({ access: personalRooms.access })
                .from(personalRooms)
                .where(eq(personalRooms.userId, ownerId))
                .limit(1);

            const access: RoomAccess = isRoomAccess(room?.access ?? "") ? (room!.access as RoomAccess) : "public";

            let isInvited = false;
            let invite: { id: string; usesLeft: number | null } | undefined;
            if (access === "invite") {
                [invite] = await db
                    .select({ id: roomInvites.id, usesLeft: roomInvites.usesLeft })
                    .from(roomInvites)
                    .where(and(
                        eq(roomInvites.ownerType, "player"),
                        eq(roomInvites.ownerId, ownerId),
                        eq(roomInvites.invitedUserId, userId)
                    ))
                    .limit(1);
                isInvited = !!invite;
            }

            const allowed = canEnterRoom({ access, isOwner: false, isMember: false, isInvited });

            if (allowed && invite && invite.usesLeft !== null) {
                if (invite.usesLeft <= 1) {
                    await db.delete(roomInvites).where(eq(roomInvites.id, invite.id));
                } else {
                    await db
                        .update(roomInvites)
                        .set({ usesLeft: invite.usesLeft - 1 })
                        .where(eq(roomInvites.id, invite.id));
                }
            }

            return NextResponse.json({ allowed, reason: allowed ? null : roomAccessDenialReason(access) });
        }

        if (locationId.startsWith(FACTION_PREFIX)) {
            const factionId = locationId.slice(FACTION_PREFIX.length);

            const [faction] = await db
                .select({
                    roomAccess: factions.roomAccess,
                    founderUserId: factions.founderUserId,
                    verifiedCreatorUserId: factions.verifiedCreatorUserId,
                })
                .from(factions)
                .where(eq(factions.id, factionId))
                .limit(1);

            if (!faction) return NextResponse.json({ allowed: false, reason: "That gate does not exist." });

            const isOwner = faction.founderUserId === userId || faction.verifiedCreatorUserId === userId;
            const access: RoomAccess = isRoomAccess(faction.roomAccess) ? (faction.roomAccess as RoomAccess) : "members";

            const [membership] = await db
                .select({ id: factionMembers.id })
                .from(factionMembers)
                .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId)))
                .limit(1);

            let isInvited = false;
            if (access === "invite") {
                const [invite] = await db
                    .select({ id: roomInvites.id })
                    .from(roomInvites)
                    .where(and(
                        eq(roomInvites.ownerType, "faction"),
                        eq(roomInvites.ownerId, factionId),
                        eq(roomInvites.invitedUserId, userId)
                    ))
                    .limit(1);
                isInvited = !!invite;
            }

            const allowed = canEnterRoom({ access, isOwner, isMember: !!membership, isInvited });
            return NextResponse.json({ allowed, reason: allowed ? null : roomAccessDenialReason(access) });
        }

        return NextResponse.json({ allowed: true });
    } catch (error) {
        console.error("[internal/game/room/can-enter] Error:", error);
        return NextResponse.json({ error: "check_failed" }, { status: 500 });
    }
}
