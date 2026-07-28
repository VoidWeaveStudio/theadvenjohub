// src/features/game/ui/hooks/useFactionsViewState.ts
import { useEffect, useRef, useState } from "react";
import { FactionDetail, FactionSummary } from "../../network/NetworkManager";

export type FactionsTab = "members" | "upgrades" | "tasks" | "search" | "leaderboard";
const OWN_FACTION_TABS: FactionsTab[] = ["members", "upgrades", "tasks"];

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
    const [activeTab, setActiveTabState] = useState<FactionsTab>("members");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingFactionId, setViewingFactionId] = useState<string | null>(null);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (OWN_FACTION_TABS.includes(activeTab)) onRequestMyFactions();
        if (activeTab === "search") onBrowseFactions();
        if (activeTab === "leaderboard") onRequestFactionLeaderboard();
    }, [isOpen, activeTab]);


    useEffect(() => {
        if (!isOpen || !OWN_FACTION_TABS.includes(activeTab)) return;
        if (selectedFactionId && myFactions.some((f) => f.id === selectedFactionId)) return;
        if (myFactions.length === 1) {
            setSelectedFactionId(myFactions[0].id);
        }
    }, [isOpen, activeTab, myFactions, selectedFactionId]);

    useEffect(() => {
        if (!isOpen || !OWN_FACTION_TABS.includes(activeTab) || !selectedFactionId) return;
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

    const displayedResults = searchQuery.trim().length > 0 ? searchResults : browseResults;
    const isViewingOwnDetail = OWN_FACTION_TABS.includes(activeTab) && !!selectedFactionId && !!viewedFaction && viewedFaction.id === selectedFactionId;
    const isViewingSearchedDetail = !OWN_FACTION_TABS.includes(activeTab) && !!viewingFactionId && !!viewedFaction && viewedFaction.id === viewingFactionId;

    return {
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        viewingFactionId,
        setViewingFactionId,
        displayedResults,
        isViewingOwnDetail,
        isViewingSearchedDetail,
    };
}
