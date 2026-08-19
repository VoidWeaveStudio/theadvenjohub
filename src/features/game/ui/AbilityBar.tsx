// src/features/game/ui/AbilityBar.tsx
"use client";

import { Sparkles } from "lucide-react";
import { ProgressionStateData } from "../network/NetworkManager";
import { BRANCHES } from "../data/progression";
import { SKILL_NODES } from "../data/skills";
import { useLanguage } from "@/core/i18n/LanguageContext";

export const ABILITY_SLOTS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
export type AbilitySlot = (typeof ABILITY_SLOTS)[number];

export const ABILITY_SLOT_KEYS: Record<AbilitySlot, string> = {
    s1: "1",
    s2: "2",
    s3: "3",
    s4: "4",
    s5: "5",
    s6: "6",
};

interface AbilityBarProps {
    progression: ProgressionStateData | null;
    cooldowns?: Partial<Record<string, number>>;
    energy?: number;
    shield?: number;
    onSlotClick?: (slot: AbilitySlot) => void;
}

const ABILITY_NODES = new Map(SKILL_NODES.filter((n) => n.ability).map((n) => [n.ability!.id, n]));

export function AbilityBar({ progression, cooldowns = {}, energy, shield = 0, onSlotClick }: AbilityBarProps) {
    const { t } = useLanguage();
    if (!progression || progression.branch === null) return null;

    const accent = BRANCHES.find((b) => b.id === progression.branch)?.accent ?? "#4FD1FF";
    const maxEnergy = progression.stats?.maxEnergy ?? 100;
    const currentEnergy = energy ?? maxEnergy;
    const energyPercent = Math.max(0, Math.min(100, (currentEnergy / maxEnergy) * 100));

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto font-oxanium">
            {shield > 0 && (
                <div className="text-[10px] font-bold tracking-wide" style={{ color: "#8ECAE6" }}>
                    SHIELD {Math.round(shield)}
                </div>
            )}

            <div className="w-[300px] h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                <div
                    className="h-full transition-all duration-200"
                    style={{ width: `${energyPercent}%`, background: `linear-gradient(90deg, ${accent}88, ${accent})` }}
                />
            </div>

            <div className="flex gap-1.5">
                {ABILITY_SLOTS.map((slot) => {
                    const abilityId = progression.loadout?.[slot] ?? null;
                    const node = abilityId ? ABILITY_NODES.get(abilityId) : null;
                    const ability = node?.ability;
                    const readyAt = abilityId ? cooldowns[abilityId] ?? 0 : 0;
                    const remaining = Math.max(0, readyAt - Date.now());
                    const onCooldown = remaining > 0;
                    const cooldownPercent = ability && onCooldown
                        ? Math.min(100, (remaining / ability.cooldownMs) * 100)
                        : 0;
                    const starved = !!ability && !onCooldown && currentEnergy < ability.energyCost;
                    const isUltimate = slot === "s6";

                    return (
                        <div
                            key={slot}
                            onClick={() => onSlotClick?.(slot)}
                            title={node ? `[${ABILITY_SLOT_KEYS[slot]}] ${node.name} — ${ability!.energyCost} ${t("g.skill.energy")}` : t("g.skill.emptySlot")}
                            className="relative w-12 h-12 rounded-[8px] border backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-colors"
                            style={{
                                borderColor: node ? `${isUltimate ? "#FFD166" : accent}66` : "rgba(255,255,255,0.1)",
                                background: node ? "rgba(12,12,14,0.85)" : "rgba(12,12,14,0.45)",
                            }}
                        >
                            <span className="absolute top-0.5 left-1.5 text-[9px] font-bold text-[#8B8F98]">
                                {ABILITY_SLOT_KEYS[slot]}
                            </span>

                            {node ? (
                                <>
                                    <Sparkles
                                        className="w-4 h-4"
                                        style={{
                                            color: isUltimate ? "#FFD166" : accent,
                                            opacity: onCooldown ? 0.4 : starved ? 0.55 : 1,
                                        }}
                                    />
                                    <span
                                        className="text-[8px] font-bold leading-none mt-0.5 px-0.5 text-center truncate w-full"
                                        style={{ color: onCooldown ? "#6B7280" : "#E5E7EB" }}
                                    >
                                        {node.name.split(" ")[0]}
                                    </span>
                                </>
                            ) : (
                                <span className="text-[#6B7280] text-lg leading-none">·</span>
                            )}

                            {onCooldown && (
                                <>
                                    <div
                                        className="absolute inset-0 bg-black/60 rounded-[7px]"
                                        style={{ clipPath: `inset(${100 - cooldownPercent}% 0 0 0)` }}
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center text-[#E5E7EB] text-xs font-bold">
                                        {Math.ceil(remaining / 1000)}
                                    </span>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
