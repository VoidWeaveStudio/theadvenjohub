// src/features/game/ui/hooks/useFactionState.ts
import { useCallback, useState } from "react";
import { FactionSummary, FactionDetail, FactionTaskDefinition, FactionTreasuryData } from "../../network/NetworkManager";

export function useFactionState() {
    const [myFactions, setMyFactions] = useState<FactionSummary[]>([]);
    const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
    const [viewedFaction, setViewedFaction] = useState<FactionDetail | null>(null);
    const [searchResults, setSearchResults] = useState<FactionSummary[]>([]);
    const [browseResults, setBrowseResults] = useState<FactionSummary[]>([]);
    const [taskDefinitions, setTaskDefinitions] = useState<FactionTaskDefinition[]>([]);

    const handleFactionMyListResult = useCallback((factions: FactionSummary[]) => {
        setMyFactions(factions);
    }, []);

    const handleFactionJoined = useCallback((faction: FactionSummary) => {
        setMyFactions((prev) => (prev.some((f) => f.id === faction.id) ? prev : [...prev, faction]));
    }, []);

    const handleFactionLeft = useCallback((factionId: string) => {
        setMyFactions((prev) => prev.filter((f) => f.id !== factionId));
        setSelectedFactionId((prev) => (prev === factionId ? null : prev));
        setViewedFaction((prev) => (prev && prev.id === factionId ? null : prev));
    }, []);

    const handleFactionDisplayedSet = useCallback((faction: FactionSummary) => {
        setMyFactions((prev) => prev.map((f) => ({ ...f, isDisplayed: f.id === faction.id })));
    }, []);

    const handleFactionTreasury = useCallback((data: FactionTreasuryData) => {
        const apply = <T extends FactionSummary>(faction: T): T => (
            faction.id === data.factionId
                ? {
                    ...faction,
                    treasuryAsh: data.ash,
                    treasuryCompanionFragments: data.companionFragments,
                    treasuryCosmeticFragments: data.cosmeticFragments,
                }
                : faction
        );

        setMyFactions((prev) => prev.map(apply));
        setViewedFaction((prev) => (prev ? apply(prev) : prev));
    }, []);

    const handleFactionSearchResult = useCallback((results: FactionSummary[]) => {
        setSearchResults(results);
    }, []);

    const handleFactionListResult = useCallback((data: { results: FactionSummary[]; page: number }) => {
        setBrowseResults(data.results);
    }, []);


    const mergeFactionUpdate = useCallback((faction: FactionSummary) => {
        setMyFactions((prev) => prev.map((f) => (f.id === faction.id ? { ...f, ...faction } : f)));
        setViewedFaction((prev) => (prev && prev.id === faction.id ? { ...prev, ...faction } : prev));
    }, []);

    const handleFactionInfo = useCallback((faction: FactionDetail | null) => {
        setViewedFaction(faction);
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
        myFactions,
        selectedFactionId,
        setSelectedFactionId,
        viewedFaction,
        searchResults,
        browseResults,
        taskDefinitions,
        handleFactionMyListResult,
        handleFactionJoined,
        handleFactionLeft,
        handleFactionDisplayedSet,
        handleFactionTreasury,
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
