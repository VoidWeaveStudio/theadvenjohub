// src/features/game/ui/CompanionCard.tsx
"use client";

import { CompanionDefinition, RARITY_META, dropChanceOf, dustValueOf } from "../data/companions";
import { InlinePreview } from "./preview/InlinePreview";
import { Maximize2 } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface CompanionCardProps {
    companion: CompanionDefinition;
    quantity?: number;
    equipped?: boolean;
    showDropChance?: boolean;
    showDustValue?: boolean;
    onPreview?: () => void;
    footer?: React.ReactNode;
}

export function CompanionCard({
    companion,
    quantity = 0,
    equipped = false,
    showDropChance = false,
    showDustValue = false,
    onPreview,
    footer,
}: CompanionCardProps) {
    const { t } = useLanguage();
    const rarity = RARITY_META[companion.rarity];
    const locked = quantity <= 0;

    return (
        <div
            className="relative flex flex-col gap-2 rounded-xl border p-3 transition-colors"
            style={{
                borderColor: locked ? "rgba(255,255,255,0.08)" : `${rarity.color}55`,
                background: locked
                    ? "rgba(255,255,255,0.02)"
                    : `linear-gradient(160deg, ${rarity.glow} -60%, rgba(255,255,255,0.03) 55%)`,
            }}
        >
            <div className="flex items-start gap-2.5">
                {/* Live model instead of an emoji chip: the pet is what the card is
                    selling, so it is on screen without a click. */}
                <div className={`group relative flex-shrink-0 ${locked ? "opacity-70" : ""}`}>
                    <InlinePreview subject={{ kind: "companion", companionId: companion.id }} accent={rarity.color} size="sm" />
                    {onPreview && (
                        <button
                            type="button"
                            onClick={onPreview}
                            title={t("g.companions.preview")}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded border-0 bg-black/60 p-0 text-[#C5C9D1] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        >
                            <Maximize2 className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[#E5E7EB]">{t(companion.nameKey)}</span>
                        {quantity > 1 && (
                            <span className="flex-shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-[#E5E7EB]">
                                ×{quantity}
                            </span>
                        )}
                    </div>
                    <div
                        className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: rarity.color }}
                    >
                        {t(rarity.labelKey)}
                    </div>
                </div>

                {equipped && (
                    <span className="flex-shrink-0 rounded-full bg-[#4FD1FF] px-2 py-0.5 text-[10px] font-black text-[#0A0E14]">
                        {t("g.companions.equipped")}
                    </span>
                )}
            </div>

            <p className="text-[11px] leading-snug text-[#8B8F98]">{t(companion.descriptionKey)}</p>

            {(showDropChance || showDustValue) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#6B7280]">
                    {showDropChance && (
                        <span>
                            {t("g.companions.dropChance")}{" "}
                            <span className="font-bold text-[#C9CDD3]">{dropChanceOf(companion.id).toFixed(1)}%</span>
                        </span>
                    )}
                    {showDustValue && (
                        <span>
                            {t("g.companions.dustValue")}{" "}
                            <span className="font-bold text-[#C084FC]">+{dustValueOf(companion.id)}</span>
                        </span>
                    )}
                </div>
            )}

            {footer && <div className="flex flex-wrap gap-1.5 pt-0.5">{footer}</div>}
        </div>
    );
}
