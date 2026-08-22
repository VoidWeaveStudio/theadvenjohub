// src/features/game/ui/RoomPortalPanel.tsx
"use client";

import { useEffect } from "react";
import { Sparkles, Castle, UserRound } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface RoomPortalPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onGoToOwnBubble: () => void;
    onGoToKeeper: () => void;
    onGoToMainHall: () => void;
}

export function RoomPortalPanel({ isOpen, onClose, onGoToOwnBubble, onGoToKeeper, onGoToMainHall }: RoomPortalPanelProps) {
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen) SoundManager.getInstance().play('modal-open');
    }, [isOpen]);

    if (!isOpen) return null;

    const options = [
        {
            icon: <UserRound className="w-5 h-5 text-[#66CCFF]" />,
            title: t("g.portal.myBubble"),
            subtitle: t("g.portal.myBubbleHint"),
            action: onGoToOwnBubble,
        },
        {
            icon: <Sparkles className="w-5 h-5 text-[#7FE6CF]" />,
            title: t("g.portal.keeper"),
            subtitle: t("g.portal.keeperHint"),
            action: onGoToKeeper,
        },
        {
            icon: <Castle className="w-5 h-5 text-[#E8A33D]" />,
            title: t("g.portal.mainHall"),
            subtitle: t("g.portal.mainHallHint"),
            action: onGoToMainHall,
        },
    ];

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4">
            <div className="w-full max-w-md bg-[rgba(10,12,20,0.95)] border-2 border-[#66CCFF]/35 rounded-[16px] p-6 shadow-[0_0_35px_rgba(102,204,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.portal.whereTo")}</h2>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <div className="space-y-2">
                    {options.map((option) => (
                        <button
                            key={option.title}
                            onClick={() => {
                                option.action();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 text-left transition-colors"
                        >
                            <div className="flex-shrink-0">{option.icon}</div>
                            <div className="min-w-0">
                                <div className="text-[#E5E7EB] font-bold text-sm">{option.title}</div>
                                <div className="text-[#8B8F98] text-xs">{option.subtitle}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
