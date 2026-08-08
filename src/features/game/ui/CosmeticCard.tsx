// src/features/game/ui/CosmeticCard.tsx
"use client";

import { Check, Gem, Lock, Shirt, Sparkles } from "lucide-react";
import { CosmeticDefinition } from "../data/cosmetics";

interface CosmeticCardProps {
    cosmetic: CosmeticDefinition;
    owned: boolean;
    equipped: boolean;
    blocked?: boolean;
    blockedReason?: string;
    actionLabel: string;
    onAction: () => void;
}

export function CosmeticCard({
    cosmetic,
    owned,
    equipped,
    blocked = false,
    blockedReason,
    actionLabel,
    onAction,
}: CosmeticCardProps) {
    const Icon = cosmetic.slot === "skin" ? Shirt : Sparkles;

    return (
        <div
            className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${equipped
                ? "bg-[rgba(79,209,255,0.08)] border-[#4FD1FF]/40"
                : "bg-[rgba(255,255,255,0.04)] border-white/10"
                }`}
        >
            <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${cosmetic.accent}22`, color: cosmetic.accent }}
            >
                <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-[#E5E7EB] text-sm font-bold truncate">{cosmetic.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.08)] text-[#8B8F98] flex-shrink-0">
                        {cosmetic.slot === "skin" ? "FULL SKIN" : "ACCESSORY"}
                    </span>
                </div>
                <div className="text-[#8B8F98] text-xs truncate">{cosmetic.description}</div>
                {blocked && blockedReason && (
                    <div className="text-[#FFD166] text-[11px] mt-0.5">{blockedReason}</div>
                )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {!owned && (
                    <span className="flex items-center gap-1 text-[#FFD166] text-xs font-bold">
                        <Gem className="w-3.5 h-3.5" />
                        {cosmetic.priceAsh}
                    </span>
                )}
                {equipped ? (
                    <span className="flex items-center gap-1 text-[#4FD1FF] text-xs font-bold px-2">
                        <Check className="w-3.5 h-3.5" />
                        Equipped
                    </span>
                ) : (
                    <button
                        onClick={onAction}
                        disabled={blocked}
                        className={`px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${owned ? "btn-secondary" : "btn-primary"
                            }`}
                    >
                        {blocked && <Lock className="w-3 h-3" />}
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
