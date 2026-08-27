// src/features/game/ui/InfluenceCrystalPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Gem, Swords, Timer, Coins } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { InfluenceCrystalPanelData, InfluenceFeeCurrency } from "../network/NetworkManager";

interface InfluenceCrystalPanelProps {
    data: InfluenceCrystalPanelData | null;
    onClose: () => void;
    onCapture: () => void;
    onSetFee: (currency: InfluenceFeeCurrency, amount: number) => void;
}

const CURRENCIES: { key: InfluenceFeeCurrency; label: string }[] = [
    { key: "none", label: "FREE" },
    { key: "ash", label: "ASH" },
    { key: "tnj", label: "TNJ" },
    { key: "faction", label: "TOKEN" },
];

function formatWhen(value: number) {
    if (!value) return "—";
    const delta = value - Date.now();
    if (delta <= 0) return "now";

    const hours = Math.floor(delta / 3600000);
    const minutes = Math.floor((delta % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function InfluenceCrystalPanel({ data, onClose, onCapture, onSetFee }: InfluenceCrystalPanelProps) {
    const { t } = useLanguage();
    const [currency, setCurrency] = useState<InfluenceFeeCurrency>("none");
    const [amount, setAmount] = useState("0");

    useEffect(() => {
        if (!data) return;
        SoundManager.getInstance().play("modal-open");
        setCurrency(data.feeCurrency);
        setAmount(String(data.feeAmount));
    }, [data]);

    if (!data) return null;

    const fraction = Math.max(0, Math.min(1, data.crystalHealth / Math.max(1, data.crystalMaxHealth)));

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-md bg-[rgba(8,10,20,0.96)] border-2 border-[#6fd8ff]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(111,216,255,0.18)]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.influence.crystalTitle")}</h2>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3 mb-2">
                    <Gem className="w-5 h-5 text-[#6fd8ff] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#E5E7EB]">
                            {data.ownerFactionName ?? t("g.influence.unclaimed")}
                        </div>
                        <div className="h-1.5 mt-1 bg-black/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#6fd8ff] to-[#9d6bff]"
                                style={{ width: `${fraction * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3 mb-4">
                    <Timer className="w-5 h-5 text-[#ffb347] flex-shrink-0" />
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-[#E5E7EB]">{formatWhen(data.nextSiegeAt)}</div>
                        <div className="text-xs text-[#8B8F98]">{t("g.influence.nextSiege")}</div>
                    </div>
                </div>

                {!data.bossDefeated && (
                    <div className="text-sm text-[#c79bff] bg-[#9d6bff]/10 border border-[#9d6bff]/30 rounded-lg p-3 mb-4">
                        {t("g.influence.sealedByBoss")}
                    </div>
                )}

                {data.canCapture && (
                    <button
                        onClick={() => {
                            onCapture();
                            onClose();
                        }}
                        disabled={!data.inRange}
                        className="w-full flex items-center justify-center gap-2 bg-[#ff5a48]/20 hover:bg-[#ff5a48]/30 disabled:opacity-40 disabled:cursor-not-allowed border border-[#ff5a48]/40 rounded-lg p-3 text-sm font-bold text-[#E5E7EB] transition-colors mb-4"
                    >
                        <Swords className="w-4 h-4" />
                        {t("g.influence.bind", { seconds: Math.round(data.captureMs / 1000) })}
                    </button>
                )}

                {data.canManage && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Coins className="w-4 h-4 text-[#ffb347]" />
                            <span className="text-sm font-bold text-[#E5E7EB]">{t("g.influence.tollTitle")}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-1 mb-3">
                            {CURRENCIES.map((entry) => (
                                <button
                                    key={entry.key}
                                    onClick={() => setCurrency(entry.key)}
                                    className={`text-xs font-bold rounded px-2 py-1.5 border transition-colors ${currency === entry.key
                                        ? "bg-[#ffb347]/25 border-[#ffb347]/50 text-[#ffd9a0]"
                                        : "bg-white/5 border-white/10 text-[#8B8F98] hover:text-[#E5E7EB]"
                                        }`}
                                >
                                    {entry.label}
                                </button>
                            ))}
                        </div>

                        {currency !== "none" && (
                            <input
                                type="number"
                                min={0}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-[#E5E7EB] mb-3 outline-none focus:border-[#ffb347]/50"
                            />
                        )}

                        <button
                            onClick={() => {
                                const parsed = Math.max(0, Math.floor(Number(amount) || 0));
                                onSetFee(currency, currency === "none" ? 0 : parsed);
                                onClose();
                            }}
                            className="w-full bg-[#ffb347]/20 hover:bg-[#ffb347]/30 border border-[#ffb347]/40 rounded-lg p-2.5 text-sm font-bold text-[#E5E7EB] transition-colors"
                        >
                            {t("g.influence.saveToll")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
