// src/features/game/ui/hooks/useCosmeticCrateState.ts
import { useCallback, useState } from "react";
import { CosmeticCrateOpenedData, CosmeticCrateStateData } from "../../network/NetworkManager";

const EMPTY: CosmeticCrateStateData = { fragments: 0, crates: 0 };

export function useCosmeticCrateState() {
    const [wallet, setWallet] = useState<CosmeticCrateStateData>(EMPTY);
    const [lastDrop, setLastDrop] = useState<CosmeticCrateOpenedData | null>(null);

    const handleState = useCallback((data: CosmeticCrateStateData) => {
        setWallet(data);
    }, []);

    const handleOpened = useCallback((data: CosmeticCrateOpenedData) => {
        setLastDrop(data);
    }, []);

    const clearDrop = useCallback(() => setLastDrop(null), []);

    return { wallet, lastDrop, handleState, handleOpened, clearDrop };
}
