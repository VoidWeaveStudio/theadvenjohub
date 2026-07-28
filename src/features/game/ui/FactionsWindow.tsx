// src/features/game/ui/FactionsWindow.tsx
"use client";

import { Flag, Search, Trophy, Plus, Users, Sparkles, ClipboardList } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FactionDetailView } from "./FactionDetailView";
import { FactionMembersPanel } from "./FactionMembersPanel";
import { FactionUpgradesPanel } from "./FactionUpgradesPanel";
import { FactionTasksPanel } from "./FactionTasksPanel";
import { FactionRow, FactionLeaderboardList } from "./FactionRow";
import { FactionDetail, FactionSummary, FactionTaskDefinition } from "../network/NetworkManager";
import { useFactionsViewState, FactionsTab } from "./hooks/useFactionsViewState";

interface FactionsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    myWallet: string;
    myFaction: FactionDetail | FactionSummary | null;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    factionLeaderboard: FactionSummary[];
    taskDefinitions: FactionTaskDefinition[];
    onRequestOwnFaction: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
    onJoinFaction: (factionId: string) => void;
    onLeaveFaction: () => void;
    onOpenCreateFaction: () => void;
    onRequestTaskList: () => void;
    onAcceptTask: (taskKey: string) => void;
    onClaimCreator: () => void;
}

export function FactionsWindow({
    isOpen,
    onClose,
    myWallet,
    myFaction,
    viewedFaction,
    searchResults,
    browseResults,
    factionLeaderboard,
    taskDefinitions,
    onRequestOwnFaction,
    onViewFaction,
    onSearchFactions,
    onBrowseFactions,
    onRequestFactionLeaderboard,
    onJoinFaction,
    onLeaveFaction,
    onOpenCreateFaction,
    onRequestTaskList,
    onAcceptTask,
    onClaimCreator,
}: FactionsWindowProps) {
    const view = useFactionsViewState({
        isOpen,
        myFaction,
        viewedFaction,
        searchResults,
        browseResults,
        onRequestOwnFaction,
        onViewFaction,
        onSearchFactions,
        onBrowseFactions,
        onRequestFactionLeaderboard,
    });

    const noFactionPrompt = (
        <div className="text-center py-10 space-y-4">
            <p className="text-[#8B8F98] text-sm">You haven&apos;t founded or joined a faction yet.</p>
            <div className="flex items-center justify-center gap-3">
                <button onClick={onOpenCreateFaction} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    Found a Faction
                </button>
                <button onClick={() => view.setActiveTab("search")} className="btn-secondary px-4 py-2 text-sm">
                    Search Factions
                </button>
            </div>
        </div>
    );

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Factions"
            icon={<Flag className="w-4 h-4" />}
            tabs={[
                { id: "members", label: "Members", icon: <Users className="w-3.5 h-3.5" /> },
                { id: "upgrades", label: "Upgrades", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "tasks", label: "Tasks", icon: <ClipboardList className="w-3.5 h-3.5" /> },
                { id: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
                { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-3.5 h-3.5" /> },
            ]}
            activeTab={view.activeTab}
            onTabChange={(id) => view.setActiveTab(id as FactionsTab)}
        >
            {view.activeTab === "members" && (
                !myFaction ? noFactionPrompt : view.isViewingOwnDetail && viewedFaction ? (
                    <FactionMembersPanel
                        faction={viewedFaction}
                        myWallet={myWallet}
                        onClaimCreator={onClaimCreator}
                        onLeaveFaction={onLeaveFaction}
                    />
                ) : (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                )
            )}

            {view.activeTab === "upgrades" && (
                !myFaction ? noFactionPrompt : view.isViewingOwnDetail && viewedFaction ? (
                    <FactionUpgradesPanel faction={viewedFaction} />
                ) : (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                )
            )}

            {view.activeTab === "tasks" && (
                !myFaction ? noFactionPrompt : view.isViewingOwnDetail && viewedFaction ? (
                    <FactionTasksPanel
                        faction={viewedFaction}
                        myWallet={myWallet}
                        taskDefinitions={taskDefinitions}
                        onRequestTaskList={onRequestTaskList}
                        onAcceptTask={onAcceptTask}
                    />
                ) : (
                    <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>
                )
            )}

            {view.activeTab === "search" && (
                <>
                    {view.isViewingSearchedDetail && viewedFaction ? (
                        <FactionDetailView
                            faction={viewedFaction}
                            isOwnFaction={false}
                            onBack={() => view.setViewingFactionId(null)}
                        />
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-[#8B8F98] absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={view.searchQuery}
                                    onChange={(e) => view.setSearchQuery(e.target.value)}
                                    placeholder="Search by name or token CA..."
                                    className="w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] pl-9 pr-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#4FD1FF]/50 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                {view.displayedResults.length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm text-center py-6">No factions found.</p>
                                ) : (
                                    view.displayedResults.map((f) => (
                                        <div key={f.id} className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <FactionRow faction={f} onClick={() => view.setViewingFactionId(f.id)} />
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

            {view.activeTab === "leaderboard" && (
                <>
                    {view.isViewingSearchedDetail && viewedFaction ? (
                        <FactionDetailView
                            faction={viewedFaction}
                            isOwnFaction={false}
                            onBack={() => view.setViewingFactionId(null)}
                        />
                    ) : (
                        <FactionLeaderboardList factions={factionLeaderboard} onSelect={view.setViewingFactionId} />
                    )}
                </>
            )}
        </WindowFrame>
    );
}
