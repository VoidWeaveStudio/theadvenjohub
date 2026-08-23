// src/features/game/ui/OnlineCounter.tsx
"use client";

import { Users } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface OnlineCounterProps {
    count: number;
    here?: number;
}

export function OnlineCounter({ count, here }: OnlineCounterProps) {
    const { t } = useLanguage();
    const nearby = here ?? count;

    return (
        <div className="flex items-center gap-2 rounded-full bg-[rgba(10,13,18,0.66)] backdrop-blur-md ring-1 ring-white/10 px-3 py-1.5 font-oxanium">
            <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-[#4ADE80] animate-ping opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            </div>

            <Users className="w-3.5 h-3.5 text-[#8B8F98]" />

            <span
                className="text-white text-sm font-black leading-none tabular-nums"
                title={t("g.hud.onlineHere")}
            >
                {nearby}
            </span>

            <span className="text-white/35 text-[11px] font-bold leading-none tabular-nums" title={t("g.hud.online")}>
                / {count}
            </span>
        </div>
    );
}
