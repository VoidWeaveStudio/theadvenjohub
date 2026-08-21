// src/features/game/ui/hooks/useCompanionState.ts
import { useCallback, useState } from "react";
import { CompanionStateData, CrateOpenedData } from "../../network/NetworkManager";

const EMPTY: CompanionStateData = { owned: [], equipped: null, fragments: 0, crates: 0 };

export function useCompanionState() {
    const [companions, setCompanions] = useState<CompanionStateData>(EMPTY);
    const [lastDrop, setLastDrop] = useState<CrateOpenedData | null>(null);
    const [lastDust, setLastDust] = useState<{ itemId: string; gained: number } | null>(null);

    const handleCompanionState = useCallback((data: CompanionStateData) => {
        setCompanions(data);
    }, []);

    const handleCrateOpened = useCallback((data: CrateOpenedData) => {
        setLastDrop(data);
    }, []);

    const handleCompanionDusted = useCallback((data: { itemId: string; gained: number }) => {
        setLastDust(data);
    }, []);

    const clearDrop = useCallback(() => setLastDrop(null), []);

    return {
        companions,
        lastDrop,
        lastDust,
        handleCompanionState,
        handleCrateOpened,
        handleCompanionDusted,
        clearDrop,
    };
}
