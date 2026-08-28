// src/features/game/ui/WarSideModal.tsx
"use client";

import { useState } from "react";
import { Swords, Scale } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { FactionWarSideChoice } from "../network/NetworkManager";

interface WarSideModalProps {
    choices: FactionWarSideChoice[];
    myAsh: number;
    onChoose: (warId: string, sideFactionId: string | null) => void;
}

export function WarSideModal({ choices, myAsh, onChoose }: WarSideModalProps) {
    const { t } = useLanguage();
    const [pending, setPending] = useState<string | null>(null);

    const choice = choices[0];
    if (!choice) return null;

    const pick = (sideFactionId: string | null) => {
        setPending(choice.warId);
        onChoose(choice.warId, sideFactionId);
    };

    const canAffordNeutrality = myAsh >= choice.neutralityAsh;
    const busy = pending === choice.warId;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#0d0f14] border border-[#ff5a48]/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-[#ff5a48]" />
                    <h2 className="text-base font-black text-[#E5E7EB]">{t("g.war.pickSide")}</h2>
                </div>

                <p className="text-xs text-[#8B8F98]">{t("g.war.pickSideHint")}</p>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: choice.declarerFactionId, name: choice.declarerName },
                        { id: choice.defenderFactionId, name: choice.defenderName },
                    ].map((side) => (
                        <button
                            key={side.id}
                            disabled={busy}
                            onClick={() => pick(side.id)}
                            className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40 px-3 py-3 text-xs font-bold text-[#E5E7EB] transition-colors truncate"
                        >
                            {side.name ?? t("g.war.declarer")}
                        </button>
                    ))}
                </div>

                <button
                    disabled={busy || !canAffordNeutrality}
                    onClick={() => pick(null)}
                    className={`w-full rounded-lg py-2.5 text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${canAffordNeutrality && !busy
                        ? "bg-[#ffd166]/10 hover:bg-[#ffd166]/20 border-[#ffd166]/35 text-[#ffd166]"
                        : "bg-transparent border-white/5 text-[#4B5563] cursor-not-allowed"
                        }`}
                >
                    <Scale className="w-3.5 h-3.5" />
                    {t("g.war.buyNeutrality", { n: choice.neutralityAsh.toLocaleString() })}
                </button>

                <p className="text-[10px] text-[#6B7280] text-center">{t("g.war.sideIsFinal")}</p>
            </div>
        </div>
    );
}
