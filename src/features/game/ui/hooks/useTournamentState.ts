// src/features/game/ui/hooks/useTournamentState.ts
import { useCallback, useState } from "react";
import type { TournamentEntryView, TournamentSummary } from "../../network/NetworkManager";

export function useTournamentState() {
    const [isTournamentBoardOpen, setIsTournamentBoardOpen] = useState(false);
    const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
    // Entries are fetched per contest, so they are cached by id rather than kept
    // as a single list — reopening a contest shows the old roster immediately
    // while the refresh is in flight.
    const [entriesById, setEntriesById] = useState<Record<string, TournamentEntryView[]>>({});
    // Set when a build submission is waiting for the player to reach their own
    // bubble and frame the shot themselves.
    const [pendingBuildShot, setPendingBuildShot] = useState<string | null>(null);

    const handleTournamentListResult = useCallback((list: TournamentSummary[]) => {
        setTournaments(list);
    }, []);

    const handleTournamentEntriesResult = useCallback(
        (data: { tournamentId: string; entries: TournamentEntryView[] }) => {
            setEntriesById((prev) => ({ ...prev, [data.tournamentId]: data.entries }));
        },
        []
    );

    return {
        isTournamentBoardOpen,
        setIsTournamentBoardOpen,
        tournaments,
        entriesById,
        pendingBuildShot,
        setPendingBuildShot,
        handleTournamentListResult,
        handleTournamentEntriesResult,
    };
}
