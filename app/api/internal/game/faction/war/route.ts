// app/api/internal/game/faction/war/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers, factionWars, factions } from "@/core/database/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { moveTreasury, drainTreasury } from "@/core/lib/factionTreasury";
import { hasFactionPermission, isFactionHead, FACTION_PERM_WAR } from "@/core/lib/factionPermissions";
import {
    WAR_MIN_LEVEL,
    WAR_STAKE_ASH,
    WAR_COOLDOWN_MS,
    WAR_HEART_MAX_HP,
    exitPriceFor,
    isParticipant,
    opponentOf,
    statusForWinner,
    WarEndReason,
    WarSummary,
} from "@/core/lib/factionWar";

type WarRecord = typeof factionWars.$inferSelect;

async function summarize(rows: WarRecord[]): Promise<WarSummary[]> {
    if (rows.length === 0) return [];

    const ids = Array.from(new Set(rows.flatMap((row) => [row.declarerFactionId, row.defenderFactionId])));
    const sides = await db
        .select({ id: factions.id, name: factions.name, image: factions.image })
        .from(factions)
        .where(inArray(factions.id, ids));

    const byId = new Map(sides.map((side) => [side.id, side]));

    return rows.map((row) => ({
        id: row.id,
        declarerFactionId: row.declarerFactionId,
        defenderFactionId: row.defenderFactionId,
        declarerName: byId.get(row.declarerFactionId)?.name ?? null,
        defenderName: byId.get(row.defenderFactionId)?.name ?? null,
        declarerImage: byId.get(row.declarerFactionId)?.image ?? null,
        defenderImage: byId.get(row.defenderFactionId)?.image ?? null,
        status: row.status,
        stakeAsh: row.stakeAsh,
        declarerHeartHp: row.declarerHeartHp,
        defenderHeartHp: row.defenderHeartHp,
        heartMaxHp: row.heartMaxHp,
        winnerFactionId: row.winnerFactionId,
        endedBy: row.endedBy,
        declaredAt: row.declaredAt.getTime(),
        endedAt: row.endedAt?.getTime() ?? null,
    }));
}

async function activeWarsFor(gameId: string, factionId?: string): Promise<WarRecord[]> {
    const where = factionId
        ? and(
            eq(factionWars.gameId, gameId),
            eq(factionWars.status, "active"),
            or(eq(factionWars.declarerFactionId, factionId), eq(factionWars.defenderFactionId, factionId))
        )
        : and(eq(factionWars.gameId, gameId), eq(factionWars.status, "active"));

    return db.select().from(factionWars).where(where);
}

async function awardSpoils(
    war: WarRecord,
    winnerFactionId: string,
    loserFactionId: string,
    reason: WarEndReason
) {
    const spoils = await drainTreasury(loserFactionId, war.gameId, "war_indemnity", {
        note: `lost:${reason}`,
    });

    const ash = (spoils.ok ? spoils.taken.ash : 0) + war.stakeAsh;
    const companionFragments = spoils.ok ? spoils.taken.companionFragments : 0;
    const cosmeticFragments = spoils.ok ? spoils.taken.cosmeticFragments : 0;

    if (ash > 0 || companionFragments > 0 || cosmeticFragments > 0) {
        await moveTreasury(
            winnerFactionId,
            war.gameId,
            "war_indemnity",
            { ash, companionFragments, cosmeticFragments },
            { note: `won:${reason}` }
        );
    }

    return { ash, companionFragments, cosmeticFragments };
}

