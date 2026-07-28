// src/features/game/ui/FactionDetailView.tsx
"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { FactionRosterList } from "./FactionRosterList";

interface FactionDetailViewProps {
    faction: FactionDetail;
    isOwnFaction: boolean;
    onLeaveFaction?: () => void;
    onBack?: () => void;
}

export function FactionDetailView({ faction, isOwnFaction, onLeaveFaction, onBack }: FactionDetailViewProps) {
    return (
        <div className="space-y-4">
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to search
                </button>
            )}

            <FactionHeader faction={faction} />
            <FactionRosterList faction={faction} />

            {isOwnFaction && onLeaveFaction && (
                <button
                    onClick={onLeaveFaction}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold"
                >
                    <LogOut className="w-4 h-4" />
                    Leave Faction
                </button>
            )}
        </div>
    );
}
