// src/features/game/ui/FactionBubblePanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { ROOM_ACCESS_LABELS, canEnterRoom, isRoomAccess, roomAccessDenialReason, type RoomAccess } from "@/core/lib/roomAccess";
import type { FactionGateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface FactionBubblePanelProps {
    faction: FactionGateData | null;
    isMember: boolean;
    onClose: () => void;
    onEnter: (factionId: string) => void;
}

function formatMC(value: number): string {
    if (value > 1e9) return (value / 1e9).toFixed(1) + "B";
    if (value > 1e6) return (value / 1e6).toFixed(1) + "M";
    if (value > 1e3) return (value / 1e3).toFixed(1) + "K";
    return value.toFixed(0);
}

export function FactionBubblePanel({ faction, isMember, onClose, onEnter }: FactionBubblePanelProps) {
    const { t } = useLanguage();
    const [marketCap, setMarketCap] = useState<number | null>(null);

    useEffect(() => {
        if (!faction) {
            setMarketCap(null);
            return;
        }

        SoundManager.getInstance().play('modal-open');

        if (!faction.tokenCa) return;

        let cancelled = false;
        fetch(`/api/token-by-ca?ca=${faction.tokenCa}`)
            .then((res) => res.json())
            .then((info) => {
                if (!cancelled) setMarketCap(info?.mc ?? null);
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [faction]);

    if (!faction) return null;

    const access: RoomAccess = isRoomAccess(faction.roomAccess ?? "") ? (faction.roomAccess as RoomAccess) : "members";
    const allowed = canEnterRoom({ access, isOwner: false, isMember, isInvited: false });

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className={`w-full max-w-sm bg-[rgba(10,12,20,0.95)] border-2 rounded-[16px] p-6 ${faction.isAdmin ? "border-[#E8A33D]/45 shadow-[0_0_35px_rgba(232,163,61,0.18)]" : "border-[#66CCFF]/35 shadow-[0_0_35px_rgba(102,204,255,0.15)]"}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Globe2 className={`w-5 h-5 ${faction.isAdmin ? "text-[#E8A33D]" : "text-[#66CCFF]"}`} />
                        <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.bubble.factionBubble")}</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 mb-3">
                    {faction.image ? (
                        <img src={faction.image} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                        <div className={`font-black text-lg truncate ${faction.isAdmin ? "text-[#E8A33D]" : "text-[#E5E7EB]"}`}>
                            {faction.factionName}
                        </div>
                        {faction.symbol && <div className="text-[#8B8F98] text-sm">${faction.symbol}</div>}
                    </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                    {marketCap !== null && (
                        <div className="flex justify-between">
                            <span className="text-[#8B8F98]">{t("g.bubble.marketCap")}</span>
                            <span className="text-[#FFD166] font-bold">{formatMC(marketCap)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-[#8B8F98]">{t("g.bubble.access")}</span>
                        <span className="text-[#E5E7EB]">{t(ROOM_ACCESS_LABELS[access])}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#8B8F98]">{t("g.bubble.you")}</span>
                        <span className="text-[#E5E7EB]">{isMember ? t("g.bubble.member") : t("g.bubble.notMember")}</span>
                    </div>
                </div>

                {allowed ? (
                    <button
                        onClick={() => {
                            onEnter(faction.factionId);
                            onClose();
                        }}
                        className="btn-primary px-4 py-2 text-sm w-full"
                    >
                        {t("g.bubble.enterGate")}
                    </button>
                ) : (
                    <p className="text-[#FFD166] text-sm bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-lg px-3 py-2">
                        {t(roomAccessDenialReason(access))}
                    </p>
                )}
            </div>
        </div>
    );
}
