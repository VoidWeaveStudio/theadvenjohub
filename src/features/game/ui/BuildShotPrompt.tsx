// src/features/game/ui/BuildShotPrompt.tsx
"use client";

import { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface BuildShotPromptProps {
    tournamentTitle: string | null;
    onCapture: () => Promise<void>;
    onCancel: () => void;
}

// Shown after the player is sent to their own bubble to submit a build. The
// panel cannot frame the shot for them, so the shutter stays under their control
// and the rest of the HUD is left alone.
export function BuildShotPrompt({ tournamentTitle, onCapture, onCancel }: BuildShotPromptProps) {
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);

    if (!tournamentTitle) return null;

    const capture = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await onCapture();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="pointer-events-auto absolute bottom-28 left-1/2 z-[60] -translate-x-1/2 font-oxanium">
            <div className="flex items-center gap-3 rounded-xl border border-[#FFD166]/40 bg-[rgba(10,12,18,0.94)] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                <Camera className="h-5 w-5 flex-shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[#E5E7EB]">{tournamentTitle}</div>
                    <div className="text-[11px] text-[#8B8F98]">{t("g.tournament.frameShot")}</div>
                </div>
                <button
                    onClick={capture}
                    disabled={busy}
                    className="btn-primary flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    {t("g.tournament.shoot")}
                </button>
                <button
                    onClick={onCancel}
                    disabled={busy}
                    className="flex-shrink-0 border-0 bg-transparent p-0 text-[#8B8F98] transition-colors hover:text-[#E5E7EB] disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
