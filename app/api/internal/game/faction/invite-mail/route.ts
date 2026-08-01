// app/api/internal/game/faction/invite-mail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, factions, factionMembers, mailMessages } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { getOrCreateSystemUser } from "@/core/lib/systemMailSender";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { inviterUserId, gameId, factionId, toWallet } = body;

        if (!inviterUserId || !gameId || !factionId || typeof toWallet !== "string" || toWallet.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, inviterUserId)),
        });
        if (!membership) {
            return NextResponse.json({ error: "not_a_faction_member" }, { status: 403 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const targetUser = await db.query.users.findFirst({ where: eq(users.wallet, toWallet.trim()) });
        if (!targetUser) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        const systemUser = await getOrCreateSystemUser();
        if (!systemUser) {
            return NextResponse.json({ error: "system_user_unavailable" }, { status: 500 });
        }

        await db.insert(mailMessages).values({
            senderUserId: systemUser.id,
            senderWallet: systemUser.wallet,
            recipientUserId: targetUser.id,
            subject: `Faction Invitation: ${faction.name}`,
            body: `You have been invited to join the faction "${faction.name}". Open the Factions window and search for it to join (requires holding the faction token, if any).`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/faction/invite-mail] Error:", error);
        return NextResponse.json({ error: "invite_failed" }, { status: 500 });
    }
}
