// src/features/game/ui/FactionsWindow.tsx
"use client";

import Image from "next/image";
import { Search, Trophy, Plus, Users, Sparkles, ClipboardList, Star, ChevronLeft, ScrollText, Flag } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FactionDetailView } from "./FactionDetailView";
import { FactionMembersPanel } from "./FactionMembersPanel";
import { FactionUpgradesPanel } from "./FactionUpgradesPanel";
import { FactionTasksPanel } from "./FactionTasksPanel";
import { FactionQuestsPanel } from "./FactionQuestsPanel";
import { FactionCreateForm } from "./FactionCreateForm";
import { FactionRow, FactionLeaderboardList } from "./FactionRow";
import { FactionDetail, FactionSummary, FactionTaskDefinition, FactionQuestManageData } from "../network/NetworkManager";
import { useFactionsViewState, FactionsTab, FACTION_DETAIL_TABS } from "./hooks/useFactionsViewState";
import { NicknameMenuActions } from "./shell/NicknameMenu";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface FactionsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    myWallet: string;
    gameSlug: string;
    ash: number;
    myFactions: FactionSummary[];
    selectedFactionId: string | null;
    setSelectedFactionId: (id: string | null) => void;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    factionLeaderboard: FactionSummary[];
    taskDefinitions: FactionTaskDefinition[];
    questManageData: FactionQuestManageData | null;
    onRequestMyFactions: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
    onJoinFaction: (factionId: string) => void;
    onLeaveFaction: (factionId: string) => void;
    onSetDisplayedFaction: (factionId: string) => void;
    onRequestTaskList: () => void;
    onAcceptTask: (factionId: string, taskKey: string) => void;
    onClaimCreator: (factionId: string) => void;
    onRequestQuestManageList: (factionId: string) => void;
    onCreateQuest: (factionId: string, targetUrl: string, slotsTotal: number, rewardAsh: number) => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

export function FactionsWindow({
    isOpen,
    onClose,
    myWallet,
    gameSlug,
    ash,
    myFactions,
    selectedFactionId,
    setSelectedFactionId,
    viewedFaction,
    searchResults,
    browseResults,
    factionLeaderboard,
    taskDefinitions,
    questManageData,
    onRequestMyFactions,
    onViewFaction,
    onSearchFactions,
    onBrowseFactions,
    onRequestFactionLeaderboard,
    onJoinFaction,
    onLeaveFaction,
    onSetDisplayedFaction,
    onRequestTaskList,
    onAcceptTask,
    onClaimCreator,
    onRequestQuestManageList,
    onCreateQuest,
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

    const inFactionDetail = FACTION_DETAIL_TABS.includes(view.activeTab);

    const { t } = useLanguage();

    const rootTabs = [
        { id: "my", label: t("g.faction.mine"), icon: <Users className="w-3.5 h-3.5" /> },
        { id: "search", label: t("g.faction.search"), icon: <Search className="w-3.5 h-3.5" /> },
        { id: "leaderboard", label: t("g.faction.leaderboard"), icon: <Trophy className="w-3.5 h-3.5" /> },
        { id: "create", label: t("g.faction.create"), icon: <Plus className="w-3.5 h-3.5" /> },
    ];

    const detailTabs = [
        { id: "members", label: t("g.faction.members"), icon: <Users className="w-3.5 h-3.5" /> },
        { id: "upgrades", label: t("g.faction.upgrades"), icon: <Sparkles className="w-3.5 h-3.5" /> },
        { id: "tasks", label: t("g.faction.tasks"), icon: <ClipboardList className="w-3.5 h-3.5" /> },
        { id: "quests", label: t("g.menu.quests"), icon: <ScrollText className="w-3.5 h-3.5" /> },
    ];

    const backToMyFactions = (
        <button
            onClick={view.closeFactionDetail}
            className="flex items-center gap-1 text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold mb-3"
        >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("g.faction.backToMine")}
        </button>
    );

    const renderDetailTab = (panel: React.ReactNode) => (
        <div>
            {backToMyFactions}
            {view.isViewingOwnDetail && viewedFaction ? panel : (
                <p className="text-[#8B8F98] text-sm text-center py-10">{t("g.common.loading")}</p>
            )}
        </div>
    );

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.menu.factions")}
            icon={
                <Image
                    src="/icons/topmenu/factions-v3.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            tabs={inFactionDetail ? detailTabs : rootTabs}
            activeTab={view.activeTab}
            onTabChange={(id) => view.setActiveTab(id as FactionsTab)}
        >
            {view.activeTab === "my" && (
                <div className="space-y-3">
                    {myFactions.length === 0 ? (
                        <div className="text-center py-10 space-y-4">
                            <p className="text-[#8B8F98] text-sm">{t("g.factions.none")}</p>
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={() => view.setActiveTab("create")} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" />
                                    {t("g.faction.found")}
                                </button>
                                <button onClick={() => view.setActiveTab("search")} className="btn-secondary px-4 py-2 text-sm">
                                    {t("g.faction.searchTitle")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-[#8B8F98] text-xs">
                                You belong to {myFactions.length} {myFactions.length === 1 ? "faction" : "factions"}. Pick one to manage it.
                            </p>
                            <div className="space-y-2">
                                {myFactions.map((f) => (
                                    <div key={f.id} className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <FactionRow faction={f} onClick={() => view.openFactionDetail(f.id)} />
                                        </div>
                                        <button
                                            onClick={() => onSetDisplayedFaction(f.id)}
                                            title={f.isDisplayed ? t("g.faction.shownOnAvatar") : t("g.faction.showOnAvatar")}
                                            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${f.isDisplayed ? "text-[#FFD166]" : "text-[#6B7280] hover:text-[#FFD166]"
                                                }`}
                                        >
                                            <Star className="w-4 h-4" fill={f.isDisplayed ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {view.activeTab === "members" &&
                renderDetailTab(
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
                renderDetailTab(
                    viewedFaction && (
                        <FactionUpgradesPanel
                            faction={viewedFaction}
                            myWallet={myWallet}
                            onPurchased={() => onViewFaction(viewedFaction.id)}
                        />
                    )
                )}

            {view.activeTab === "tasks" &&
                renderDetailTab(
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

            {view.activeTab === "quests" &&
                renderDetailTab(
                    viewedFaction && (
                        <FactionQuestsPanel
                            faction={viewedFaction}
                            myWallet={myWallet}
                            ash={ash}
                            manageData={questManageData}
                            onRequestManageList={() => onRequestQuestManageList(viewedFaction.id)}
                            onCreateQuest={(targetUrl, slotsTotal, rewardAsh) =>
                                onCreateQuest(viewedFaction.id, targetUrl, slotsTotal, rewardAsh)
                            }
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
                                    placeholder={t("g.faction.searchPlaceholder")}
                                    className="w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] pl-9 pr-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#4FD1FF]/50 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                {view.displayedResults.length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.faction.noneFound")}</p>
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

            {view.activeTab === "create" && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E5E7EB] font-bold">
                        <Flag className="w-4 h-4 text-[#a855f7]" />
                        {t("g.faction.found")}
                    </div>
                    <p className="text-[#8B8F98] text-xs">
                        Same deal Alaric offers in the Main Hall — you can do it from here instead. You must hold the token in
                        your wallet, and only one founded faction per player.
                    </p>
                    <FactionCreateForm
                        gameSlug={gameSlug}
                        onCreated={() => {
                            onRequestMyFactions();
                            view.setActiveTab("my");
                        }}
                    />
                </div>
            )}
        </WindowFrame>
    );
}
