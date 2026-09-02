// src/core/lib/factionTreasury.ts
import { db } from "@/core/database";
import { factions, factionLedger, gameNicknames } from "@/core/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const LEDGER_KINDS = [
    "task",
    "donation",
    "entry_toll",
    "boost",
    "grant",
    "quest",
    "turret",
    "war_stake",
    "war_indemnity",
    "war_penalty",
    "admin",
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface TreasuryDelta {
    ash?: number;
    companionFragments?: number;
    cosmeticFragments?: number;
}

export interface TreasuryBalance {
    ash: number;
    companionFragments: number;
    cosmeticFragments: number;
}

export interface LedgerRow {
    id: string;
    kind: string;
    ash: number;
    companionFragments: number;
    cosmeticFragments: number;
    note: string | null;
    nickname: string | null;
    createdAt: Date;
}

function clean(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

export async function moveTreasury(
    factionId: string,
    gameId: string,
    kind: LedgerKind,
    delta: TreasuryDelta,
    options: { userId?: string | null; note?: string | null } = {}
): Promise<{ ok: true; balance: TreasuryBalance } | { ok: false; error: "insufficient" | "not_found" }> {
    const ash = clean(delta.ash);
    const companionFragments = clean(delta.companionFragments);
    const cosmeticFragments = clean(delta.cosmeticFragments);

    if (ash === 0 && companionFragments === 0 && cosmeticFragments === 0) {
        const current = await getTreasury(factionId);
        if (!current) return { ok: false, error: "not_found" };
        return { ok: true, balance: current };
    }

    const [updated] = await db
        .update(factions)
        .set({
            treasuryAsh: sql`${factions.treasuryAsh} + ${ash}`,
            treasuryCompanionFragments: sql`${factions.treasuryCompanionFragments} + ${companionFragments}`,
            treasuryCosmeticFragments: sql`${factions.treasuryCosmeticFragments} + ${cosmeticFragments}`,
        })
        .where(and(
            eq(factions.id, factionId),
            sql`${factions.treasuryAsh} + ${ash} >= 0`,
            sql`${factions.treasuryCompanionFragments} + ${companionFragments} >= 0`,
            sql`${factions.treasuryCosmeticFragments} + ${cosmeticFragments} >= 0`
        ))
        .returning();

    if (!updated) {
        const exists = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        return { ok: false, error: exists ? "insufficient" : "not_found" };
    }

    await db.insert(factionLedger).values({
        factionId,
        gameId,
        kind,
        ash,
        companionFragments,
        cosmeticFragments,
        userId: options.userId ?? null,
        note: options.note ? options.note.slice(0, 120) : null,
    });

    return {
        ok: true,
        balance: {
            ash: updated.treasuryAsh,
            companionFragments: updated.treasuryCompanionFragments,
            cosmeticFragments: updated.treasuryCosmeticFragments,
        },
    };
}

export async function drainTreasury(
    factionId: string,
    gameId: string,
    kind: LedgerKind,
    options: { userId?: string | null; note?: string | null } = {}
): Promise<{ ok: true; taken: TreasuryBalance } | { ok: false; error: "not_found" }> {
    const result = await db.execute(sql`
        WITH prev AS (
            SELECT id, treasury_ash, treasury_companion_fragments, treasury_cosmetic_fragments
            FROM factions WHERE id = ${factionId} FOR UPDATE
        )
        UPDATE factions SET
            treasury_ash = 0,
            treasury_companion_fragments = 0,
            treasury_cosmetic_fragments = 0
        FROM prev
        WHERE factions.id = prev.id
        RETURNING
            prev.treasury_ash AS ash,
            prev.treasury_companion_fragments AS companion_fragments,
            prev.treasury_cosmetic_fragments AS cosmetic_fragments
    `);

    const row = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows?.[0]
        ?? (Array.isArray(result) ? (result as Array<Record<string, unknown>>)[0] : undefined);

    if (!row) return { ok: false, error: "not_found" };

    const taken: TreasuryBalance = {
        ash: clean(row.ash),
        companionFragments: clean(row.companion_fragments),
        cosmeticFragments: clean(row.cosmetic_fragments),
    };

    if (taken.ash > 0 || taken.companionFragments > 0 || taken.cosmeticFragments > 0) {
        await db.insert(factionLedger).values({
            factionId,
            gameId,
            kind,
            ash: -taken.ash,
            companionFragments: -taken.companionFragments,
            cosmeticFragments: -taken.cosmeticFragments,
            userId: options.userId ?? null,
            note: options.note ? options.note.slice(0, 120) : null,
        });
    }

    return { ok: true, taken };
}

export async function getTreasury(factionId: string): Promise<TreasuryBalance | null> {
    const row = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
    if (!row) return null;

    return {
        ash: row.treasuryAsh,
        companionFragments: row.treasuryCompanionFragments,
        cosmeticFragments: row.treasuryCosmeticFragments,
    };
}

export async function getLedger(factionId: string, gameId: string, limit = 25): Promise<LedgerRow[]> {
    const rows = await db
        .select({
            id: factionLedger.id,
            kind: factionLedger.kind,
            ash: factionLedger.ash,
            companionFragments: factionLedger.companionFragments,
            cosmeticFragments: factionLedger.cosmeticFragments,
            note: factionLedger.note,
            createdAt: factionLedger.createdAt,
            nickname: gameNicknames.nickname,
        })
        .from(factionLedger)
        .leftJoin(
            gameNicknames,
            and(eq(gameNicknames.userId, factionLedger.userId), eq(gameNicknames.gameId, gameId))
        )
        .where(eq(factionLedger.factionId, factionId))
        .orderBy(desc(factionLedger.createdAt))
        .limit(Math.max(1, Math.min(100, limit)));

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        ash: row.ash,
        companionFragments: row.companionFragments,
        cosmeticFragments: row.cosmeticFragments,
        note: row.note,
        nickname: row.nickname ?? null,
        createdAt: row.createdAt,
    }));
}
