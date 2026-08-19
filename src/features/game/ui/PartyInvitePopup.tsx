// src/features/game/ui/PartyInvitePopup.tsx
"use client";

import { Users, X } from "lucide-react";
import type { PartyInviteData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PartyInvitePopupProps {
    invite: PartyInviteData | null;
    onRespond: (accept: boolean) => void;
}

export function PartyInvitePopup({ invite, onRespond }: PartyInvitePopupProps) {
    const { t } = useLanguage();
    if (!invite) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-sm bg-[rgba(12,14,16,0.95)] border-2 border-[#8AD4FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(138,212,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#8AD4FF]" />
                        <h2 className="text-lg font-black text-[#E5E7EB]">{t("g.party.invite")}</h2>
                    </div>
                    <button onClick={() => onRespond(false)} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-[#C9CDD3] text-sm mb-2">
                    <span className="text-[#E5E7EB] font-bold">{invite.fromNickname}</span> wants you in their party.
                </p>
                <p className="text-[#6B7280] text-[11px] mb-6">
                    {t("g.party.noFriendlyFire")}
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={() => onRespond(false)}
                        className="flex-1 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#C9CDD3] font-bold px-4 py-2.5 rounded-[8px] transition-colors"
                    >
                        {t("g.common.decline")}
                    </button>
                    <button
                        onClick={() => onRespond(true)}
                        className="flex-1 bg-gradient-to-r from-[#8AD4FF] to-[#3B82F6] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2.5 rounded-[8px] transition-all"
                    >
                        {t("g.common.accept")}
                    </button>
                </div>
            </div>
        </div>
    );
}
