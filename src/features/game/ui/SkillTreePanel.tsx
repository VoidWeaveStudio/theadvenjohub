// src/features/game/ui/SkillTreePanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Crosshair, HeartPulse, Lock, Plus, TrendingUp, Zap } from "lucide-react";
import { ProgressionStateData } from "../network/NetworkManager";
import { BRANCHES, TIERS, MEME_ABILITIES_BY_ID } from "../data/progression";
import { SkillNode, columnsForBranch, nodesForColumn, columnPoints, canLearn, NODES_BY_ID } from "../data/skills";
import { ABILITY_SLOTS, ABILITY_SLOT_KEYS, AbilitySlot } from "./AbilityBar";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { Translate } from "@/core/i18n/types";

interface SkillTreePanelProps {
    active: boolean;
    progression: ProgressionStateData | null;
    onLearn: (nodeId: string) => void;
    onBind: (slot: string, abilityId: string | null) => void;
    onOpenSpecialization: () => void;
}

const STAT_LABELS: Record<string, string> = {
    maxHealth: "g.stat.maxHealth",
    maxEnergy: "g.stat.maxEnergy",
    energyRegen: "g.stat.energyRegen",
    moveSpeed: "g.stat.moveSpeed",
    lootBonus: "g.stat.lootBonus",
    damageTaken: "g.stat.damageTaken",
    weaponDamage: "g.stat.weaponDamage",
    spellDamage: "g.stat.spellDamage",
    magSize: "g.stat.magSize",
    armorPen: "g.stat.armorPen",
    damageVsUnshielded: "g.stat.damageVsUnshielded",
    reloadSpeed: "g.stat.reloadSpeed",
    healOnKill: "g.stat.healOnKill",
    energyOnKill: "g.stat.energyOnKill",
    shieldStrength: "g.stat.shieldStrength",
    aoeDamage: "g.stat.aoeDamage",
    aoeRadius: "g.stat.aoeRadius",
    zoneRadius: "g.stat.zoneRadius",
    zoneDuration: "g.stat.zoneDuration",
    zoneTickDamage: "g.stat.zoneTickDamage",
    controlCooldown: "g.stat.controlCooldown",
    supportCooldown: "g.stat.supportCooldown",
    postDashSpeed: "g.stat.postDashSpeed",
    postDashDamageTaken: "g.stat.postDashDamageTaken",
    lowHealthDamageTaken: "g.stat.lowHealthDamageTaken",
    dashCharges: "g.stat.dashCharges",
    grenadeCharges: "g.stat.grenadeCharges",
    projectileSpeed: "g.stat.projectileSpeed",
    manaCost: "g.stat.manaCost",
    bleedDamage: "g.stat.bleedDamage",
    burnDamage: "g.stat.burnDamage",
    healingPower: "g.stat.healingPower",
    allyDamageInZone: "g.stat.allyDamageInZone",
    markedAllyFireRate: "g.stat.markedAllyFireRate",
    ricochetChance: "g.stat.ricochetChance",
    ricochetDamage: "g.stat.ricochetDamage",
    clusterCount: "g.stat.clusterCount",
    clusterDamage: "g.stat.clusterDamage",
    explosiveDamage: "g.stat.explosiveDamage",
    explosiveRadius: "g.stat.explosiveRadius",
    explosiveEveryNthShot: "g.stat.explosiveEveryNthShot",
    postShieldRegen: "g.stat.postShieldRegen",
};

function statLabel(stat: string, t: Translate): string {
    const key = STAT_LABELS[stat];
    return key ? t(key) : stat.replace(/([A-Z])/g, " $1").toLowerCase();
}

function nodeIcon(node: SkillNode) {
    if (node.capstone) return Crown;
    if (node.kind === "active") return Zap;
    if (node.kind === "mode") return Crosshair;
    if (node.kind === "trigger") return HeartPulse;
    return TrendingUp;
}

function nodeKindLabel(node: SkillNode): string {
    if (node.capstone) return "g.skill.ultimate";
    if (node.kind === "active") return "g.skill.active";
    if (node.kind === "mode") return "g.skill.weaponMode";
    if (node.kind === "trigger") return "g.skill.triggered";
    return "g.skill.passive";
}

