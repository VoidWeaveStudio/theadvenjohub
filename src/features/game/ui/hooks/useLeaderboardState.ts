// src/features/game/ui/hooks/useLeaderboardState.ts
import { useCallback, useState } from "react";
import { LeaderboardEntry, FactionSummary } from "../../network/NetworkManager";

export function useLeaderboardState() {
    const [playerLeaderboard, setPlayerLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [factionLeaderboard, setFactionLeaderboard] = useState<FactionSummary[]>([]);

    const handlePlayerLeaderboardResult = useCallback((results: LeaderboardEntry[]) => {
        setPlayerLeaderboard(results);
    }, []);

    const handleFactionLeaderboardResult = useCallback((results: FactionSummary[]) => {
        setFactionLeaderboard(results);
    }, []);

    return {
        playerLeaderboard,
        factionLeaderboard,
        handlePlayerLeaderboardResult,
        handleFactionLeaderboardResult,
    };
}
