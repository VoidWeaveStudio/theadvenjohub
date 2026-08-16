// src/features/game/data/skills.ts
import catalog from "./skills.catalog.json";
import { BranchId } from "./progression";

export type SkillKind = "passive" | "active" | "mode" | "trigger";
export type StatOp = "add" | "addPercent" | "set";
export type CastType = "self" | "ground" | "target" | "projectile";

export interface SkillEffect {
    stat: string;
    op: StatOp;
    perRank: number[];
}

export interface SkillAbility {
    id: string;
    castType: CastType;
    cooldownMs: number;
    energyCost: number;
    durationMs?: number;
    params: Record<string, number | boolean | string>;
}

export interface SkillMode {
    id: string;
    name: string;
    [key: string]: number | string;
}

export interface SkillTrigger {
    id: string;
    cooldownMs: number;
    pvpCooldownMs: number;
    params: Record<string, number>;
}

export interface SkillNode {
    id: string;
    column: string;
    row: number;
    name: string;
    description: string;
    kind: SkillKind;
    maxRank: number;
    capstone?: boolean;
    requires: { level: number; columnPoints: number };
    effects?: SkillEffect[];
    ability?: SkillAbility;
    mode?: SkillMode;
    trigger?: SkillTrigger;
}

export interface SkillColumn {
    id: string;
    branch: BranchId | "core";
    name: string;
    description: string;
}

export type SkillRanks = Record<string, number>;

export const SKILL_COLUMNS = catalog.columns as SkillColumn[];
export const SKILL_NODES = catalog.nodes as SkillNode[];
export const CAPSTONE_COLUMN_POINTS: number = catalog.capstoneColumnPoints;

export const COLUMNS_BY_ID = new Map(SKILL_COLUMNS.map((c) => [c.id, c]));
export const NODES_BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));

export function branchOfColumn(columnId: string): BranchId | "core" | null {
    return COLUMNS_BY_ID.get(columnId)?.branch ?? null;
}

export function columnsForBranch(branch: BranchId): SkillColumn[] {
    return SKILL_COLUMNS.filter((c) => c.branch === branch || c.branch === "core");
}

export function nodesForColumn(columnId: string): SkillNode[] {
    return SKILL_NODES.filter((n) => n.column === columnId).sort((a, b) => a.row - b.row);
}

export function pointsSpent(ranks: SkillRanks): number {
    let total = 0;
    for (const [id, rank] of Object.entries(ranks)) {
        const node = NODES_BY_ID.get(id);
        if (!node) continue;
        total += Math.max(0, Math.min(node.maxRank, rank));
    }
    return total;
}

export function columnPoints(ranks: SkillRanks, columnId: string): number {
    let total = 0;
    for (const [id, rank] of Object.entries(ranks)) {
        const node = NODES_BY_ID.get(id);
        if (!node || node.column !== columnId) continue;
        total += Math.max(0, Math.min(node.maxRank, rank));
    }
    return total;
}

export type LearnRejection =
    | "unknown_node"
    | "wrong_branch"
    | "max_rank"
    | "level_too_low"
    | "column_points_too_low"
    | "no_points";

export interface LearnCheck {
    ok: boolean;
    reason?: LearnRejection;
}

export function canLearn(
    nodeId: string,
    state: { level: number; branch: BranchId | null; ranks: SkillRanks; availablePoints: number }
): LearnCheck {
    const node = NODES_BY_ID.get(nodeId);
    if (!node) return { ok: false, reason: "unknown_node" };

    const nodeBranch = branchOfColumn(node.column);
    if (nodeBranch !== "core" && nodeBranch !== state.branch) {
        return { ok: false, reason: "wrong_branch" };
    }

    const rank = state.ranks[nodeId] ?? 0;
    if (rank >= node.maxRank) return { ok: false, reason: "max_rank" };
    if (state.level < node.requires.level) return { ok: false, reason: "level_too_low" };
    if (columnPoints(state.ranks, node.column) < node.requires.columnPoints) {
        return { ok: false, reason: "column_points_too_low" };
    }
    if (state.availablePoints < 1) return { ok: false, reason: "no_points" };

    return { ok: true };
}

export interface BuildStats {
    add: Record<string, number>;
    percent: Record<string, number>;
    set: Record<string, number>;
}

export function computeBuildStats(ranks: SkillRanks): BuildStats {
    const stats: BuildStats = { add: {}, percent: {}, set: {} };

    for (const [id, rawRank] of Object.entries(ranks)) {
        const node = NODES_BY_ID.get(id);
        if (!node || !node.effects) continue;

        const rank = Math.max(0, Math.min(node.maxRank, rawRank));
        if (rank <= 0) continue;

        for (const effect of node.effects) {
            const value = effect.perRank[rank - 1];
            if (typeof value !== "number") continue;

            if (effect.op === "add") {
                stats.add[effect.stat] = (stats.add[effect.stat] ?? 0) + value;
            } else if (effect.op === "addPercent") {
                stats.percent[effect.stat] = (stats.percent[effect.stat] ?? 0) + value;
            } else {
                stats.set[effect.stat] = value;
            }
        }
    }

    return stats;
}

export function statValue(stats: BuildStats, key: string, base: number): number {
    const added = base + (stats.add[key] ?? 0);
    const percent = stats.percent[key] ?? 0;
    return added * (1 + percent / 100);
}

export function unlockedAbilities(ranks: SkillRanks): SkillAbility[] {
    return SKILL_NODES.filter((n) => n.ability && (ranks[n.id] ?? 0) > 0).map((n) => n.ability!);
}

export function unlockedModes(ranks: SkillRanks): SkillMode[] {
    return SKILL_NODES.filter((n) => n.mode && (ranks[n.id] ?? 0) > 0).map((n) => n.mode!);
}

export function unlockedTriggers(ranks: SkillRanks): SkillTrigger[] {
    return SKILL_NODES.filter((n) => n.trigger && (ranks[n.id] ?? 0) > 0).map((n) => n.trigger!);
}

export function sanitizeRanks(raw: unknown, branch: BranchId | null): SkillRanks {
    if (!raw || typeof raw !== "object") return {};
    const ranks: SkillRanks = {};

    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        const node = NODES_BY_ID.get(id);
        if (!node) continue;

        const nodeBranch = branchOfColumn(node.column);
        if (nodeBranch !== "core" && nodeBranch !== branch) continue;

        const rank = Math.floor(Number(value));
        if (!Number.isFinite(rank) || rank <= 0) continue;

        ranks[id] = Math.min(node.maxRank, rank);
    }

    return ranks;
}
