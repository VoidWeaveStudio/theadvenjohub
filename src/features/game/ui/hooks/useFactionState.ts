// src/features/game/ui/hooks/useFactionState.ts
import { useCallback, useState } from "react";
import { FactionSummary, FactionDetail, FactionTaskDefinition } from "../../network/NetworkManager";

export function useFactionState() {
    const [myFaction, setMyFaction] = useState<FactionDetail | FactionSummary | null>(null);
    const [viewedFaction, setViewedFaction] = useState<FactionDetail | null>(null);
    const [searchResults, setSearchResults] = useState<FactionSummary[]>([]);
    const [browseResults, setBrowseResults] = useState<FactionSummary[]>([]);
    const [taskDefinitions, setTaskDefinitions] = useState<FactionTaskDefinition[]>([]);

    const handleFactionCreated = useCallback((faction: FactionSummary) => {
        setMyFaction(faction);
    }, []);

    const handleFactionJoined = useCallback((faction: FactionSummary) => {
        setMyFaction(faction);
    }, []);

    const handleFactionLeft = useCallback(() => {
        setMyFaction(null);
        setViewedFaction(null);
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

    // Task-accept / creator-claim responses carry a FactionSummary (no roster) —
    // merge the updated fields into whichever cached faction(s) match its id,
    // preserving the roster on viewedFaction if one was already loaded.
    const mergeFactionUpdate = useCallback((faction: FactionSummary) => {
        setMyFaction((prev) => (prev && prev.id === faction.id ? { ...prev, ...faction } : prev));
        setViewedFaction((prev) => (prev && prev.id === faction.id ? { ...prev, ...faction } : prev));
    }, []);

    const handleFactionTaskListResult = useCallback((tasks: FactionTaskDefinition[]) => {
        setTaskDefinitions(tasks);
    }, []);

    const handleFactionTaskAccepted = useCallback((faction: FactionSummary) => {
        mergeFactionUpdate(faction);
    }, [mergeFactionUpdate]);

    const handleFactionCreatorClaimResult = useCallback((data: { isCreator: boolean; faction: FactionSummary }) => {
        mergeFactionUpdate(data.faction);
    }, [mergeFactionUpdate]);

    const handleFactionCreatorVerified = useCallback((faction: FactionSummary) => {
        mergeFactionUpdate(faction);
    }, [mergeFactionUpdate]);

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
        taskDefinitions,
        handleFactionCreated,
        handleFactionJoined,
        handleFactionLeft,
        handleFactionSearchResult,
        handleFactionListResult,
        handleFactionInfo,
        handleFactionTaskListResult,
        handleFactionTaskAccepted,
        handleFactionCreatorClaimResult,
        handleFactionCreatorVerified,
        clearSearchResults,
        clearViewedFaction,
    };
}
