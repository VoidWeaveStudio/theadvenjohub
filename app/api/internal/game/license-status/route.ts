// app/api/internal/game/license-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameLicenses, factionMembers, factions } from "@/core/database/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getTokenBalance } from "@/core/blockchain";

// Polled every ~8s by game-server for connected players so a game license
// granted via a faction promo code is revoked live (mid-session) the moment
// the player leaves the granting faction or loses its token — mirrors the
// existing mute-status/skin-status live-refresh pattern. Only ever touches
// promo-derived licenses; normal purchases are never revoked here.
export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userIds, gameId } = body;

        if (!Array.isArray(userIds) || userIds.length === 0 || !gameId) {
            return NextResponse.json({ revoked: [] });
        }

        // Cheap DB pre-filter: only players with an active promo-granted
        // license even need the (comparatively expensive) RPC balance check.
        const promoLicenses = await db
            .select({
                id: gameLicenses.id,
                userId: gameLicenses.userId,
                wallet: gameLicenses.wallet,
                factionId: gameLicenses.grantedViaPromoFactionId,
            })
            .from(gameLicenses)
            .where(and(
                inArray(gameLicenses.userId, userIds.slice(0, 500)),
                eq(gameLicenses.gameId, gameId),
                eq(gameLicenses.isActive, true),
                isNotNull(gameLicenses.grantedViaPromoFactionId),
            ));

        if (promoLicenses.length === 0) {
            return NextResponse.json({ revoked: [] });
        }

        const factionIds = [...new Set(promoLicenses.map((l) => l.factionId!))];
        const [relevantFactions, memberships] = await Promise.all([
            db.query.factions.findMany({ where: inArray(factions.id, factionIds) }),
            db.query.factionMembers.findMany({
                where: and(
                    inArray(factionMembers.userId, promoLicenses.map((l) => l.userId)),
                    inArray(factionMembers.factionId, factionIds),
                ),
            }),
        ]);
        const factionById = new Map(relevantFactions.map((f) => [f.id, f]));
        const memberSet = new Set(memberships.map((m) => `${m.userId}:${m.factionId}`));

        const checks = await Promise.allSettled(promoLicenses.map(async (lic) => {
            const stillMember = memberSet.has(`${lic.userId}:${lic.factionId}`);
            if (!stillMember) return { lic, revoke: true };

            const faction = factionById.get(lic.factionId!);
            if (!faction?.tokenCa) return { lic, revoke: false };

            const balance = await getTokenBalance(lic.wallet, faction.tokenCa);
            return { lic, revoke: balance <= 0 };
        }));

        const toRevoke: string[] = [];
        const revokedUserIds: string[] = [];
        for (const result of checks) {
            if (result.status === "rejected") {
                // RPC failed — fail-open (same as verify-memberships): a transient
                // provider hiccup shouldn't instantly kick an active session,
                // it'll be re-checked on the next 8s tick.
                console.warn("[license-status] balance check failed, skipping (fail-open):", result.reason?.message || result.reason);
                continue;
            }
            if (!result.value.revoke) continue;
            toRevoke.push(result.value.lic.id);
            revokedUserIds.push(result.value.lic.userId);
        }

        if (toRevoke.length > 0) {
            await db.update(gameLicenses).set({ isActive: false }).where(inArray(gameLicenses.id, toRevoke));
        }

        return NextResponse.json({ revoked: revokedUserIds });
    } catch (error) {
        console.error("[internal/license-status] Error:", error);
        return NextResponse.json({ revoked: [] }, { status: 500 });
    }
}
