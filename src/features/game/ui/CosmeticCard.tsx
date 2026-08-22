// src/features/game/ui/CosmeticCard.tsx
"use client";

import { Check, Gem, Lock, Maximize2 } from "lucide-react";
import { CosmeticDefinition } from "../data/cosmetics";
import { InlinePreview } from "./preview/InlinePreview";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface CosmeticCardProps {
    cosmetic: CosmeticDefinition;
    owned: boolean;
    equipped: boolean;
    blocked?: boolean;
    blockedReason?: string;
    actionLabel: string;
    priceLabel?: React.ReactNode;
    // The shop buys through its own TNJ flow, so it hands in a ready control
    // instead of the plain action button used by the wardrobe.
    actionSlot?: React.ReactNode;
    onAction: () => void;
    onPreview?: () => void;
}

export function CosmeticCard({
    cosmetic,
    owned,
    equipped,
    blocked = false,
    blockedReason,
    actionLabel,
    priceLabel,
    actionSlot,
    onAction,
    onPreview,
}: CosmeticCardProps) {
    const { t } = useLanguage();

    return (
        <div
            className={`flex items-stretch gap-3 rounded-lg border p-3 transition-colors ${equipped
                ? "bg-[rgba(79,209,255,0.08)] border-[#4FD1FF]/40"
                : "bg-[rgba(255,255,255,0.04)] border-white/10"
                }`}
        >
            {/* The preview is the card's identity, so it renders straight away
                rather than hiding behind a "try on" button. Clicking it still
                opens the full-size view. */}
            <div className="group relative flex-shrink-0">
                <InlinePreview
                    subject={{
                        kind: "character",
                        skinId: cosmetic.slot === "skin" ? cosmetic.id : null,
                        accessoryId: cosmetic.slot === "accessory" ? cosmetic.id : null,
                    }}
                    accent={cosmetic.accent}
                    size="md"
                />
                {onPreview && (
                    <button
                        onClick={onPreview}
                        title={t("g.cosmetic.tryOn")}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md border-0 bg-black/60 p-0 text-[#C5C9D1] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                    >
                        <Maximize2 className="h-3 w-3" />
                    </button>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-[#E5E7EB]">{t(cosmetic.name)}</span>
                    <span className="flex-shrink-0 rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] font-bold text-[#8B8F98]">
                        {cosmetic.slot === "skin" ? t("g.cosmetic.fullSkin") : t("g.cosmetic.accessory")}
                    </span>
                </div>
                <div className="text-xs text-[#8B8F98]">{t(cosmetic.description)}</div>
                {blocked && blockedReason && (
                    <div className="text-[11px] text-[#FFD166]">{blockedReason}</div>
                )}
            </div>

            <div className="flex flex-shrink-0 flex-col items-end justify-center gap-2">
                {priceLabel ??
                    (!owned && (
                        <span className="flex items-center gap-1 text-xs font-bold text-[#FFD166]">
                            <Gem className="h-3.5 w-3.5" />
                            {cosmetic.priceAsh}
                        </span>
                    ))}

                {actionSlot ?? (equipped ? (
                    <span className="flex items-center gap-1 px-2 text-xs font-bold text-[#4FD1FF]">
                        <Check className="h-3.5 w-3.5" />
                        {t("g.cosmetic.equipped")}
                    </span>
                ) : (
                    <button
                        onClick={onAction}
                        disabled={blocked}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${owned ? "btn-secondary" : "btn-primary"
                            }`}
                    >
                        {blocked && <Lock className="h-3 w-3" />}
                        {actionLabel}
                    </button>
                ))}
            </div>
        </div>
    );
}
