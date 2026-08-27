// src/features/game/ui/FactionControlZones.tsx
"use client";

import { Landmark, Timer, Coins, ShieldOff } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { InfluenceStateData } from "../network/NetworkManager";

interface FactionControlZonesProps {
    factionId: string;
    influence: InfluenceStateData | null;
}

const CURRENCY_LABEL: Record<string, string> = {
    ash: "ASH",
    tnj: "TNJ",
    faction: "TOKEN",
};

function formatWhen(value: number) {
    if (!value) return "—";
    const delta = value - Date.now();
    if (delta <= 0) return "—";

    const days = Math.floor(delta / 86400000);
    const hours = Math.floor((delta % 86400000) / 3600000);
    const minutes = Math.floor((delta % 3600000) / 60000);

    if (days > 0) return `${days}d ${hours}h`;
    return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function FactionControlZones({ factionId, influence }: FactionControlZonesProps) {
    const { t } = useLanguage();

    const owned = influence !== null && influence.ownerFactionId === factionId;
    const fraction = influence
        ? Math.max(0, Math.min(1, influence.crystalHealth / Math.max(1, influence.crystalMaxHealth)))
        : 0;

    return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-[#c79bff]" />
                <span className="text-sm font-bold text-[#E5E7EB]">{t("g.faction.controlZones")}</span>
            </div>

            {!owned && (
                <div className="flex items-center gap-2 text-xs text-[#8B8F98]">
                    <ShieldOff className="w-3.5 h-3.5" />
                    {t("g.faction.noControlZones")}
                </div>
            )}

            {owned && influence && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-[#E5E7EB] font-bold">{t("g.faction.zoneWard")}</span>
                        <span className={influence.phase === "siege" || influence.phase === "collapse"
                            ? "text-[#ff8a6b] font-bold"
                            : "text-[#6fd8ff]"}>
                            {influence.phase === "collapse"
                                ? t("g.influence.hudCollapse")
                                : influence.phase === "siege"
                                    ? t("g.influence.hudSiege", { wave: influence.siegeWave })
                                    : t("g.faction.zoneHeld")}
                        </span>
                    </div>

                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#6fd8ff] to-[#9d6bff]"
                            style={{ width: `${fraction * 100}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center gap-2">
                            <Timer className="w-3.5 h-3.5 text-[#ffb347] flex-shrink-0" />
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-[#E5E7EB]">{formatWhen(influence.nextSiegeAt)}</div>
                                <div className="text-[10px] text-[#8B8F98]">{t("g.influence.nextSiege")}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Coins className="w-3.5 h-3.5 text-[#ffb347] flex-shrink-0" />
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-[#E5E7EB]">
                                    {influence.feeCurrency === "none"
                                        ? t("g.influence.free")
                                        : `${influence.feeAmount.toLocaleString()} ${CURRENCY_LABEL[influence.feeCurrency] ?? ""}`}
                                </div>
                                <div className="text-[10px] text-[#8B8F98]">{t("g.influence.entryFee")}</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] text-[#8B8F98] pt-1">
                        {t("g.faction.zoneOccupants", { count: influence.occupants, capacity: influence.capacity })}
                    </div>
                </div>
            )}
        </div>
    );
}
