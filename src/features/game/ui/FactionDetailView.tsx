// src/features/game/ui/FactionDetailView.tsx
"use client";

import { ArrowLeft, LogOut, UserPlus } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { FactionRosterList } from "./FactionRosterList";
import { NicknameMenuActions } from "./shell/NicknameMenu";

interface FactionDetailViewProps {
    faction: FactionDetail;
    isOwnFaction: boolean;
    onLeaveFaction?: () => void;
    onJoinFaction?: () => void;
    onBack?: () => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

export function FactionDetailView({ faction, isOwnFaction, onLeaveFaction, onJoinFaction, onBack, getNicknameMenuActions }: FactionDetailViewProps) {
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
            <FactionRosterList faction={faction} getNicknameMenuActions={getNicknameMenuActions} />

            {isOwnFaction && onLeaveFaction && (
                <button
                    onClick={onLeaveFaction}
                    className="btn-error w-full flex items-center justify-center gap-2 text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Leave Faction
                </button>
            )}

            {!isOwnFaction && onJoinFaction && (
                <button
                    onClick={onJoinFaction}
                    className="btn-success w-full flex items-center justify-center gap-2 text-sm"
                >
                    <UserPlus className="w-4 h-4" />
                    Join Faction
                </button>
            )}
        </div>
    );
}
