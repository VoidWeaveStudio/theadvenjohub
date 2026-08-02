// src/features/game/ui/FactionsWindow.tsx
"use client";

import Image from "next/image";
import { Search, Trophy, Plus, Users, Sparkles, ClipboardList, Star, ChevronLeft } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FactionDetailView } from "./FactionDetailView";
import { FactionMembersPanel } from "./FactionMembersPanel";
import { FactionUpgradesPanel } from "./FactionUpgradesPanel";
import { FactionTasksPanel } from "./FactionTasksPanel";
import { FactionRow, FactionLeaderboardList } from "./FactionRow";
import { FactionDetail, FactionSummary, FactionTaskDefinition } from "../network/NetworkManager";
import { useFactionsViewState, FactionsTab } from "./hooks/useFactionsViewState";
import { NicknameMenuActions } from "./shell/NicknameMenu";

interface FactionsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    myWallet: string;
    myFactions: FactionSummary[];
    selectedFactionId: string | null;
    setSelectedFactionId: (id: string | null) => void;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    factionLeaderboard: FactionSummary[];
    taskDefinitions: FactionTaskDefinition[];
    onRequestMyFactions: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
    onJoinFaction: (factionId: string) => void;
    onLeaveFaction: (factionId: string) => void;
    onSetDisplayedFaction: (factionId: string) => void;
    onOpenCreateFaction: () => void;
    onRequestTaskList: () => void;
    onAcceptTask: (factionId: string, taskKey: string) => void;
    onClaimCreator: (factionId: string) => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

export function FactionsWindow({
    isOpen,
    onClose,
    myWallet,
    myFactions,
    selectedFactionId,
    setSelectedFactionId,
    viewedFaction,
    searchResults,
    browseResults,
    factionLeaderboard,
    taskDefinitions,
    onRequestMyFactions,
    onViewFaction,
    onSearchFactions,
    onBrowseFactions,
    onRequestFactionLeaderboard,
    onJoinFaction,
    onLeaveFaction,
    onSetDisplayedFaction,
    onOpenCreateFaction,
    onRequestTaskList,
    onAcceptTask,
    onClaimCreator,
    getNicknameMenuActions,
}: FactionsWindowProps) {
    const view = useFactionsViewState({
        isOpen,
        myFactions,
        selectedFactionId,
        setSelectedFactionId,
        viewedFaction,
        searchResults,
        browseResults,
        onRequestMyFactions,
        onViewFaction,
        onSearchFactions,
        onBrowseFactions,
        onRequestFactionLeaderboard,
    });

    const hasFactions = myFactions.length > 0;
    const showSwitcher = myFactions.length > 1 && !selectedFactionId;

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

    const factionSwitcher = (
        <div className="space-y-3">
            <p className="text-[#8B8F98] text-xs">You belong to {myFactions.length} factions. Pick one to view.</p>
            <div className="space-y-2">
                {myFactions.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                        <div className="flex-1">
                            <FactionRow faction={f} onClick={() => setSelectedFactionId(f.id)} />
                        </div>
                        <button
                            onClick={() => onSetDisplayedFaction(f.id)}
                            title={f.isDisplayed ? "Shown on your avatar" : "Show this faction on your avatar"}
                            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${f.isDisplayed ? "text-[#FFD166]" : "text-[#6B7280] hover:text-[#FFD166]"
                                }`}
                        >
                            <Star className="w-4 h-4" fill={f.isDisplayed ? "currentColor" : "none"} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    const backToSwitcher = myFactions.length > 1 && (
        <button
            onClick={() => setSelectedFactionId(null)}
            className="flex items-center gap-1 text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold mb-3"
        >
            <ChevronLeft className="w-3.5 h-3.5" />
            All my factions
        </button>
    );

    const renderOwnFactionTab = (panel: React.ReactNode) => {
        if (!hasFactions) return noFactionPrompt;
        if (showSwitcher) return factionSwitcher;
        if (view.isViewingOwnDetail && viewedFaction) {
            return (
                <div>
                    {backToSwitcher}
                    {panel}
                </div>
            );
        }
        return <p className="text-[#8B8F98] text-sm text-center py-10">Loading...</p>;
    };

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Factions"
            icon={
                <Image
                    src="/icons/topmenu/factions-v3.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
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
            {view.activeTab === "members" &&
                renderOwnFactionTab(
                    viewedFaction && (
                        <FactionMembersPanel
                            faction={viewedFaction}
                            onClaimCreator={() => onClaimCreator(viewedFaction.id)}
                            onLeaveFaction={() => onLeaveFaction(viewedFaction.id)}
                            getNicknameMenuActions={getNicknameMenuActions}
                        />
                    )
                )}

            {view.activeTab === "upgrades" &&
                renderOwnFactionTab(
                    viewedFaction && (
                        <FactionUpgradesPanel
                            faction={viewedFaction}
                            myWallet={myWallet}
                            onPurchased={() => onViewFaction(viewedFaction.id)}
                        />
                    )
                )}

            {view.activeTab === "tasks" &&
                renderOwnFactionTab(
                    viewedFaction && (
                        <FactionTasksPanel
                            faction={viewedFaction}
                            myWallet={myWallet}
                            taskDefinitions={taskDefinitions}
                            onRequestTaskList={onRequestTaskList}
                            onAcceptTask={(taskKey) => onAcceptTask(viewedFaction.id, taskKey)}
                        />
                    )
                )}

            {view.activeTab === "search" && (
                <>
                    {view.isViewingSearchedDetail && viewedFaction ? (
                        <FactionDetailView
                            faction={viewedFaction}
                            isOwnFaction={myFactions.some((mf) => mf.id === viewedFaction.id)}
                            onJoinFaction={() => onJoinFaction(viewedFaction.id)}
                            onBack={() => view.setViewingFactionId(null)}
                            getNicknameMenuActions={getNicknameMenuActions}
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
                                    view.displayedResults.map((f) => {
                                        const alreadyMember = myFactions.some((mf) => mf.id === f.id);
                                        return (
                                            <div key={f.id} className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <FactionRow faction={f} onClick={() => view.setViewingFactionId(f.id)} />
                                                </div>
                                                {!alreadyMember && (
                                                    <button
                                                        onClick={() => onJoinFaction(f.id)}
                                                        className="btn-success px-3 py-1.5 text-xs flex-shrink-0"
                                                    >
                                                        Join
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
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
                            isOwnFaction={myFactions.some((mf) => mf.id === viewedFaction.id)}
                            onJoinFaction={() => onJoinFaction(viewedFaction.id)}
                            onBack={() => view.setViewingFactionId(null)}
                            getNicknameMenuActions={getNicknameMenuActions}
                        />
                    ) : (
                        <FactionLeaderboardList factions={factionLeaderboard} onSelect={view.setViewingFactionId} />
                    )}
                </>
            )}
        </WindowFrame>
    );
}
