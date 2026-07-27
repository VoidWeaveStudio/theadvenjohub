// src/features/game/ui/hooks/useFactionState.ts
import { useCallback, useState } from "react";
import { FactionSummary, FactionDetail } from "../../network/NetworkManager";

export function useFactionState() {
    const [myFaction, setMyFaction] = useState<FactionDetail | FactionSummary | null>(null);
    const [viewedFaction, setViewedFaction] = useState<FactionDetail | null>(null);
    const [searchResults, setSearchResults] = useState<FactionSummary[]>([]);
    const [browseResults, setBrowseResults] = useState<FactionSummary[]>([]);

    const handleFactionCreated = useCallback((faction: FactionSummary) => {
        setMyFaction(faction);
    }, []);

    const handleFactionJoined = useCallback((faction: FactionSummary) => {
        setMyFaction(faction);
    }, []);

    const handleFactionLeft = useCallback(() => {
        setMyFaction(null);
    }, []);

    const handleFactionSearchResult = useCallback((results: FactionSummary[]) => {
        setSearchResults(results);
    }, []);

    const handleFactionListResult = useCallback((data: { results: FactionSummary[]; page: number }) => {
        setBrowseResults(data.results);
    }, []);

    const handleFactionInfo = useCallback((faction: FactionDetail | null) => {
        if (faction && "roster" in faction) {
            setViewedFaction(faction);
        } else {
            setMyFaction(faction);
        }
    }, []);

    const clearSearchResults = useCallback(() => {
        setSearchResults([]);
    }, []);

    const clearViewedFaction = useCallback(() => {
        setViewedFaction(null);
    }, []);

    return {
        myFaction,
        viewedFaction,
        searchResults,
        browseResults,
        handleFactionCreated,
        handleFactionJoined,
        handleFactionLeft,
        handleFactionSearchResult,
        handleFactionListResult,
        handleFactionInfo,
        clearSearchResults,
        clearViewedFaction,
    };
}
