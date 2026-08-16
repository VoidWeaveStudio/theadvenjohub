// src/features/game/ui/SkillTreeWindow.tsx
"use client";

import { useMemo, useState } from "react";
import { Lock, Plus, Sparkles, Zap } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { ProgressionStateData } from "../network/NetworkManager";
import { BRANCHES, TIERS, MEME_ABILITIES_BY_ID } from "../data/progression";
import { SkillNode, columnsForBranch, nodesForColumn, columnPoints, canLearn } from "../data/skills";

interface SkillTreeWindowProps {
    isOpen: boolean;
    onClose: () => void;
    progression: ProgressionStateData | null;
    onLearn: (nodeId: string) => void;
    onBind: (slot: string, abilityId: string | null) => void;
    onOpenSpecialization: () => void;
}

const SLOTS = ["q", "f", "c", "v", "x"];

function nodeKindLabel(node: SkillNode): string {
    if (node.capstone) return "Capstone";
    if (node.kind === "active") return "Active";
    if (node.kind === "mode") return "Fire mode";
    if (node.kind === "trigger") return "Triggered";
    return "Passive";
}

function effectSummary(node: SkillNode, rank: number): string | null {
    if (!node.effects) return null;
    const index = Math.max(0, Math.min(node.maxRank - 1, rank));
    return node.effects
        .map((effect) => {
            const value = effect.perRank[index];
            if (typeof value !== "number") return null;
            if (effect.op === "addPercent") return `${value > 0 ? "+" : ""}${value}% ${effect.stat}`;
            if (effect.op === "add") return `${value > 0 ? "+" : ""}${value} ${effect.stat}`;
            return `${effect.stat}: ${value}`;
        })
        .filter(Boolean)
        .join(" · ");
}

