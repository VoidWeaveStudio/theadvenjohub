// app/api/admin/factions/[factionId]/perks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factions, factionGates } from "@/core/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { generatePromoCode } from "@/core/lib/promoCode";
import { xpForLevel } from "@/core/lib/factionLeveling";

const ACTIONS = ["grantPromo", "revokePromo", "grantGate", "revokeGate", "setLevel", "setRoomAccess", "clearTask"] as const;
type PerkAction = (typeof ACTIONS)[number];

const MAX_FACTION_LEVEL = 100;

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ factionId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { factionId } = await params;
        const body = await req.json();
        const action: PerkAction | null = ACTIONS.includes(body.action) ? body.action : null;

        if (!action) {
            return NextResponse.json({ error: "invalid_action" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, `faction_${action}`, factionId);
        if (sigError) return sigError;

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        if (action === "grantPromo") {
            if (faction.promoCode) {
                return NextResponse.json({ error: "already_granted", promoCode: faction.promoCode }, { status: 409 });
            }

            for (let attempt = 0; attempt < 5; attempt++) {
                const candidate = generatePromoCode();
                try {
                    const [updated] = await db
                        .update(factions)
                        .set({ promoCode: candidate, promoCodePurchasedAt: new Date() })
                        .where(and(eq(factions.id, factionId), isNull(factions.promoCode)))
                        .returning();

                    if (updated) {
                        return NextResponse.json({ success: true, promoCode: updated.promoCode });
                    }
                    return NextResponse.json({ error: "already_granted" }, { status: 409 });
                } catch (err: any) {
                    if (err?.code === "23505") continue;
                    throw err;
                }
            }

            return NextResponse.json({ error: "promo_code_generation_failed" }, { status: 500 });
        }

        if (action === "revokePromo") {
            await db
                .update(factions)
                .set({ promoCode: null, promoCodePurchaseTx: null, promoCodePurchasedAt: null })
                .where(eq(factions.id, factionId));
            return NextResponse.json({ success: true, promoCode: null });
        }

        if (action === "grantGate") {
            const existing = await db.query.factionGates.findFirst({ where: eq(factionGates.factionId, factionId) });
            if (existing) {
                return NextResponse.json({ error: "already_granted" }, { status: 409 });
            }

            try {
                const [created] = await db.insert(factionGates).values({ factionId, purchaseTx: null }).returning();
                return NextResponse.json({ success: true, gate: { id: created.id, purchasedAt: created.purchasedAt } });
            } catch (insertError: any) {
                if (insertError?.code === "23505") {
                    return NextResponse.json({ error: "already_granted" }, { status: 409 });
                }
                throw insertError;
            }
        }

        if (action === "revokeGate") {
            await db.delete(factionGates).where(eq(factionGates.factionId, factionId));
            return NextResponse.json({ success: true, hasGate: false });
        }

        if (action === "setLevel") {
            const level = Math.floor(Number(body.level));
            if (!Number.isFinite(level) || level < 1 || level > MAX_FACTION_LEVEL) {
                return NextResponse.json({ error: "invalid_level" }, { status: 400 });
            }

            const rawProgress = Math.floor(Number(body.levelProgressAsh) || 0);
            const progress = Math.max(0, Math.min(rawProgress, Math.max(0, xpForLevel(level) - 1)));

            await db
                .update(factions)
                .set({ level, levelProgressAsh: progress })
                .where(eq(factions.id, factionId));

            return NextResponse.json({ success: true, level, levelProgressAsh: progress, xpForNextLevel: xpForLevel(level) });
        }

        await db
            .update(factions)
            .set({
                activeTaskKey: null,
                activeTaskTarget: null,
                activeTaskProgress: 0,
                activeTaskRewardAsh: null,
                activeTaskAcceptedAt: null,
                activeTaskAcceptedByUserId: null,
            })
            .where(eq(factions.id, factionId));

        return NextResponse.json({ success: true, activeTask: null });
    } catch (error) {
        console.error("[admin/factions/:factionId/perks] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
