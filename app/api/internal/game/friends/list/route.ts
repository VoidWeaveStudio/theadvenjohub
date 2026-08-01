// app/api/internal/game/friends/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, friendships } from "@/core/database/schema";
import { eq, and, or } from "drizzle-orm";
import { getUserFactionTag } from "@/core/lib/userFactionTag";
import { isAdminWallet, isFactionCreatorWallet } from "@/core/lib/playerBadges";

async function describeUser(userId: string, gameId: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const nick = await db.query.gameNicknames.findFirst({
        where: and(eq(gameNicknames.userId, userId), eq(gameNicknames.gameId, gameId)),
    });
    const faction = await getUserFactionTag(userId, gameId);
    return {
        userId,
        wallet: user?.wallet || "",
        nickname: nick?.nickname || null,
        faction,
        isAdmin: isAdminWallet(user?.wallet),
        isFactionCreator: await isFactionCreatorWallet(gameId, user?.wallet),
    };
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const rows = await db.query.friendships.findMany({
            where: or(eq(friendships.userId, userId), eq(friendships.friendUserId, userId)),
        });

        const accepted = rows.filter((r) => r.status === "accepted");
        const incoming = rows.filter((r) => r.status === "pending" && r.friendUserId === userId);
        const outgoing = rows.filter((r) => r.status === "pending" && r.userId === userId);

        const friends = await Promise.all(
            accepted.map((r) => describeUser(r.userId === userId ? r.friendUserId : r.userId, gameId))
        );
        const incomingRequests = await Promise.all(incoming.map((r) => describeUser(r.userId, gameId)));
        const outgoingRequests = await Promise.all(outgoing.map((r) => describeUser(r.friendUserId, gameId)));

        return NextResponse.json({ friends, incoming: incomingRequests, outgoing: outgoingRequests });
    } catch (error) {
        console.error("[internal/friends/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
