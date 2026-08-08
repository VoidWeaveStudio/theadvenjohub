// src/features/game/ui/hooks/useCosmeticState.ts
import { useCallback, useState } from "react";
import { CosmeticStateData } from "../../network/NetworkManager";

const EMPTY: CosmeticStateData = { owned: [], skinId: null, accessoryId: null };

export function useCosmeticState() {
    const [cosmetics, setCosmetics] = useState<CosmeticStateData>(EMPTY);

    const handleCosmeticState = useCallback((data: CosmeticStateData) => {
        setCosmetics(data);
    }, []);

    return { cosmetics, handleCosmeticState };
}
