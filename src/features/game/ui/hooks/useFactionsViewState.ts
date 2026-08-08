// src/features/game/ui/hooks/useFactionsViewState.ts
import { useEffect, useRef, useState } from "react";
import { FactionDetail, FactionSummary } from "../../network/NetworkManager";

export type FactionsTab = "my" | "members" | "upgrades" | "tasks" | "quests" | "search" | "leaderboard" | "create";
export const FACTION_DETAIL_TABS: FactionsTab[] = ["members", "upgrades", "tasks", "quests"];

interface UseFactionsViewStateArgs {
    isOpen: boolean;
    myFactions: FactionSummary[];
    selectedFactionId: string | null;
    setSelectedFactionId: (id: string | null) => void;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    onRequestMyFactions: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
}

export function useFactionsViewState({
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
}: UseFactionsViewStateArgs) {
    const [activeTab, setActiveTabState] = useState<FactionsTab>("my");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingFactionId, setViewingFactionId] = useState<string | null>(null);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === "my" || FACTION_DETAIL_TABS.includes(activeTab)) onRequestMyFactions();
        if (activeTab === "search") onBrowseFactions();
        if (activeTab === "leaderboard") onRequestFactionLeaderboard();
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (!isOpen || !FACTION_DETAIL_TABS.includes(activeTab)) return;
        if (selectedFactionId && myFactions.some((f) => f.id === selectedFactionId)) return;
        setSelectedFactionId(null);
        setActiveTabState("my");
    }, [isOpen, activeTab, myFactions, selectedFactionId]);

    useEffect(() => {
        if (!isOpen || !FACTION_DETAIL_TABS.includes(activeTab) || !selectedFactionId) return;
        if (!viewedFaction || viewedFaction.id !== selectedFactionId) {
            onViewFaction(selectedFactionId);
        }
    }, [isOpen, activeTab, selectedFactionId, viewedFaction]);

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

    const setActiveTab = (id: FactionsTab) => {
        setActiveTabState(id);
        setViewingFactionId(null);
    };

    const openFactionDetail = (factionId: string) => {
        setSelectedFactionId(factionId);
        setActiveTabState("members");
        setViewingFactionId(null);
    };

    const closeFactionDetail = () => {
        setSelectedFactionId(null);
        setActiveTabState("my");
        setViewingFactionId(null);
    };

    const displayedResults = searchQuery.trim().length > 0 ? searchResults : browseResults;
    const isViewingOwnDetail = FACTION_DETAIL_TABS.includes(activeTab) && !!selectedFactionId && !!viewedFaction && viewedFaction.id === selectedFactionId;
    const isViewingSearchedDetail = !FACTION_DETAIL_TABS.includes(activeTab) && !!viewingFactionId && !!viewedFaction && viewedFaction.id === viewingFactionId;

    return {
        activeTab,
        setActiveTab,
        openFactionDetail,
        closeFactionDetail,
        searchQuery,
        setSearchQuery,
        viewingFactionId,
        setViewingFactionId,
        displayedResults,
        isViewingOwnDetail,
        isViewingSearchedDetail,
    };
}
