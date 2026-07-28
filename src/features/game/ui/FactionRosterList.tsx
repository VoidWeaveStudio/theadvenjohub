// src/features/game/ui/FactionRosterList.tsx
"use client";

import { FactionDetail } from "../network/NetworkManager";
import { PlayerTag } from "./shell/PlayerTag";

interface FactionRosterListProps {
    faction: FactionDetail;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function FactionRosterList({ faction }: FactionRosterListProps) {
    return (
        <div>
            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">MEMBERS</span>
            <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                {faction.roster.map((member) => {
                    const badge =
                        faction.verifiedCreatorWallet === member.wallet
                            ? "creator"
                            : member.role === "founder"
                                ? "founder"
                                : null;
                    return (
                        <div
                            key={member.wallet}
                            className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2"
                        >
                            <PlayerTag
                                nickname={member.nickname || "Unnamed"}
                                faction={{ image: faction.image, symbol: faction.symbol, number: faction.number }}
                                badge={badge}
                                size="sm"
                            />
                            <span className="text-[#8B8F98] text-xs font-mono">{truncateWallet(member.wallet)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
