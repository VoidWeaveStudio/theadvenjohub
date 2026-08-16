// src/features/game/ui/XpBar.tsx
"use client";

import { ProgressionStateData } from "../network/NetworkManager";
import { TIERS } from "../data/progression";
import { XpPopup } from "./hooks/useProgressionState";

interface XpBarProps {
    progression: ProgressionStateData | null;
    popups: XpPopup[];
    onOpenSkills?: () => void;
}

const TIERS_BY_ID = new Map(TIERS.map((t) => [t.id, t]));

export function XpBar({ progression, popups, onOpenSkills }: XpBarProps) {
    if (!progression) return null;

    const tier = TIERS_BY_ID.get(progression.tier);
    const accent = tier?.accent ?? "#4FD1FF";
    const percentage = progression.xpForLevel > 0
        ? Math.min(100, (progression.xpIntoLevel / progression.xpForLevel) * 100)
        : 100;

    return (
        <div
            onClick={onOpenSkills}
            title="Skills [K]"
            className="relative mt-1.5 bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] px-4 py-2.5 min-w-[220px] pointer-events-auto cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-colors"
        >
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{tier?.emoji ?? "🦐"}</span>
                    <span className="text-[10px] font-bold tracking-wider" style={{ color: accent }}>
                        {(tier?.name ?? "Shrimp").toUpperCase()}
                    </span>
                </div>
                <span className="text-[#E5E7EB] text-sm font-bold">LV {progression.level}</span>
            </div>

            <div className="w-full h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                <div
                    className="h-full transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
                />
            </div>

            <div className="flex items-center justify-between mt-1">
                <span className="text-[#6B7280] text-[10px]">
                    {progression.xpForLevel > 0
                        ? `${progression.xpIntoLevel.toLocaleString()} / ${progression.xpForLevel.toLocaleString()} XP`
                        : "MAX LEVEL"}
                </span>
                {progression.skillPoints > 0 && (
                    <span className="text-[#FFD166] text-[10px] font-bold">
                        {progression.skillPoints} SP
                    </span>
                )}
            </div>

            <div className="absolute -right-2 top-0 translate-x-full flex flex-col items-start gap-0.5 pointer-events-none">
                {popups.map((popup, index) => (
                    <span
                        key={popup.id}
                        className="text-[#7FE6CF] text-xs font-bold whitespace-nowrap animate-pulse"
                        style={{ opacity: 1 - index * 0.18 }}
                    >
                        +{popup.amount} XP
                    </span>
                ))}
            </div>
        </div>
    );
}
