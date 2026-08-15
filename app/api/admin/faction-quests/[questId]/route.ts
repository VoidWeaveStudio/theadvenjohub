// app/api/admin/faction-quests/[questId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factionQuests } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ questId: string }> }) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { questId } = await params;
        const body = await req.json().catch(() => ({}));

        const sigError = await verifyAdminAction(req, body, "faction_quest_delete", questId);
        if (sigError) return sigError;

        const quest = await db.query.factionQuests.findFirst({ where: eq(factionQuests.id, questId) });
        if (!quest) {
            return NextResponse.json({ error: "quest_not_found" }, { status: 404 });
        }

        await db.delete(factionQuests).where(eq(factionQuests.id, questId));

        return NextResponse.json({
            success: true,
            questId,
            refundedBankAsh: Math.max(0, quest.bankAsh - quest.paidOutAsh),
        });
    } catch (error) {
        console.error("[admin/faction-quests/delete] Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
