// src/features/game/ui/FactionInvitePicker.tsx
"use client";

import { X, UserPlus } from "lucide-react";
import { FactionSummary } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface FactionInvitePickerProps {
    target: { wallet: string; nickname: string } | null;
    myFactions: FactionSummary[];
    onClose: () => void;
    onInvite: (factionId: string) => void;
}

export function FactionInvitePicker({ target, myFactions, onClose, onInvite }: FactionInvitePickerProps) {
    const { t } = useLanguage();
    if (!target) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-sm bg-[rgba(12,14,16,0.95)] border-2 border-[#C084FC]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(192,132,252,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-[#C084FC]" />
                        <h2 className="text-lg font-black text-[#E5E7EB]">Invite {target.nickname}</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {myFactions.length === 0 ? (
                    <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.invitePicker.noFactions")}</p>
                ) : (
                    <div className="space-y-2">
                        {myFactions.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    onInvite(f.id);
                                    onClose();
                                }}
                                className="border-0 w-full flex items-center gap-2 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(192,132,252,0.15)] rounded-lg px-3 py-2.5 text-left transition-colors"
                            >
                                {f.image && <img src={f.image} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />}
                                <span className="text-[#E5E7EB] text-sm font-medium truncate">{f.name}</span>
                                {f.symbol && <span className="text-[#C084FC] text-xs font-bold flex-shrink-0">${f.symbol}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
