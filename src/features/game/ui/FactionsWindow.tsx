// src/features/game/ui/FactionsWindow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Search, Trophy, Plus } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FactionDetailView } from "./FactionDetailView";
import { FactionRow, FactionLeaderboardList } from "./FactionRow";
import { FactionDetail, FactionSummary } from "../network/NetworkManager";

type FactionsTab = "my" | "search" | "leaderboard";

interface FactionsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    myFaction: FactionDetail | FactionSummary | null;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    factionLeaderboard: FactionSummary[];
    onRequestOwnFaction: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
    onJoinFaction: (factionId: string) => void;
    onLeaveFaction: () => void;
    onOpenCreateFaction: () => void;
}

export function FactionsWindow({
    isOpen,
    onClose,
    myFaction,
    viewedFaction,
    searchResults,
    browseResults,
    factionLeaderboard,
    onRequestOwnFaction,
    onViewFaction,
    onSearchFactions,
    onBrowseFactions,
    onRequestFactionLeaderboard,
    onJoinFaction,
    onLeaveFaction,
    onOpenCreateFaction,
}: FactionsWindowProps) {
    const [activeTab, setActiveTab] = useState<FactionsTab>("my");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingFactionId, setViewingFactionId] = useState<string | null>(null);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === "my") onRequestOwnFaction();
        if (activeTab === "search") onBrowseFactions();
        if (activeTab === "leaderboard") onRequestFactionLeaderboard();
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (!isOpen || activeTab !== "my" || !myFaction) return;
        if (!viewedFaction || viewedFaction.id !== myFaction.id) {
            onViewFaction(myFaction.id);
        }
    }, [isOpen, activeTab, myFaction, viewedFaction]);

    useEffect(() => {
        if (!viewingFactionId) return;
        onViewFaction(viewingFactionId);
    }, [viewingFactionId]);

    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (searchQuery.trim().length === 0) return;

        searchDebounceRef.current = setTimeout(() => {
            const trimmed = searchQuery.trim();
            const looksLikeCa = trimmed.length >= 32;
            onSearchFactions(looksLikeCa ? trimmed : undefined, looksLikeCa ? undefined : trimmed);
        }, 300);

        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery]);

    const displayedResults = searchQuery.trim().length > 0 ? searchResults : browseResults;
    const isViewingOwnDetail = activeTab === "my" && !!myFaction && !!viewedFaction && viewedFaction.id === myFaction.id;
    const isViewingSearchedDetail = activeTab !== "my" && !!viewingFactionId && !!viewedFaction && viewedFaction.id === viewingFactionId;

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Factions"
            icon={<Flag className="w-4 h-4" />}
            tabs={[
                { id: "my", label: "My Faction", icon: <Flag className="w-3.5 h-3.5" /> },
                { id: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
                { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => {
                setActiveTab(id as FactionsTab);
                setViewingFactionId(null);
            }}
        >
            {activeTab === "my" && (
                <>
                    {!myFaction ? (
                        <div className="text-center py-10 space-y-4">
                            <p className="text-[#8B8F98] text-sm">You haven&apos;t founded or joined a faction yet.</p>
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={onOpenCreateFaction} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" />
                                    Found a Faction
                                </button>
                                <button onClick={() => setActiveTab("search")} className="btn-secondary px-4 py-2 text-sm">
                                    Search Factions
                                </button>
                            </div>
                        </div>
                    ) : isViewingOwnDetail && viewedFaction ? (
                        <FactionDetailView faction={viewedFaction} isOwnFaction onLeaveFaction={onLeaveFaction} />
                    ) : (
                        <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                    )}
                </>
            )}

            {activeTab === "search" && (
                <>
                    {isViewingSearchedDetail && viewedFaction ? (
                        <FactionDetailView
                            faction={viewedFaction}
                            isOwnFaction={false}
                            onBack={() => setViewingFactionId(null)}
                        />
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-[#8B8F98] absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or token CA..."
                                    className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                {displayedResults.length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm text-center py-6">No factions found.</p>
                                ) : (
                                    displayedResults.map((f) => (
                                        <div key={f.id} className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <FactionRow faction={f} onClick={() => setViewingFactionId(f.id)} />
                                            </div>
                                            {!myFaction && (
                                                <button
                                                    onClick={() => onJoinFaction(f.id)}
                                                    className="btn-secondary px-3 py-1.5 text-xs flex-shrink-0"
                                                >
                                                    Join
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === "leaderboard" && (
                <>
                    {isViewingSearchedDetail && viewedFaction ? (
                        <FactionDetailView
                            faction={viewedFaction}
                            isOwnFaction={false}
                            onBack={() => setViewingFactionId(null)}
                        />
                    ) : (
                        <FactionLeaderboardList factions={factionLeaderboard} onSelect={setViewingFactionId} />
                    )}
                </>
            )}
        </WindowFrame>
    );
}
