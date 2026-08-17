// src/features/game/ui/SkillTreeWindow.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Crosshair, HeartPulse, Lock, Plus, TrendingUp, Zap } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { ProgressionStateData } from "../network/NetworkManager";
import { BRANCHES, TIERS, MEME_ABILITIES_BY_ID } from "../data/progression";
import { SkillNode, columnsForBranch, nodesForColumn, columnPoints, canLearn, NODES_BY_ID } from "../data/skills";
import { ABILITY_SLOTS, ABILITY_SLOT_KEYS, AbilitySlot } from "./AbilityBar";

interface SkillTreeWindowProps {
    isOpen: boolean;
    onClose: () => void;
    progression: ProgressionStateData | null;
    onLearn: (nodeId: string) => void;
    onBind: (slot: string, abilityId: string | null) => void;
    onOpenSpecialization: () => void;
}

const STAT_LABELS: Record<string, string> = {
    maxHealth: "max health",
    maxEnergy: "max energy",
    energyRegen: "energy regen",
    moveSpeed: "move speed",
    lootBonus: "loot",
    damageTaken: "damage taken",
    weaponDamage: "weapon damage",
    spellDamage: "spell damage",
    magSize: "magazine",
    armorPen: "armour pierce",
    damageVsUnshielded: "damage vs unshielded",
    reloadSpeed: "reload speed",
    healOnKill: "health per kill",
    energyOnKill: "energy per kill",
    shieldStrength: "shield strength",
    aoeDamage: "area damage",
    aoeRadius: "area radius",
    zoneRadius: "zone radius",
    zoneDuration: "zone duration",
    zoneTickDamage: "zone damage per second",
    controlCooldown: "control cooldown",
    supportCooldown: "support cooldown",
    postDashSpeed: "speed after dash",
    postDashDamageTaken: "damage taken after dash",
    lowHealthDamageTaken: "damage taken while wounded",
    dashCharges: "dash charges",
    grenadeCharges: "grenade charges",
    projectileSpeed: "projectile speed",
    manaCost: "mana cost",
    bleedDamage: "bleed damage",
    burnDamage: "burn damage",
    healingPower: "healing",
    allyDamageInZone: "ally damage in zone",
    markedAllyFireRate: "ally fire rate on mark",
    ricochetChance: "ricochet chance",
    ricochetDamage: "ricochet damage",
    clusterCount: "cluster charges",
    clusterDamage: "cluster damage",
    explosiveDamage: "explosive damage",
    explosiveRadius: "explosive radius",
    explosiveEveryNthShot: "explosive every nth shot",
    postShieldRegen: "health regen after shield",
};

function statLabel(stat: string): string {
    return STAT_LABELS[stat] ?? stat.replace(/([A-Z])/g, " $1").toLowerCase();
}

function nodeIcon(node: SkillNode) {
    if (node.capstone) return Crown;
    if (node.kind === "active") return Zap;
    if (node.kind === "mode") return Crosshair;
    if (node.kind === "trigger") return HeartPulse;
    return TrendingUp;
}

function nodeKindLabel(node: SkillNode): string {
    if (node.capstone) return "Ultimate";
    if (node.kind === "active") return "Active";
    if (node.kind === "mode") return "Weapon mode";
    if (node.kind === "trigger") return "Triggered";
    return "Passive";
}

function formatEffect(stat: string, op: string, value: number): string {
    const label = statLabel(stat);
    if (op === "addPercent") return `${value > 0 ? "+" : ""}${value}% ${label}`;
    if (op === "add") return `${value > 0 ? "+" : ""}${value} ${label}`;
    return `${label}: ${value}`;
}

