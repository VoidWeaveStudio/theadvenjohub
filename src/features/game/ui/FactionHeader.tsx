// src/features/game/ui/FactionHeader.tsx
"use client";

import { Users, Trophy } from "lucide-react";
import { FactionSummary } from "../network/NetworkManager";
import { CopyableText } from "./shell/CopyableText";

interface FactionHeaderProps {
    faction: FactionSummary;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function FactionHeader({ faction }: FactionHeaderProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                {faction.image ? (
                    <img src={faction.image} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center flex-shrink-0">
                        <Users className="w-8 h-8 text-[#8B8F98]" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[#E5E7EB] text-xl font-bold truncate">{faction.name}</h3>
                        {faction.symbol && <span className="text-[#8B8F98] text-sm flex-shrink-0">${faction.symbol}</span>}
                        <span className="bg-[rgba(79,209,255,0.15)] text-[#4FD1FF] text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            Lv. {faction.level}
                        </span>
                    </div>
                    <div className="text-[#8B8F98] text-xs font-mono mt-0.5 flex items-center gap-1">
                        <span>#{faction.number} · Founded by</span>
                        <CopyableText
                            value={faction.founderWallet}
                            display={truncateWallet(faction.founderWallet)}
                            iconClassName="w-3 h-3"
                        />
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between text-xs text-[#8B8F98] mb-1">
                    <span>Faction Level {faction.level}</span>
                    <span>{faction.levelProgressAsh} / {faction.xpForNextLevel} Ash</span>
                </div>
                <div className="h-1.5 w-full bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#4FD1FF] rounded-full"
                        style={{ width: `${Math.min(100, (faction.levelProgressAsh / faction.xpForNextLevel) * 100)}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                    <div className="text-[#8B8F98] text-xs flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Members
                    </div>
                    <div className="text-[#E5E7EB] text-lg font-bold">{faction.memberCount}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                    <div className="text-[#8B8F98] text-xs flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" />
                        Rank
                    </div>
                    <div className="text-[#FFD166] text-lg font-bold">{faction.rank ? `#${faction.rank}` : "—"}</div>
                </div>
            </div>

            {faction.tokenCa && (
                <div>
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">TOKEN CA</span>
                    <div className="mt-1">
                        <CopyableText
                            value={faction.tokenCa}
                            className="text-[#E5E7EB] text-sm break-all"
                            iconClassName="w-4 h-4"
                        />
                    </div>
                </div>
            )}

            <p className="text-[#8B8F98] text-sm">{faction.description || "No description."}</p>
        </div>
    );
}
