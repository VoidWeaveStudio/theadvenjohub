// src/core/lib/factionWar.ts
export const WAR_MIN_LEVEL = 5;
export const WAR_STAKE_ASH = 25_000;
export const WAR_INDEMNITY_ASH = 40_000;
export const WAR_WITHDRAWAL_MULT = 1.5;
export const WAR_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export const WAR_NEUTRALITY_ASH = 5_000;

export const WAR_HEART_MAX_HP = 5_000;
export const WAR_HEART_REGEN_PER_SEC = 60;
export const WAR_HEART_REGEN_DELAY_MS = 8_000;

export const WAR_STATUSES = ["active", "won_declarer", "won_defender", "settled"] as const;
export type WarStatus = (typeof WAR_STATUSES)[number];

export const WAR_END_REASONS = ["heart", "capitulation", "indemnity", "withdrawal", "admin"] as const;
export type WarEndReason = (typeof WAR_END_REASONS)[number];

export interface WarRow {
    id: string;
    gameId: string;
    declarerFactionId: string;
    defenderFactionId: string;
    status: string;
    stakeAsh: number;
    declarerHeartHp: number;
    defenderHeartHp: number;
    heartMaxHp: number;
    winnerFactionId: string | null;
    endedBy: string | null;
    declaredAt: Date;
    endedAt: Date | null;
}

export interface WarSummary {
    id: string;
    declarerFactionId: string;
    defenderFactionId: string;
    declarerName: string | null;
    defenderName: string | null;
    declarerImage: string | null;
    defenderImage: string | null;
    status: string;
    stakeAsh: number;
    declarerHeartHp: number;
    defenderHeartHp: number;
    heartMaxHp: number;
    winnerFactionId: string | null;
    endedBy: string | null;
    declaredAt: number;
    endedAt: number | null;
}

export function isDeclarer(war: { declarerFactionId: string }, factionId: string): boolean {
    return war.declarerFactionId === factionId;
}

export function opponentOf(
    war: { declarerFactionId: string; defenderFactionId: string },
    factionId: string
): string | null {
    if (war.declarerFactionId === factionId) return war.defenderFactionId;
    if (war.defenderFactionId === factionId) return war.declarerFactionId;
    return null;
}

export function isParticipant(
    war: { declarerFactionId: string; defenderFactionId: string },
    factionId: string
): boolean {
    return war.declarerFactionId === factionId || war.defenderFactionId === factionId;
}

export function exitPriceFor(war: { declarerFactionId: string }, factionId: string): number {
    return isDeclarer(war, factionId)
        ? Math.round(WAR_INDEMNITY_ASH * WAR_WITHDRAWAL_MULT)
        : WAR_INDEMNITY_ASH;
}

export function statusForWinner(
    war: { declarerFactionId: string; defenderFactionId: string },
    winnerFactionId: string
): WarStatus {
    return winnerFactionId === war.declarerFactionId ? "won_declarer" : "won_defender";
}

export function heartHpOf(
    war: { declarerFactionId: string; declarerHeartHp: number; defenderHeartHp: number },
    factionId: string
): number {
    return isDeclarer(war, factionId) ? war.declarerHeartHp : war.defenderHeartHp;
}
