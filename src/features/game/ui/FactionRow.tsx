// src/features/game/ui/FactionRow.tsx
"use client";

import { Users } from "lucide-react";
import { FactionSummary } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface FactionRowProps {
    faction: FactionSummary;
    onClick: () => void;
}

export function FactionRow({ faction, onClick }: FactionRowProps) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] rounded-lg p-3 text-left transition-colors"
        >
            <div className="flex items-center gap-3 min-w-0">
                {faction.image ? (
                    <img src={faction.image} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-[#8B8F98]" />
                    </div>
                )}
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[#E5E7EB] font-bold text-sm truncate">{faction.name}</span>
                        <span className="text-[#8B8F98] text-xs font-mono flex-shrink-0">#{faction.number}</span>
                    </div>
                    <span className="text-[#8B8F98] text-xs">
                        <Users className="w-3 h-3 inline mr-1" />
                        {faction.memberCount} members
                    </span>
                </div>
            </div>
            {faction.rank && <span className="text-[#FFD166] text-xs font-bold flex-shrink-0">#{faction.rank}</span>}
        </button>
    );
}

export function FactionLeaderboardList({
    factions,
    onSelect,
}: {
    factions: FactionSummary[];
    onSelect: (factionId: string) => void;
}) {
    const { t } = useLanguage();

    if (factions.length === 0) {
        return <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.faction.noneYet")}</p>;
    }

    return (
        <div className="space-y-2">
            {factions.map((f) => (
                <FactionRow key={f.id} faction={f} onClick={() => onSelect(f.id)} />
            ))}
        </div>
    );
}
