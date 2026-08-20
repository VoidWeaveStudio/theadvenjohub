// src/features/game/ui/FactionMembersPanel.tsx
"use client";

import { Gem, LogOut } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { FactionRosterList } from "./FactionRosterList";
import { NicknameMenuActions } from "./shell/NicknameMenu";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface FactionMembersPanelProps {
    faction: FactionDetail;
    onClaimCreator: () => void;
    onLeaveFaction: () => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

export function FactionMembersPanel({ faction, onClaimCreator, onLeaveFaction, getNicknameMenuActions }: FactionMembersPanelProps) {
    const { t } = useLanguage();
    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />
            <FactionRosterList faction={faction} getNicknameMenuActions={getNicknameMenuActions} />

            {!faction.verifiedCreatorWallet && (
                <div className="bg-[rgba(192,132,252,0.06)] border border-[rgba(192,132,252,0.2)] rounded-lg p-3 space-y-2">
                    <p className="text-[#8B8F98] text-xs">
                        Are you the wallet that created ${faction.symbol || "this token"}? Verifying gives you priority over
                        the founder for accepting faction tasks and receiving their Ash rewards, and unlocks publishing paid
                        quests in the Quests tab.
                    </p>
                    <button
                        onClick={onClaimCreator}
                        className="flex items-center gap-1.5 text-[#C084FC] hover:text-[#D8B4FE] text-xs font-bold transition-colors"
                    >
                        <Gem className="w-3.5 h-3.5" />
                        {t("g.faction.verifyCreator")}
                    </button>
                </div>
            )}

            <button
                onClick={onLeaveFaction}
                className="btn-error w-full flex items-center justify-center gap-2 text-sm"
            >
                <LogOut className="w-4 h-4" />
                {t("g.faction.leave")}
            </button>
        </div>
    );
}
