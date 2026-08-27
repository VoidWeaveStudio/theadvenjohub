// app/api/internal/game/faction/verify-memberships/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers, mailMessages } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { getTokenBalance } from "@/core/blockchain";
import { getMyFactionsList, reassignDisplayedIfNeeded } from "@/core/lib/factionDetail";
import { SYSTEM_USER_ID, SYSTEM_SENDER_WALLET } from "@/core/lib/systemUser";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet } = body;

        if (!userId || !gameId || !wallet) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const memberships = await db.query.factionMembers.findMany({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
        });

        const checks = await Promise.allSettled(
            memberships.map(async (membership) => {
                const faction = await db.query.factions.findFirst({ where: eq(factions.id, membership.factionId) });
                if (!faction || !faction.tokenCa) return null;
                const balance = await getTokenBalance(wallet, faction.tokenCa);
                return { faction, balance };
            })
        );

        const kicked: { factionId: string; factionName: string }[] = [];

        for (const result of checks) {
            if (result.status === "rejected") {
                console.warn("[verify-memberships] balance check failed, skipping (fail-open):", result.reason?.message || result.reason);
                continue;
            }
            if (!result.value) continue;
            const { faction, balance } = result.value;
            if (balance > 0) continue;

            await db.delete(factionMembers).where(
                and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, faction.id))
            );
            await reassignDisplayedIfNeeded(userId, gameId);
            await db.insert(mailMessages).values({
                senderUserId: SYSTEM_USER_ID,
                senderWallet: SYSTEM_SENDER_WALLET,
                recipientUserId: userId,
                subject: "Removed from faction",
                body: `You were removed from the faction "${faction.name}" because you no longer hold the faction token. If this is a mistake, contact support.`,
                subjectKey: "g.mail.factionKick.subject",
                bodyKey: "g.mail.factionKick.body",
                bodyVars: { name: faction.name },
            });
            kicked.push({ factionId: faction.id, factionName: faction.name });
        }

        const remaining = await getMyFactionsList(userId, gameId);
        return NextResponse.json({ success: true, kicked, remaining });
    } catch (error) {
        console.error("[internal/faction/verify-memberships] Error:", error);
        return NextResponse.json({ error: "verify_failed" }, { status: 500 });
    }
}
