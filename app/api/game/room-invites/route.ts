// app/api/game/room-invites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/database";
import { roomInvites, users, gameNicknames } from "@/core/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth, verifyCSRF } from "@/core/auth/lib/auth";

const createSchema = z.object({
    nickname: z.string().min(1).max(30),
    permanent: z.boolean(),
});

const revokeSchema = z.object({
    inviteId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const rows = await db
            .select({
                id: roomInvites.id,
                invitedUserId: roomInvites.invitedUserId,
                usesLeft: roomInvites.usesLeft,
                createdAt: roomInvites.createdAt,
                nickname: gameNicknames.nickname,
                wallet: users.wallet,
            })
            .from(roomInvites)
            .innerJoin(users, eq(users.id, roomInvites.invitedUserId))
            .leftJoin(gameNicknames, eq(gameNicknames.userId, roomInvites.invitedUserId))
            .where(and(
                eq(roomInvites.ownerType, "player"),
                eq(roomInvites.ownerId, authResult.user.userId)
            ));

        return NextResponse.json({
            invites: rows.map((row) => ({
                id: row.id,
                nickname: row.nickname,
                wallet: `${row.wallet.slice(0, 4)}…${row.wallet.slice(-4)}`,
                usesLeft: row.usesLeft,
                permanent: row.usesLeft === null,
                createdAt: row.createdAt,
            })),
        });
    } catch (error) {
        console.error("[game/room-invites] GET error:", error);
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
    const ownerId = authResult.user.userId;

    try {
        const parsed = createSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }
        const { nickname, permanent } = parsed.data;

        const [target] = await db
            .select({ userId: gameNicknames.userId })
            .from(gameNicknames)
            .where(sql`lower(${gameNicknames.nickname}) = lower(${nickname})`)
            .limit(1);

        if (!target) {
            return NextResponse.json({ error: "player_not_found" }, { status: 404 });
        }
        if (target.userId === ownerId) {
            return NextResponse.json({ error: "cannot_invite_self" }, { status: 400 });
        }

        const usesLeft = permanent ? null : 1;

        await db
            .insert(roomInvites)
            .values({ ownerType: "player", ownerId, invitedUserId: target.userId, usesLeft })
            .onConflictDoUpdate({
                target: [roomInvites.ownerType, roomInvites.ownerId, roomInvites.invitedUserId],
                set: { usesLeft, createdAt: new Date() },
            });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[game/room-invites] POST error:", error);
        return NextResponse.json({ error: "invite_failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!verifyCSRF(req)) {
        return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
    }

    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const parsed = revokeSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        await db
            .delete(roomInvites)
            .where(and(
                eq(roomInvites.id, parsed.data.inviteId),
                eq(roomInvites.ownerType, "player"),
                eq(roomInvites.ownerId, authResult.user.userId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[game/room-invites] DELETE error:", error);
        return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
    }
}