export function SkillTreeWindow({ isOpen, onClose, progression, onLearn, onBind, onOpenSpecialization }: SkillTreeWindowProps) {
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
        if (!isOpen) setSelectedId(null);
    }, [isOpen]);

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
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Skills"
            size="xl"
            icon={<Zap className="w-7 h-7" />}
        >
            {!progression ? (
                <p className="text-[#8B8F98] text-sm text-center py-16">Loading your progression...</p>
            ) : !branch ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Lock className="w-10 h-10 text-[#6B7280]" />
                    <p className="text-[#8B8F98] text-sm text-center max-w-sm">
                        {progression.branchUnlocked
                            ? "Pick a specialisation to open your skill tree."
                            : "Finish Sola's orientation quest to unlock specialisations."}
                    </p>
                    {progression.branchUnlocked && (
                        <button
                            onClick={onOpenSpecialization}
                            className="bg-gradient-to-r from-[#4FD1FF] to-[#3BA9E8] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px]"
                        >
                            Choose specialisation
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
                                    {branchInfo?.name}
                                </div>
                                <div className="text-[11px]" style={{ color: tier?.accent ?? "#8B8F98" }}>
                                    {tier?.name} · level {level}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-5">
                            <div className="text-right">
                                <div className="text-[#E5E7EB] text-sm font-bold leading-none">
                                    {progression.memeAbilities.length}/{TIERS.length}
                                </div>
                                <div className="text-[#6B7280] text-[10px] tracking-wider">DEGEN</div>
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
                                <div className="text-[#6B7280] text-[10px] tracking-wider">POINTS</div>
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
                                        className="flex flex-col min-w-[150px] flex-1 rounded-[12px] border border-white/8 bg-black/25 overflow-hidden"
                                    >
                                        <div
                                            className="px-3 py-2 flex-shrink-0 border-b border-white/8"
                                            style={{ background: isCore ? "rgba(255,255,255,0.03)" : `${accentBase}0F` }}
                                        >
                                            <div className="text-[#E5E7EB] text-[11px] font-black tracking-wider uppercase">
                                                {column.name}
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
                                                                    {node.name}
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

                        <div className="w-[290px] flex-shrink-0 flex flex-col rounded-[12px] border border-white/8 bg-black/30 overflow-hidden">
                            {selected ? (
                                <div className="flex flex-col h-full min-h-0">
                                    <div
                                        className="px-4 py-3 border-b border-white/8 flex-shrink-0"
                                        style={{ background: `${selectedAccent}12` }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="text-[#E5E7EB] text-sm font-black leading-tight">{selected.name}</div>
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{ background: `${selectedAccent}22`, color: selectedAccent }}
                                            >
                                                {nodeKindLabel(selected).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-[#6B7280] text-[10px] mt-1">
                                            {selectedColumn?.name} · rank {selectedRank}/{selected.maxRank}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                                        <p className="text-[#C9CDD4] text-[12px] leading-relaxed">{selected.description}</p>

                                        {selected.effects && (
                                            <div className="space-y-1">
                                                <div className="text-[#6B7280] text-[10px] tracking-wider">PER RANK</div>
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
                                                                {formatEffect(effect.stat, effect.op, value)}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {selected.ability && (
                                            <div className="rounded-[8px] border border-white/8 bg-black/25 px-3 py-2 space-y-1">
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-[#8B8F98]">Cooldown</span>
                                                    <span className="text-[#E5E7EB] font-bold">{selected.ability.cooldownMs / 1000}s</span>
                                                </div>
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-[#8B8F98]">Cost</span>
                                                    <span className="text-[#E5E7EB] font-bold">{selected.ability.energyCost} energy</span>
                                                </div>
                                                {typeof selected.ability.durationMs === "number" && (
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="text-[#8B8F98]">Duration</span>
                                                        <span className="text-[#E5E7EB] font-bold">{selected.ability.durationMs / 1000}s</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="rounded-[8px] border border-white/8 bg-black/25 px-3 py-2 space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#8B8F98]">Requires level</span>
                                                <span
                                                    className="font-bold"
                                                    style={{ color: level >= selected.requires.level ? "#4ADE80" : "#FF5757" }}
                                                >
                                                    {selected.requires.level}
                                                </span>
                                            </div>
                                            {selected.requires.columnPoints > 0 && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-[#8B8F98]">Points in {selectedColumn?.name}</span>
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
                                                <div className="text-[#6B7280] text-[10px] tracking-wider">BIND TO SLOT</div>
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
                                                                        ? `Unbind from key ${ABILITY_SLOT_KEYS[slot]}`
                                                                        : occupiedBy
                                                                            ? `Replace what is on key ${ABILITY_SLOT_KEYS[slot]}`
                                                                            : `Bind to key ${ABILITY_SLOT_KEYS[slot]}`
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
                                                FULLY LEARNED
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
                                                    ? `Reach level ${selected.requires.level} first`
                                                    : selectedCheck?.reason === "column_points_too_low"
                                                        ? `Invest ${selected.requires.columnPoints} points in ${selectedColumn?.name}`
                                                        : selectedCheck?.reason === "no_points"
                                                            ? "No skill points left"
                                                            : "Locked"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[#6B7280] text-xs text-center px-6 py-10">
                                    Pick a skill on the left to see what it does.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex-shrink-0 rounded-[12px] border border-white/8 bg-black/25 px-3 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="text-[#FFD166] text-[10px] font-black tracking-wider">DEGEN TRACK</div>
                            <div className="text-[#6B7280] text-[10px]">unlocks itself every 5 levels · cast from the wheel [T]</div>
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto">
                            {TIERS.map((t) => {
                                const ability = MEME_ABILITIES_BY_ID.get(t.memeAbility);
                                const unlocked = level >= t.minLevel;

                                return (
                                    <div
                                        key={t.id}
                                        title={`${ability?.name ?? t.name} — ${unlocked ? ability?.description ?? "" : `unlocks at level ${t.minLevel}`}`}
                                        className="flex-1 min-w-[74px] rounded-[8px] border px-2 py-1.5 flex items-center gap-1.5"
                                        style={{
                                            borderColor: unlocked ? `${t.accent}55` : "rgba(255,255,255,0.07)",
                                            background: unlocked ? `${t.accent}12` : "rgba(0,0,0,0.2)",
                                            opacity: unlocked ? 1 : 0.45,
                                        }}
                                    >
                                        <span className="text-base leading-none flex-shrink-0">{ability?.emoji ?? t.emoji}</span>
                                        <span className="min-w-0">
                                            <span
                                                className="block text-[10px] font-bold leading-tight truncate"
                                                style={{ color: unlocked ? t.accent : "#8B8F98" }}
                                            >
                                                {ability?.name ?? t.name}
                                            </span>
                                            <span className="block text-[#6B7280] text-[9px] leading-tight">lv {t.minLevel}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </WindowFrame>
    );
}
