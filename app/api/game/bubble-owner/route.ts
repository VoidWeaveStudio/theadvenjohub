// app/api/game/bubble-owner/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { users, gameNicknames, factionMembers, factions, personalRooms, roomInvites } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { isAdminFaction } from "@/core/lib/adminFaction";
import { requireAuth } from "@/core/auth/lib/auth";
import { canEnterRoom, isRoomAccess, roomAccessDenialReason, type RoomAccess } from "@/core/lib/roomAccess";

export async function GET(req: NextRequest) {
    const raw = req.nextUrl.searchParams.get("index");
    const index = Number(raw);

    if (!Number.isInteger(index) || index < 0 || index > 5_000_000) {
        return NextResponse.json({ error: "invalid_index" }, { status: 400 });
    }

    try {
        const [owner] = await db
            .select({ id: users.id, wallet: users.wallet, createdAt: users.createdAt })
            .from(users)
            .where(eq(users.number, index + 1))
            .limit(1);

        if (!owner) {
            return NextResponse.json({ found: false });
        }

        const [nicknameRow] = await db
            .select({ nickname: gameNicknames.nickname })
            .from(gameNicknames)
            .where(eq(gameNicknames.userId, owner.id))
            .limit(1);

        const [displayedFaction] = await db
            .select({
                id: factions.id,
                name: factions.name,
                symbol: factions.symbol,
                image: factions.image,
                tokenCa: factions.tokenCa,
                founderWallet: factions.founderWallet,
            })
            .from(factionMembers)
            .innerJoin(factions, eq(factions.id, factionMembers.factionId))
            .where(and(eq(factionMembers.userId, owner.id), eq(factionMembers.isDisplayed, true)))
            .limit(1);

        const [roomRow] = await db
            .select({ access: personalRooms.access })
            .from(personalRooms)
            .where(eq(personalRooms.userId, owner.id))
            .limit(1);

        const access: RoomAccess = isRoomAccess(roomRow?.access ?? "") ? (roomRow!.access as RoomAccess) : "public";

        const authResult = await requireAuth(req);
        const viewerId = authResult instanceof NextResponse ? null : authResult.user.userId;

        let isInvited = false;
        if (viewerId && access === "invite") {
            const [invite] = await db
                .select({ id: roomInvites.id })
                .from(roomInvites)
                .where(and(
                    eq(roomInvites.ownerType, "player"),
                    eq(roomInvites.ownerId, owner.id),
                    eq(roomInvites.invitedUserId, viewerId)
                ))
                .limit(1);
            isInvited = !!invite;
        }

        const isOwner = viewerId === owner.id;
        const canEnter = canEnterRoom({ access, isOwner, isMember: false, isInvited });

        return NextResponse.json({
            found: true,
            index,
            ownerUserId: owner.id,
            isSelf: isOwner,
            roomAccess: access,
            canEnter,
            denialReason: canEnter ? null : roomAccessDenialReason(access),
            nickname: nicknameRow?.nickname ?? null,
            wallet: `${owner.wallet.slice(0, 4)}…${owner.wallet.slice(-4)}`,
            joinedAt: owner.createdAt,
            faction: displayedFaction
                ? {
                    id: displayedFaction.id,
                    name: displayedFaction.name,
                    symbol: displayedFaction.symbol,
                    image: displayedFaction.image,
                    isAdmin: isAdminFaction(displayedFaction.founderWallet, displayedFaction.tokenCa),
                }
                : null,
        });
    } catch (error) {
        console.error("[game/bubble-owner] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
