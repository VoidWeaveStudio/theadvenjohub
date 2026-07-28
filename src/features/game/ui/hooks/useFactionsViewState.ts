// src/features/game/ui/hooks/useFactionsViewState.ts
import { useEffect, useRef, useState } from "react";
import { FactionDetail, FactionSummary } from "../../network/NetworkManager";

export type FactionsTab = "members" | "upgrades" | "tasks" | "search" | "leaderboard";
const OWN_FACTION_TABS: FactionsTab[] = ["members", "upgrades", "tasks"];

interface UseFactionsViewStateArgs {
    isOpen: boolean;
    myFaction: FactionDetail | FactionSummary | null;
    viewedFaction: FactionDetail | null;
    searchResults: FactionSummary[];
    browseResults: FactionSummary[];
    onRequestOwnFaction: () => void;
    onViewFaction: (factionId: string) => void;
    onSearchFactions: (ca?: string, name?: string) => void;
    onBrowseFactions: () => void;
    onRequestFactionLeaderboard: () => void;
}

export function useFactionsViewState({
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
}: UseFactionsViewStateArgs) {
    const [activeTab, setActiveTabState] = useState<FactionsTab>("members");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingFactionId, setViewingFactionId] = useState<string | null>(null);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (OWN_FACTION_TABS.includes(activeTab)) onRequestOwnFaction();
        if (activeTab === "search") onBrowseFactions();
        if (activeTab === "leaderboard") onRequestFactionLeaderboard();
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (!isOpen || !OWN_FACTION_TABS.includes(activeTab) || !myFaction) return;
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

    const setActiveTab = (id: FactionsTab) => {
        setActiveTabState(id);
        setViewingFactionId(null);
    };

    const displayedResults = searchQuery.trim().length > 0 ? searchResults : browseResults;
    const isViewingOwnDetail = OWN_FACTION_TABS.includes(activeTab) && !!myFaction && !!viewedFaction && viewedFaction.id === myFaction.id;
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
