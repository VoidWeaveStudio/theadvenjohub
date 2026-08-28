// app/api/internal/game/faction/treasury/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { getLedger, getTreasury, moveTreasury, LEDGER_KINDS, LedgerKind } from "@/core/lib/factionTreasury";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { action, factionId, gameId, userId } = body;

        if (typeof factionId !== "string" || typeof gameId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        if (action === "get") {
            const treasury = await getTreasury(factionId);
            if (!treasury) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
            return NextResponse.json({ success: true, treasury });
        }

        if (action === "ledger") {
            if (typeof userId === "string") {
                const membership = await db.query.factionMembers.findFirst({
                    where: and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId)),
                });
                if (!membership) return NextResponse.json({ error: "not_a_member" }, { status: 403 });
            }

            const [treasury, entries] = await Promise.all([
                getTreasury(factionId),
                getLedger(factionId, gameId, 25),
            ]);

            if (!treasury) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
            return NextResponse.json({ success: true, treasury, entries });
        }

        if (action === "move") {
            const kind = LEDGER_KINDS.includes(body.kind as LedgerKind) ? (body.kind as LedgerKind) : null;
            if (!kind) return NextResponse.json({ error: "bad_kind" }, { status: 400 });

            const result = await moveTreasury(
                factionId,
                gameId,
                kind,
                {
                    ash: body.ash,
                    companionFragments: body.companionFragments,
                    cosmeticFragments: body.cosmeticFragments,
                },
                { userId: typeof userId === "string" ? userId : null, note: body.note ?? null }
            );

            if (!result.ok) {
                return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
            }

            return NextResponse.json({ success: true, treasury: result.balance });
        }

        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    } catch (error) {
        console.error("[internal/faction/treasury] Error:", error);
        return NextResponse.json({ error: "treasury_failed" }, { status: 500 });
    }
}
