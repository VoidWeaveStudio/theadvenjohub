// src/features/game/ui/hooks/useCanyonMapState.ts
import { useCallback, useState } from "react";
import { CanyonMapData } from "../../network/NetworkManager";

export function useCanyonMapState() {
  const [isCanyonMapOpen, setIsCanyonMapOpen] = useState(false);
  const [canyonMapData, setCanyonMapData] = useState<CanyonMapData | null>(null);

  const handleCanyonMap = useCallback((data: CanyonMapData) => {
    setCanyonMapData(data);
  }, []);

  const openWithReset = useCallback(() => {
    setCanyonMapData(null);
    setIsCanyonMapOpen(true);
  }, []);

  return {
    isCanyonMapOpen,
    setIsCanyonMapOpen,
    canyonMapData,
    handleCanyonMap,
    openWithReset,
  };
}