export function SkillTreeWindow({ isOpen, onClose, progression, onLearn, onBind, onOpenSpecialization }: SkillTreeWindowProps) {
    const [hovered, setHovered] = useState<string | null>(null);

    const branch = progression?.branch ?? null;
    const ranks = progression?.skills ?? {};
    const level = progression?.level ?? 1;
    const available = progression?.skillPoints ?? 0;

    const columns = useMemo(() => (branch ? columnsForBranch(branch) : []), [branch]);
    const tier = TIERS.find((t) => t.id === progression?.tier);
    const branchInfo = BRANCHES.find((b) => b.id === branch);

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Skills"
            size="lg"
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
                <>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl leading-none">{tier?.emoji}</span>
                            <div>
                                <div className="text-[#E5E7EB] text-sm font-bold">
                                    {branchInfo?.name} · Level {level}
                                </div>
                                <div className="text-[#6B7280] text-[11px]">
                                    {tier?.name} tier · {progression.memeAbilities.length}/{TIERS.length} meme abilities
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[#FFD166] text-lg font-black leading-none">{available}</div>
                            <div className="text-[#6B7280] text-[10px] tracking-wider">POINTS LEFT</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {columns.map((column) => {
                            const spent = columnPoints(ranks, column.id);
                            const nodes = nodesForColumn(column.id);

                            return (
                                <div key={column.id} className="bg-black/25 border border-white/8 rounded-[10px] p-3">
                                    <div className="mb-2">
                                        <div className="text-[#E5E7EB] text-xs font-bold tracking-wide">{column.name}</div>
                                        <div className="text-[#6B7280] text-[10px]">{spent} points invested</div>
                                    </div>

                                    <div className="space-y-1.5">
                                        {nodes.map((node) => {
                                            const rank = ranks[node.id] ?? 0;
                                            const maxed = rank >= node.maxRank;
                                            const check = canLearn(node.id, { level, branch, ranks, availablePoints: available });
                                            const locked = !check.ok && !maxed;
                                            const accent = node.capstone ? "#FFD166" : branchInfo?.accent ?? "#4FD1FF";

                                            return (
                                                <div
                                                    key={node.id}
                                                    onMouseEnter={() => setHovered(node.id)}
                                                    onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
                                                    className="relative rounded-[8px] border px-2.5 py-2 transition-colors"
                                                    style={{
                                                        borderColor: rank > 0 ? `${accent}66` : "rgba(255,255,255,0.08)",
                                                        background: rank > 0 ? `${accent}12` : "rgba(0,0,0,0.2)",
                                                        opacity: locked ? 0.55 : 1,
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span
                                                            className="text-[11px] font-bold leading-tight"
                                                            style={{ color: rank > 0 ? accent : "#E5E7EB" }}
                                                        >
                                                            {node.name}
                                                        </span>
                                                        <span className="text-[#6B7280] text-[10px] flex-shrink-0">
                                                            {rank}/{node.maxRank}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-[#6B7280] text-[9px] tracking-wide">
                                                            {nodeKindLabel(node)} · lv {node.requires.level}
                                                            {node.requires.columnPoints > 0 ? ` · ${node.requires.columnPoints}p` : ""}
                                                        </span>

                                                        {maxed ? (
                                                            <span className="text-[#4ADE80] text-[9px] font-bold">MAX</span>
                                                        ) : check.ok ? (
                                                            <button
                                                                onClick={() => onLearn(node.id)}
                                                                className="flex items-center gap-0.5 text-[9px] font-bold rounded px-1.5 py-0.5"
                                                                style={{ background: `${accent}22`, color: accent }}
                                                            >
                                                                <Plus className="w-2.5 h-2.5" />
                                                                LEARN
                                                            </button>
                                                        ) : (
                                                            <Lock className="w-2.5 h-2.5 text-[#6B7280]" />
                                                        )}
                                                    </div>

                                                    {node.ability && rank > 0 && (
                                                        <div className="flex gap-0.5 mt-1.5">
                                                            {SLOTS.map((slot) => {
                                                                const bound = progression.loadout?.[slot] === node.ability!.id;
                                                                return (
                                                                    <button
                                                                        key={slot}
                                                                        onClick={() => onBind(slot, bound ? null : node.ability!.id)}
                                                                        title={bound ? `Unbind from ${slot.toUpperCase()}` : `Bind to ${slot.toUpperCase()}`}
                                                                        className="flex-1 text-[9px] font-bold rounded py-0.5 border-0 uppercase"
                                                                        style={{
                                                                            background: bound ? accent : "rgba(255,255,255,0.06)",
                                                                            color: bound ? "#0C0C0E" : "#8B8F98",
                                                                        }}
                                                                    >
                                                                        {slot}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {hovered === node.id && (
                                                        <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-[rgba(12,14,18,0.98)] border border-white/12 rounded-[8px] p-2.5 pointer-events-none">
                                                            <div className="text-[#E5E7EB] text-[11px] font-bold mb-1">{node.name}</div>
                                                            <p className="text-[#8B8F98] text-[10px] mb-1.5">{node.description}</p>
                                                            {effectSummary(node, rank) && (
                                                                <div className="text-[10px]" style={{ color: accent }}>
                                                                    {effectSummary(node, rank)}
                                                                </div>
                                                            )}
                                                            {node.ability && (
                                                                <div className="text-[#7FE6CF] text-[10px]">
                                                                    {node.ability.cooldownMs / 1000}s cooldown · {node.ability.energyCost} energy
                                                                </div>
                                                            )}
                                                            {locked && (
                                                                <div className="text-[#FF5757] text-[10px] mt-1">
                                                                    {check.reason === "level_too_low"
                                                                        ? `Requires level ${node.requires.level}`
                                                                        : check.reason === "column_points_too_low"
                                                                            ? `Requires ${node.requires.columnPoints} points in ${column.name}`
                                                                            : check.reason === "no_points"
                                                                                ? "No skill points left"
                                                                                : "Locked"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="bg-black/25 border border-white/8 rounded-[10px] p-3">
                            <div className="mb-2">
                                <div className="text-[#FFD166] text-xs font-bold tracking-wide">Degen Track</div>
                                <div className="text-[#6B7280] text-[10px]">Unlocks itself every 5 levels</div>
                            </div>

                            <div className="space-y-1.5">
                                {TIERS.map((t) => {
                                    const ability = MEME_ABILITIES_BY_ID.get(t.memeAbility);
                                    const unlocked = level >= t.minLevel;

                                    return (
                                        <div
                                            key={t.id}
                                            className="rounded-[8px] border px-2.5 py-2"
                                            style={{
                                                borderColor: unlocked ? `${t.accent}55` : "rgba(255,255,255,0.08)",
                                                background: unlocked ? `${t.accent}12` : "rgba(0,0,0,0.2)",
                                                opacity: unlocked ? 1 : 0.5,
                                            }}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm leading-none">{ability?.emoji ?? t.emoji}</span>
                                                <span
                                                    className="text-[11px] font-bold leading-tight"
                                                    style={{ color: unlocked ? t.accent : "#E5E7EB" }}
                                                >
                                                    {ability?.name ?? t.name}
                                                </span>
                                            </div>
                                            <div className="text-[#6B7280] text-[9px] mt-0.5">
                                                {t.emoji} {t.name} · lv {t.minLevel}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[#6B7280] text-[11px]">
                        <Sparkles className="w-3.5 h-3.5" />
                        Sola can reset your specialisation for Ash if you want to try the other tree.
                    </div>
                </>
            )}
        </WindowFrame>
    );
}