async function closeWar(
    war: WarRecord,
    winnerFactionId: string | null,
    reason: WarEndReason
) {
    const cooldownUntil = new Date(Date.now() + WAR_COOLDOWN_MS);

    await db
        .update(factionWars)
        .set({
            status: winnerFactionId ? statusForWinner(war, winnerFactionId) : "settled",
            winnerFactionId,
            endedBy: reason,
            endedAt: new Date(),
        })
        .where(and(eq(factionWars.id, war.id), eq(factionWars.status, "active")));

    await db
        .update(factions)
        .set({ warCooldownUntil: cooldownUntil })
        .where(inArray(factions.id, [war.declarerFactionId, war.defenderFactionId]));
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { action, gameId } = body;

        if (typeof gameId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        if (action === "list") {
            const factionId = typeof body.factionId === "string" ? body.factionId : undefined;
            const rows = await activeWarsFor(gameId, factionId);
            return NextResponse.json({ success: true, wars: await summarize(rows) });
        }

        const { factionId, userId } = body;
        if (typeof factionId !== "string" || typeof userId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        if (action === "declare") {
            const targetFactionId = body.targetFactionId;
            if (typeof targetFactionId !== "string" || targetFactionId === factionId) {
                return NextResponse.json({ error: "bad_target" }, { status: 400 });
            }

            const [mine, theirs] = await Promise.all([
                db.query.factions.findFirst({ where: eq(factions.id, factionId) }),
                db.query.factions.findFirst({ where: eq(factions.id, targetFactionId) }),
            ]);

            if (!mine || !theirs) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });

            const membership = await db.query.factionMembers.findFirst({
                where: and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId)),
            });
            if (!membership) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

            if (!hasFactionPermission(mine, userId, membership.permissions ?? 0, FACTION_PERM_WAR)) {
                return NextResponse.json({ error: "no_war_access" }, { status: 403 });
            }

            if (mine.level < WAR_MIN_LEVEL || theirs.level < WAR_MIN_LEVEL) {
                return NextResponse.json({ error: "level_too_low" }, { status: 409 });
            }

            const now = Date.now();
            if (
                (mine.warCooldownUntil && mine.warCooldownUntil.getTime() > now) ||
                (theirs.warCooldownUntil && theirs.warCooldownUntil.getTime() > now)
            ) {
                return NextResponse.json({ error: "on_cooldown" }, { status: 409 });
            }

            const busy = await activeWarsFor(gameId);
            if (busy.some((war) => isParticipant(war, factionId) || isParticipant(war, targetFactionId))) {
                return NextResponse.json({ error: "already_at_war" }, { status: 409 });
            }

            const stake = await moveTreasury(factionId, gameId, "war_stake", { ash: -WAR_STAKE_ASH }, {
                userId,
                note: `declare:${targetFactionId.slice(0, 8)}`,
            });

            if (!stake.ok) {
                return NextResponse.json({ error: stake.error }, { status: stake.error === "not_found" ? 404 : 409 });
            }

            const [created] = await db
                .insert(factionWars)
                .values({
                    gameId,
                    declarerFactionId: factionId,
                    defenderFactionId: targetFactionId,
                    status: "active",
                    stakeAsh: WAR_STAKE_ASH,
                    declarerHeartHp: WAR_HEART_MAX_HP,
                    defenderHeartHp: WAR_HEART_MAX_HP,
                    heartMaxHp: WAR_HEART_MAX_HP,
                    declaredByUserId: userId,
                })
                .returning();

            return NextResponse.json({
                success: true,
                war: (await summarize([created]))[0],
                treasury: stake.balance,
            });
        }

        const warId = body.warId;
        if (typeof warId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const war = await db.query.factionWars.findFirst({ where: eq(factionWars.id, warId) });
        if (!war) return NextResponse.json({ error: "war_not_found" }, { status: 404 });
        if (war.status !== "active") return NextResponse.json({ error: "war_over" }, { status: 409 });
        if (!isParticipant(war, factionId)) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

        const enemyFactionId = opponentOf(war, factionId);
        if (!enemyFactionId) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

        if (action === "heartDamage") {
            const damage = Math.max(
                -WAR_HEART_MAX_HP,
                Math.min(WAR_HEART_MAX_HP, Math.trunc(Number(body.damage)) || 0)
            );
            if (damage === 0) return NextResponse.json({ error: "no_damage" }, { status: 400 });

            const enemyIsDeclarer = war.declarerFactionId === enemyFactionId;
            const column = enemyIsDeclarer ? factionWars.declarerHeartHp : factionWars.defenderHeartHp;

            const [updated] = await db
                .update(factionWars)
                .set({
                    [enemyIsDeclarer ? "declarerHeartHp" : "defenderHeartHp"]:
                        sql`LEAST(${factionWars.heartMaxHp}, GREATEST(0, ${column} - ${damage}))`,
                })
                .where(and(eq(factionWars.id, warId), eq(factionWars.status, "active")))
                .returning();

            if (!updated) return NextResponse.json({ error: "war_over" }, { status: 409 });

            const enemyHp = enemyIsDeclarer ? updated.declarerHeartHp : updated.defenderHeartHp;

            if (enemyHp > 0 || damage <= 0) {
                return NextResponse.json({ success: true, war: (await summarize([updated]))[0] });
            }

            await closeWar(updated, factionId, "heart");
            const spoils = await awardSpoils(updated, factionId, enemyFactionId, "heart");
            const finished = await db.query.factionWars.findFirst({ where: eq(factionWars.id, warId) });

            return NextResponse.json({
                success: true,
                war: finished ? (await summarize([finished]))[0] : null,
                winnerFactionId: factionId,
                spoils,
            });
        }

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        if (!isFactionHead(faction, userId)) return NextResponse.json({ error: "head_only" }, { status: 403 });

        if (action === "capitulate") {
            await closeWar(war, enemyFactionId, "capitulation");
            const spoils = await awardSpoils(war, enemyFactionId, factionId, "capitulation");
            const finished = await db.query.factionWars.findFirst({ where: eq(factionWars.id, warId) });

            return NextResponse.json({
                success: true,
                war: finished ? (await summarize([finished]))[0] : null,
                winnerFactionId: enemyFactionId,
                spoils,
            });
        }

        if (action === "settle") {
            const price = exitPriceFor(war, factionId);
            const paid = await moveTreasury(factionId, gameId, "war_penalty", { ash: -price }, {
                userId,
                note: "settle",
            });

            if (!paid.ok) {
                return NextResponse.json({ error: paid.error }, { status: paid.error === "not_found" ? 404 : 409 });
            }

            await moveTreasury(enemyFactionId, gameId, "war_indemnity", { ash: price + war.stakeAsh }, {
                note: "settled",
            });

            await closeWar(war, null, "indemnity");
            const finished = await db.query.factionWars.findFirst({ where: eq(factionWars.id, warId) });

            return NextResponse.json({
                success: true,
                war: finished ? (await summarize([finished]))[0] : null,
                treasury: paid.balance,
                paid: price,
            });
        }

        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    } catch (error) {
        console.error("[internal/faction/war] Error:", error);
        return NextResponse.json({ error: "war_failed" }, { status: 500 });
    }
}
