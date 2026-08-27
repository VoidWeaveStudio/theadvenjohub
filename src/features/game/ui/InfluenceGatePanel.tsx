// src/features/game/ui/InfluenceGatePanel.tsx
"use client";

import { useEffect, useState } from "react";
import { DoorOpen, ShieldAlert, Users, Coins, Copy } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { InfluenceGateData } from "../network/NetworkManager";

interface InfluenceGatePanelProps {
    data: InfluenceGateData | null;
    onClose: () => void;
    onEnter: (tx?: string) => void;
}

const CURRENCY_LABEL: Record<string, string> = {
    ash: "ASH",
    tnj: "TNJ",
    faction: "TOKEN",
};

export function InfluenceGatePanel({ data, onClose, onEnter }: InfluenceGatePanelProps) {
    const { t } = useLanguage();
    const [signature, setSignature] = useState("");

    useEffect(() => {
        if (data) {
            SoundManager.getInstance().play("modal-open");
            setSignature("");
        }
    }, [data]);

    if (!data) return null;

    const fee = data.fee;
    const onChain = fee !== null && fee.currency !== "ash" && fee.currency !== "none";

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-md bg-[rgba(10,8,18,0.96)] border-2 border-[#9d6bff]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(157,107,255,0.18)]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.influence.gateTitle")}</h2>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <p className="text-sm text-[#9aa0ad] mb-4">{t("g.influence.gateHint")}</p>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                        <ShieldAlert className="w-5 h-5 text-[#c79bff] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-[#E5E7EB]">
                                {data.ownerFactionName ?? t("g.influence.unclaimed")}
                            </div>
                            <div className="text-xs text-[#8B8F98]">{t("g.influence.controller")}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                        <Users className="w-5 h-5 text-[#6fd8ff] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-[#E5E7EB]">{data.occupants} / {data.capacity}</div>
                            <div className="text-xs text-[#8B8F98]">{t("g.influence.occupants")}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                        <Coins className="w-5 h-5 text-[#ffb347] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-[#E5E7EB]">
                                {fee
                                    ? `${fee.amount.toLocaleString()} ${CURRENCY_LABEL[fee.currency] ?? fee.currency}`
                                    : t("g.influence.free")}
                            </div>
                            <div className="text-xs text-[#8B8F98]">{t("g.influence.entryFee")}</div>
                        </div>
                    </div>
                </div>

                {!data.allowed && (
                    <div className="text-sm text-[#ff8a8a] bg-[#ff5a48]/10 border border-[#ff5a48]/30 rounded-lg p-3 mb-4">
                        {t(data.messageKey ?? "g.err.influence.closed")}
                    </div>
                )}

                {data.allowed && onChain && (
                    <div className="bg-[#ffb347]/10 border border-[#ffb347]/30 rounded-lg p-3 mb-4 space-y-2">
                        <div className="text-xs text-[#ffcf8a]">{t("g.influence.onChainHint")}</div>

                        {fee?.wallet && (
                            <button
                                type="button"
                                onClick={() => navigator.clipboard?.writeText(fee.wallet ?? "")}
                                className="w-full flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] font-mono text-[#E5E7EB] hover:border-[#ffb347]/50 transition-colors"
                            >
                                <Copy className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{fee.wallet}</span>
                            </button>
                        )}

                        <input
                            type="text"
                            value={signature}
                            onChange={(e) => setSignature(e.target.value.trim())}
                            placeholder={t("g.influence.txPlaceholder")}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] font-mono text-[#E5E7EB] outline-none focus:border-[#ffb347]/50"
                        />
                    </div>
                )}

                <button
                    onClick={() => {
                        onEnter(onChain ? signature : undefined);
                        onClose();
                    }}
                    disabled={!data.allowed || (onChain && signature.length < 32)}
                    className="w-full flex items-center justify-center gap-2 bg-[#9d6bff]/20 hover:bg-[#9d6bff]/30 disabled:opacity-40 disabled:cursor-not-allowed border border-[#9d6bff]/40 rounded-lg p-3 text-sm font-bold text-[#E5E7EB] transition-colors"
                >
                    <DoorOpen className="w-4 h-4" />
                    {t("g.influence.enter")}
                </button>
            </div>
        </div>
    );
}
