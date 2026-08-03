// app/api/admin/factions/[factionId]/promo-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generatePromoCode } from "@/core/lib/promoCode";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ factionId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { factionId } = await params;
        const body = await req.json();

        const sigError = verifyAdminAction(req, body, "grantPromoCode", factionId);
        if (sigError) return sigError;

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }
        if (faction.promoCode) {
            return NextResponse.json({ error: "already_granted", promoCode: faction.promoCode }, { status: 409 });
        }

        let savedCode: string | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generatePromoCode();
            try {
                const [updated] = await db.update(factions)
                    .set({ promoCode: candidate, promoCodePurchasedAt: new Date() })
                    .where(and(eq(factions.id, factionId), isNull(factions.promoCode)))
                    .returning();

                if (updated) {
                    savedCode = updated.promoCode;
                    break;
                }

                return NextResponse.json({ error: "already_granted" }, { status: 409 });
            } catch (err: any) {
                if (err?.code === "23505") continue;
                throw err;
            }
        }

        if (!savedCode) {
            console.error("[admin/factions/:factionId/promo-code] Exhausted promo code generation attempts", { factionId });
            return NextResponse.json({ error: "promo_code_generation_failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, promoCode: savedCode });
    } catch (error) {
        console.error("[admin/factions/:factionId/promo-code] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
