// src/features/game/ui/FactionRosterList.tsx
"use client";

import { Star } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";
import { PlayerTag } from "./shell/PlayerTag";
import { CopyableText } from "./shell/CopyableText";
import { NicknameMenu, NicknameMenuActions } from "./shell/NicknameMenu";

interface FactionRosterListProps {
    faction: FactionDetail;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function FactionRosterList({ faction, getNicknameMenuActions }: FactionRosterListProps) {
    const sortedRoster = [...faction.roster].sort((a, b) => {
        const rank = (member: typeof a) =>
            member.role === "founder" || member.wallet === faction.verifiedCreatorWallet ? 0 : 1;
        return rank(a) - rank(b);
    });

    return (
        <div>
            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">MEMBERS</span>
            <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                {sortedRoster.map((member) => {
                    const isFactionCreator = faction.verifiedCreatorWallet === member.wallet;
                    const badge = isFactionCreator ? "creator" : member.role === "founder" ? "founder" : null;
                    return (
                        <div
                            key={member.wallet}
                            className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2"
                        >
                            {getNicknameMenuActions ? (
                                <NicknameMenu {...getNicknameMenuActions(member.wallet, member.nickname || "Unnamed")}>
                                    <PlayerTag
                                        nickname={member.nickname || "Unnamed"}
                                        faction={{ image: faction.image, symbol: faction.symbol, number: faction.number }}
                                        badge={badge}
                                        size="sm"
                                        isFactionCreator={isFactionCreator}
                                    />
                                </NicknameMenu>
                            ) : (
                                <PlayerTag
                                    nickname={member.nickname || "Unnamed"}
                                    faction={{ image: faction.image, symbol: faction.symbol, number: faction.number }}
                                    badge={badge}
                                    size="sm"
                                    isFactionCreator={isFactionCreator}
                                />
                            )}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="flex items-center gap-1 text-[#FFD166] text-xs font-bold">
                                    <Star className="w-3 h-3" />
                                    {member.contributionPoints}
                                </div>
                                <CopyableText
                                    value={member.wallet}
                                    display={truncateWallet(member.wallet)}
                                    className="text-[#8B8F98] text-xs"
                                    iconClassName="w-3 h-3"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
