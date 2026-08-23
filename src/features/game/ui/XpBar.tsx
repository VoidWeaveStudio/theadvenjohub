// src/features/game/ui/XpBar.tsx
"use client";

import { ProgressionStateData } from "../network/NetworkManager";
import { TIERS } from "../data/progression";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { XpPopup } from "./hooks/useProgressionState";

interface XpBarProps {
    progression: ProgressionStateData | null;
    popups: XpPopup[];
    onOpenSkills?: () => void;
}

const TIERS_BY_ID = new Map(TIERS.map((t) => [t.id, t]));

export function XpBar({ progression, popups, onOpenSkills }: XpBarProps) {
    const { t } = useLanguage();
    if (!progression) return null;

    const tier = TIERS_BY_ID.get(progression.tier);
    const accent = tier?.accent ?? "#4FD1FF";
    const percentage = progression.xpForLevel > 0
        ? Math.min(100, (progression.xpIntoLevel / progression.xpForLevel) * 100)
        : 100;

    return (
        <div
            onClick={onOpenSkills}
            title={t("g.xp.skillsHint")}
            className="relative mt-2.5 pointer-events-auto cursor-pointer group"
        >
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{tier?.emoji ?? "🦐"}</span>
                <span
                    className="text-[10px] font-black tracking-wider drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                    style={{ color: accent }}
                >
                    {t(tier?.name ?? "g.tier.shrimp.name").toUpperCase()}
                </span>
                <span className="ml-auto text-white text-xs font-black tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                    LV {progression.level}
                </span>
            </div>

            <div className="h-1.5 rounded-full bg-black/55 ring-1 ring-white/10 overflow-hidden group-hover:ring-white/25 transition-colors">
                <div
                    className="h-full transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
                />
            </div>

            <div className="flex items-center justify-between mt-1">
                <span className="text-white/45 text-[9px] font-semibold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {progression.xpForLevel > 0
                        ? `${progression.xpIntoLevel.toLocaleString()} / ${progression.xpForLevel.toLocaleString()} XP`
                        : t("g.xp.maxLevel")}
                </span>
                {progression.skillPoints > 0 && (
                    <span className="text-[#FFD166] text-[9px] font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
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
