// src/features/game/ui/LeaderboardsWindow.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Trophy, Users } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { PlayerTag } from "./shell/PlayerTag";
import { FactionDetailView } from "./FactionDetailView";
import { FactionLeaderboardList } from "./FactionRow";
import { FactionDetail, FactionSummary, LeaderboardEntry } from "../network/NetworkManager";

type LeaderboardsTab = "players" | "factions";

interface LeaderboardsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    wallet: string;
    myFactions: FactionSummary[];
    playerLeaderboard: LeaderboardEntry[];
    factionLeaderboard: FactionSummary[];
    viewedFaction: FactionDetail | null;
    onRequestPlayerLeaderboard: () => void;
    onRequestFactionLeaderboard: () => void;
    onViewFaction: (factionId: string) => void;
    onViewProfile: (wallet: string) => void;
    onJoinFaction: (factionId: string) => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function LeaderboardsWindow({
    isOpen,
    onClose,
    wallet,
    myFactions,
    playerLeaderboard,
    factionLeaderboard,
    viewedFaction,
    onRequestPlayerLeaderboard,
    onRequestFactionLeaderboard,
    onViewFaction,
    onViewProfile,
    onJoinFaction,
}: LeaderboardsWindowProps) {
    const [activeTab, setActiveTab] = useState<LeaderboardsTab>("players");
    const [viewingFactionId, setViewingFactionId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === "players") onRequestPlayerLeaderboard();
        if (activeTab === "factions" && !viewingFactionId) onRequestFactionLeaderboard();
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (!viewingFactionId) return;
        onViewFaction(viewingFactionId);
    }, [viewingFactionId]);

    const isViewingFactionDetail = !!viewingFactionId && !!viewedFaction && viewedFaction.id === viewingFactionId;

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Leaderboards"
            icon={
                <Image
                    src="/icons/topmenu/leaderboard-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            tabs={[
                { id: "players", label: "Players", icon: <Trophy className="w-3.5 h-3.5" /> },
                { id: "factions", label: "Factions", icon: <Users className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => {
                setActiveTab(id as LeaderboardsTab);
                setViewingFactionId(null);
            }}
        >
            {activeTab === "players" && (
                <div className="space-y-2">
                    {playerLeaderboard.length === 0 ? (
                        <p className="text-[#8B8F98] text-sm text-center py-6">No data yet.</p>
                    ) : (
                        playerLeaderboard.map((entry, index) => (
                            <button
                                key={entry.wallet}
                                onClick={() => onViewProfile(entry.wallet)}
                                className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-colors ${entry.wallet === wallet
                                    ? "bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 hover:bg-[#4FD1FF]/15"
                                    : "bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)]"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-[#8B8F98] text-sm font-bold w-6">{index + 1}</span>
                                    <PlayerTag
                                        nickname={entry.nickname || truncateWallet(entry.wallet)}
                                        faction={entry.faction}
                                        size="sm"
                                        isAdmin={entry.isAdmin}
                                        isFactionCreator={entry.isFactionCreator}
                                    />
                                </div>
                                <span className="text-[#FFD166] font-bold text-sm">{entry.score} pts</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {activeTab === "factions" && (
                isViewingFactionDetail && viewedFaction ? (
                    <FactionDetailView
                        faction={viewedFaction}
                        isOwnFaction={myFactions.some((mf) => mf.id === viewedFaction.id)}
                        onJoinFaction={() => onJoinFaction(viewedFaction.id)}
                        onBack={() => setViewingFactionId(null)}
                    />
                ) : (
                    <FactionLeaderboardList factions={factionLeaderboard} onSelect={setViewingFactionId} />
                )
            )}
        </WindowFrame>
    );
}