function formatEffect(stat: string, op: string, value: number, t: Translate): string {
    const label = statLabel(stat, t);
    const signed = `${value > 0 ? "+" : ""}${value}`;
    if (op === "addPercent") return t("g.skill.effect.percent", { value: signed, label });
    if (op === "add") return t("g.skill.effect.flat", { value: signed, label });
    return t("g.skill.effect.set", { value, label });
}

export function SkillTreePanel({ active, progression, onLearn, onBind, onOpenSpecialization }: SkillTreePanelProps) {
    const { t } = useLanguage();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const branch = progression?.branch ?? null;
    const ranks = useMemo(() => progression?.skills ?? {}, [progression]);
    const level = progression?.level ?? 1;
    const available = progression?.skillPoints ?? 0;

    const columns = useMemo(() => (branch ? columnsForBranch(branch) : []), [branch]);
    const tier = TIERS.find((t) => t.id === progression?.tier);
    const branchInfo = BRANCHES.find((b) => b.id === branch);
    const accentBase = branchInfo?.accent ?? "#4FD1FF";

    useEffect(() => {
        if (!active) setSelectedId(null);
    }, [active]);

    useEffect(() => {
        if (!selectedId && columns.length > 0) {
            const first = nodesForColumn(columns[0].id)[0];
            if (first) setSelectedId(first.id);
        }
    }, [columns, selectedId]);

    const selected = selectedId ? NODES_BY_ID.get(selectedId) ?? null : null;
    const selectedRank = selected ? ranks[selected.id] ?? 0 : 0;
    const selectedCheck = selected && branch
        ? canLearn(selected.id, { level, branch, ranks, availablePoints: available })
        : null;
    const selectedColumn = selected ? columns.find((c) => c.id === selected.column) : null;
    const selectedAccent = selected?.capstone ? "#FFD166" : accentBase;

    return (
        !progression ? (
            <p className="text-[#8B8F98] text-sm text-center py-16">{t("g.skill.loading")}</p>
        ) : !branch ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Lock className="w-10 h-10 text-[#6B7280]" />
                <p className="text-[#8B8F98] text-sm text-center max-w-sm">
                    {progression.branchUnlocked
                        ? t("g.skill.pickSpec")
                        : t("g.skill.finishOrientation")}
                </p>
                {progression.branchUnlocked && (
                    <button
                        onClick={onOpenSpecialization}
                        className="bg-gradient-to-r from-[#4FD1FF] to-[#3BA9E8] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px]"
                    >
                        {t("g.skill.chooseSpec")}
                    </button>
                )}
            </div>
        ) : (
            <div className="flex flex-col h-full min-h-0 gap-3">
                <div
                    className="flex items-center justify-between rounded-[12px] border px-4 py-3 flex-shrink-0"
                    style={{
                        borderColor: `${accentBase}33`,
                        background: `linear-gradient(90deg, ${accentBase}18, rgba(0,0,0,0.15) 60%)`,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-3xl leading-none">{tier?.emoji}</span>
                        <div>
                            <div className="text-[#E5E7EB] text-base font-black tracking-wide leading-tight">
                                {branchInfo ? t(branchInfo.name) : ""}
                            </div>
                            <div className="text-[11px]" style={{ color: tier?.accent ?? "#8B8F98" }}>
                                {tier ? t(tier.name) : ""} · {t("g.skill.levelSuffix", { level })}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="text-right">
                            <div className="text-[#E5E7EB] text-sm font-bold leading-none">
                                {progression.memeAbilities.length}/{TIERS.length}
                            </div>
                            <div className="text-[#6B7280] text-[10px] tracking-wider">{t("g.wheel.degen")}</div>
                        </div>
                        <div
                            className="text-right rounded-[8px] px-3 py-1.5"
                            style={{ background: available > 0 ? "rgba(255,209,102,0.14)" : "transparent" }}
                        >
                            <div
                                className="text-xl font-black leading-none"
                                style={{ color: available > 0 ? "#FFD166" : "#6B7280" }}
                            >
                                {available}
                            </div>
                            <div className="text-[#6B7280] text-[10px] tracking-wider">{t("g.skill.points")}</div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 flex-1 min-h-0">
                    <div className="flex gap-2.5 flex-1 min-h-0 overflow-x-auto">
                        {columns.map((column) => {
                            const spent = columnPoints(ranks, column.id);
                            const nodes = nodesForColumn(column.id);
                            const isCore = column.branch === "core";

                            return (
                                <div
                                    key={column.id}
                                    className="game-skill-column flex flex-col min-w-[150px] flex-1 rounded-[12px] border border-white/8 bg-black/25 overflow-hidden"
                                >
                                    <div
                                        className="px-3 py-2 flex-shrink-0 border-b border-white/8"
                                        style={{ background: isCore ? "rgba(255,255,255,0.03)" : `${accentBase}0F` }}
                                    >
                                        <div className="text-[#E5E7EB] text-[11px] font-black tracking-wider uppercase">
                                            {t(column.name)}
                                        </div>
                                        <div className="text-[10px]" style={{ color: spent > 0 ? accentBase : "#6B7280" }}>
                                            {spent} invested
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0">
                                        {nodes.map((node, index) => {
                                            const rank = ranks[node.id] ?? 0;
                                            const maxed = rank >= node.maxRank;
                                            const check = canLearn(node.id, { level, branch, ranks, availablePoints: available });
                                            const affordable = check.ok;
                                            const locked = !affordable && !maxed;
                                            const accent = node.capstone ? "#FFD166" : accentBase;
                                            const isSelected = selectedId === node.id;
                                            const Icon = nodeIcon(node);

                                            return (
                                                <div key={node.id}>
                                                    {index > 0 && (
                                                        <div className="flex justify-center">
                                                            <div
                                                                className="w-[2px] h-2.5"
                                                                style={{ background: rank > 0 ? `${accent}55` : "rgba(255,255,255,0.07)" }}
                                                            />
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => setSelectedId(node.id)}
                                                        className="w-full flex items-center gap-2 rounded-[9px] border px-2 py-1.5 text-left transition-colors"
                                                        style={{
                                                            borderColor: isSelected
                                                                ? accent
                                                                : rank > 0
                                                                    ? `${accent}55`
                                                                    : affordable
                                                                        ? "rgba(255,255,255,0.22)"
                                                                        : "rgba(255,255,255,0.07)",
                                                            background: isSelected
                                                                ? `${accent}22`
                                                                : rank > 0
                                                                    ? `${accent}10`
                                                                    : "rgba(0,0,0,0.25)",
                                                            boxShadow: rank > 0 ? `0 0 12px ${accent}22` : "none",
                                                            opacity: locked ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <span
                                                            className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
                                                            style={{
                                                                background: rank > 0 ? `${accent}25` : "rgba(255,255,255,0.05)",
                                                                color: rank > 0 ? accent : locked ? "#6B7280" : "#E5E7EB",
                                                            }}
                                                        >
                                                            {locked && rank === 0 ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-4 h-4" />}
                                                        </span>

                                                        <span className="flex-1 min-w-0">
                                                            <span
                                                                className="block text-[11px] font-bold leading-tight truncate"
                                                                style={{ color: rank > 0 ? accent : "#E5E7EB" }}
                                                            >
                                                                {t(node.name)}
                                                            </span>
                                                            <span className="flex items-center gap-1 mt-0.5">
                                                                {Array.from({ length: node.maxRank }).map((_, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className="w-2.5 h-[3px] rounded-full"
                                                                        style={{ background: i < rank ? accent : "rgba(255,255,255,0.15)" }}
                                                                    />
                                                                ))}
                                                                {affordable && (
                                                                    <span className="text-[#FFD166] text-[9px] font-bold ml-0.5">+</span>
                                                                )}
                                                            </span>
                                                        </span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="game-skill-detail w-full max-w-[290px] flex-shrink-0 flex flex-col rounded-[12px] border border-white/8 bg-black/30 overflow-hidden">
                        {selected ? (
                            <div className="flex flex-col h-full min-h-0">
                                <div
                                    className="px-4 py-3 border-b border-white/8 flex-shrink-0"
                                    style={{ background: `${selectedAccent}12` }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="text-[#E5E7EB] text-sm font-black leading-tight">{t(selected.name)}</div>
                                        <span
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                            style={{ background: `${selectedAccent}22`, color: selectedAccent }}
                                        >
                                            {t(nodeKindLabel(selected)).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-[#6B7280] text-[10px] mt-1">
                                        {selectedColumn ? t(selectedColumn.name) : ""} · {t("g.skill.rankSuffix", { current: selectedRank, max: selected.maxRank })}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                                    <p className="text-[#C9CDD4] text-[12px] leading-relaxed">{t(selected.description)}</p>

                                    {selected.effects && (
                                        <div className="space-y-1">
                                            <div className="text-[#6B7280] text-[10px] tracking-wider">{t("g.skill.perRank")}</div>
                                            {selected.effects.map((effect) =>
                                                effect.perRank.map((value, i) => (
                                                    <div
                                                        key={`${effect.stat}-${i}`}
                                                        className="flex items-center gap-2 text-[11px]"
                                                        style={{ opacity: i < selectedRank ? 1 : 0.5 }}
                                                    >
                                                        <span
                                                            className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                                            style={{
                                                                background: i < selectedRank ? `${selectedAccent}30` : "rgba(255,255,255,0.06)",
                                                                color: i < selectedRank ? selectedAccent : "#8B8F98",
                                                            }}
                                                        >
                                                            {i + 1}
                                                        </span>
                                                        <span style={{ color: i < selectedRank ? "#E5E7EB" : "#8B8F98" }}>
                                                            {formatEffect(effect.stat, effect.op, value, t)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {selected.ability && (
                                        <div className="rounded-[8px] border border-white/8 bg-black/25 px-3 py-2 space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#8B8F98]">{t("g.skill.cooldown")}</span>
                                                <span className="text-[#E5E7EB] font-bold">{selected.ability.cooldownMs / 1000}s</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#8B8F98]">{t("g.skill.cost")}</span>
                                                <span className="text-[#E5E7EB] font-bold">{selected.ability.energyCost} energy</span>
                                            </div>
                                            {typeof selected.ability.durationMs === "number" && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-[#8B8F98]">{t("g.skill.duration")}</span>
                                                    <span className="text-[#E5E7EB] font-bold">{selected.ability.durationMs / 1000}s</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="rounded-[8px] border border-white/8 bg-black/25 px-3 py-2 space-y-1">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[#8B8F98]">{t("g.skill.requiresLevel")}</span>
                                            <span
                                                className="font-bold"
                                                style={{ color: level >= selected.requires.level ? "#4ADE80" : "#FF5757" }}
                                            >
                                                {selected.requires.level}
                                            </span>
                                        </div>
                                        {selected.requires.columnPoints > 0 && (
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#8B8F98]">{t("g.skill.pointsIn", { column: selectedColumn ? t(selectedColumn.name) : "" })}</span>
                                                <span
                                                    className="font-bold"
                                                    style={{
                                                        color: columnPoints(ranks, selected.column) >= selected.requires.columnPoints
                                                            ? "#4ADE80"
                                                            : "#FF5757",
                                                    }}
                                                >
                                                    {columnPoints(ranks, selected.column)}/{selected.requires.columnPoints}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {selected.ability && selectedRank > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="text-[#6B7280] text-[10px] tracking-wider">{t("g.skill.bindToSlot")}</div>
                                            <div className="grid grid-cols-6 gap-1">
                                                {ABILITY_SLOTS.map((slot: AbilitySlot) => {
                                                    const bound = progression.loadout?.[slot] === selected.ability!.id;
                                                    const occupiedBy = progression.loadout?.[slot];
                                                    return (
                                                        <button
                                                            key={slot}
                                                            onClick={() => onBind(slot, bound ? null : selected.ability!.id)}
                                                            title={
                                                                bound
                                                                    ? t("g.skill.unbindKey", { key: ABILITY_SLOT_KEYS[slot] })
                                                                    : occupiedBy
                                                                        ? t("g.skill.replaceKey", { key: ABILITY_SLOT_KEYS[slot] })
                                                                        : t("g.skill.bindKey", { key: ABILITY_SLOT_KEYS[slot] })
                                                            }
                                                            className="h-8 rounded-[6px] text-[12px] font-black border-0 transition-colors"
                                                            style={{
                                                                background: bound
                                                                    ? selectedAccent
                                                                    : occupiedBy
                                                                        ? "rgba(255,255,255,0.14)"
                                                                        : "rgba(255,255,255,0.06)",
                                                                color: bound ? "#0C0C0E" : "#C9CDD4",
                                                            }}
                                                        >
                                                            {ABILITY_SLOT_KEYS[slot]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
                                    {selectedRank >= selected.maxRank ? (
                                        <div className="flex items-center justify-center gap-1.5 text-[#4ADE80] text-xs font-bold py-2">
                                            <Check className="w-4 h-4" />
                                            {t("g.skill.fullyLearned")}
                                        </div>
                                    ) : selectedCheck?.ok ? (
                                        <button
                                            onClick={() => onLearn(selected.id)}
                                            className="w-full flex items-center justify-center gap-1.5 font-black text-xs py-2.5 rounded-[8px] border-0"
                                            style={{ background: selectedAccent, color: "#0C0C0E" }}
                                        >
                                            <Plus className="w-4 h-4" />
                                            LEARN · 1 POINT
                                        </button>
                                    ) : (
                                        <div className="text-center text-[#FF5757] text-[11px] font-bold py-2">
                                            {selectedCheck?.reason === "level_too_low"
                                                ? t("g.skill.reachLevel", { level: selected.requires.level })
                                                : selectedCheck?.reason === "column_points_too_low"
                                                    ? t("g.skill.investPoints", { points: selected.requires.columnPoints, column: selectedColumn ? t(selectedColumn.name) : "" })
                                                    : selectedCheck?.reason === "no_points"
                                                        ? t("g.skill.noPoints")
                                                        : t("g.skill.locked")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[#6B7280] text-xs text-center px-6 py-10">
                                {t("g.skill.pickToSee")}
                            </p>
                        )}
                    </div>
                </div>

                <div className="game-skill-degen flex-shrink-0 rounded-[12px] border border-white/8 bg-black/25 px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[#FFD166] text-[10px] font-black tracking-wider">{t("g.skill.degenTrack")}</div>
                        <div className="text-[#6B7280] text-[10px]">{t("g.skill.degenHint")}</div>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto">
                        {TIERS.map((tierEntry) => {
                            const ability = MEME_ABILITIES_BY_ID.get(tierEntry.memeAbility);
                            const unlocked = level >= tierEntry.minLevel;

                            return (
                                <div
                                    key={tierEntry.id}
                                    title={`${ability ? t(ability.name) : t(tierEntry.name)} — ${unlocked ? (ability ? t(ability.description) : "") : t("g.skill.unlocksAtLevel", { level: tierEntry.minLevel })}`}
                                    className="flex-1 min-w-[74px] rounded-[8px] border px-2 py-1.5 flex items-center gap-1.5"
                                    style={{
                                        borderColor: unlocked ? `${tierEntry.accent}55` : "rgba(255,255,255,0.07)",
                                        background: unlocked ? `${tierEntry.accent}12` : "rgba(0,0,0,0.2)",
                                        opacity: unlocked ? 1 : 0.45,
                                    }}
                                >
                                    <span className="text-base leading-none flex-shrink-0">{ability?.emoji ?? tierEntry.emoji}</span>
                                    <span className="min-w-0">
                                        <span
                                            className="block text-[10px] font-bold leading-tight truncate"
                                            style={{ color: unlocked ? tierEntry.accent : "#8B8F98" }}
                                        >
                                            {ability ? t(ability.name) : t(tierEntry.name)}
                                        </span>
                                        <span className="block text-[#6B7280] text-[9px] leading-tight">{t("g.skill.lvShort", { level: tierEntry.minLevel })}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )
    );
}
