// src/features/game/ui/FactionBoostsPanel.tsx
"use client";

import { useEffect } from "react";
import { HeartPulse, Wind, Sparkles, GraduationCap } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionDetail, FactionActiveBoost } from "../network/NetworkManager";
import {
    FACTION_BOOSTS,
    BOOST_DURATIONS,
    boostPrice,
    BoostDuration,
    BoostEffect,
} from "@/core/lib/factionBoosts";
import { FACTION_PERM_TREASURY, hasFactionPermission } from "@/core/lib/factionPermissions";

interface FactionBoostsPanelProps {
    faction: FactionDetail;
    myUserId: string;
    boosts: FactionActiveBoost[];
    onRequestBoosts: (factionId: string) => void;
    onBuyBoost: (factionId: string, boostId: string, duration: BoostDuration) => void;
}

const EFFECT_ICON: Record<BoostEffect, { icon: typeof HeartPulse; tint: string }> = {
    maxHealth: { icon: HeartPulse, tint: "text-[#ff8a8a]" },
    moveSpeed: { icon: Wind, tint: "text-[#6fd8ff]" },
    loot: { icon: Sparkles, tint: "text-[#FFD166]" },
    xp: { icon: GraduationCap, tint: "text-[#59e07d]" },
};

const DURATION_LABEL: Record<BoostDuration, string> = {
    day: "g.fb.day",
    week: "g.fb.week",
    month: "g.fb.month",
};

function remaining(expiresAt: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
    const ms = expiresAt - Date.now();
    if (ms <= 0) return "";

    const days = Math.floor(ms / 86400000);
    if (days >= 1) return t("g.fb.leftDays", { n: days });

    const hours = Math.floor(ms / 3600000);
    if (hours >= 1) return t("g.fb.leftHours", { n: hours });

    return t("g.fb.leftMinutes", { n: Math.max(1, Math.floor(ms / 60000)) });
}

export function FactionBoostsPanel({
    faction,
    myUserId,
    boosts,
    onRequestBoosts,
    onBuyBoost,
}: FactionBoostsPanelProps) {
    const { t } = useLanguage();

    useEffect(() => {
        onRequestBoosts(faction.id);
    }, [faction.id, onRequestBoosts]);

    const me = faction.roster.find((member) => member.userId === myUserId);
    const canBuy = hasFactionPermission(
        { founderUserId: faction.founderUserId ?? "", verifiedCreatorUserId: faction.verifiedCreatorUserId ?? null },
        myUserId,
        me?.permissions ?? 0,
        FACTION_PERM_TREASURY
    );

    const activeById = new Map(boosts.map((entry) => [entry.boostId, entry.expiresAt]));
    const ash = faction.treasuryAsh ?? 0;

    return (
        <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#E5E7EB]">{t("g.fb.title")}</span>
                <span className="text-[11px] text-[#8B8F98]">{t("g.fb.hint")}</span>
            </div>

            <div className="space-y-2">
                {FACTION_BOOSTS.map((boost) => {
                    const { icon: Icon, tint } = EFFECT_ICON[boost.effect];
                    const expiresAt = activeById.get(boost.id) ?? 0;
                    const active = expiresAt > Date.now();

                    return (
                        <div
                            key={boost.id}
                            className={`rounded-lg p-2.5 space-y-2 border ${active
                                ? "bg-[#59e07d]/5 border-[#59e07d]/25"
                                : "bg-black/25 border-white/5"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${tint}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-[#E5E7EB] truncate">{t(boost.label)}</div>
                                    <div className="text-[10px] text-[#8B8F98] truncate">
                                        {t(boost.description, { n: Math.round(boost.magnitude * 100) })}
                                    </div>
                                </div>
                                {active && (
                                    <span className="text-[10px] font-bold text-[#59e07d] flex-shrink-0">
                                        {remaining(expiresAt, t)}
                                    </span>
                                )}
                            </div>

                            {canBuy && (
                                <div className="grid grid-cols-3 gap-1">
                                    {BOOST_DURATIONS.map((duration) => {
                                        const price = boostPrice(boost, duration);
                                        const affordable = ash >= price;

                                        return (
                                            <button
                                                key={duration}
                                                disabled={!affordable}
                                                onClick={() => onBuyBoost(faction.id, boost.id, duration)}
                                                className={`rounded px-1.5 py-1.5 text-[10px] font-bold border transition-colors ${affordable
                                                    ? "bg-white/5 hover:bg-white/10 border-white/10 text-[#E5E7EB]"
                                                    : "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                                                    }`}
                                            >
                                                <div>{t(DURATION_LABEL[duration])}</div>
                                                <div className="text-[#FFD166]">{price.toLocaleString()}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
