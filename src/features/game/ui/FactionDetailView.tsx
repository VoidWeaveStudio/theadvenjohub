// src/features/game/ui/FactionDetailView.tsx
"use client";

import { useState } from "react";
import { Users, Crown, Copy, Check, Trophy, LogOut, ArrowLeft } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";

interface FactionDetailViewProps {
    faction: FactionDetail;
    isOwnFaction: boolean;
    onLeaveFaction?: () => void;
    onBack?: () => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function FactionDetailView({ faction, isOwnFaction, onLeaveFaction, onBack }: FactionDetailViewProps) {
    const [caCopied, setCaCopied] = useState(false);

    const handleCopyCa = () => {
        if (!faction.tokenCa) return;
        navigator.clipboard.writeText(faction.tokenCa).then(() => {
            setCaCopied(true);
            setTimeout(() => setCaCopied(false), 1500);
        });
    };

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
                    </div>
                    <p className="text-[#8B8F98] text-xs font-mono mt-0.5">#{faction.number} · Founded by {truncateWallet(faction.founderWallet)}</p>
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
                    <div className="mt-1 flex items-center gap-2">
                        <p className="text-[#E5E7EB] text-sm font-mono break-all">{faction.tokenCa}</p>
                        <button
                            onClick={handleCopyCa}
                            className="text-[#8B8F98] hover:text-[#4FD1FF] transition-colors flex-shrink-0"
                            title="Copy CA"
                        >
                            {caCopied ? <Check className="w-4 h-4 text-[#4ADE80]" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            )}

            <p className="text-[#8B8F98] text-sm">{faction.description || "No description."}</p>

            <div>
                <span className="text-[#8B8F98] text-xs font-bold tracking-wider">MEMBERS</span>
                <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                    {faction.roster.map((member) => (
                        <div
                            key={member.wallet}
                            className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2"
                        >
                            <div className="flex items-center gap-2">
                                {member.role === "founder" && <Crown className="w-3.5 h-3.5 text-[#FFD166] flex-shrink-0" />}
                                <span className="text-[#E5E7EB] text-sm">{member.nickname || "Unnamed"}</span>
                            </div>
                            <span className="text-[#8B8F98] text-xs font-mono">{truncateWallet(member.wallet)}</span>
                        </div>
                    ))}
                </div>
            </div>

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
