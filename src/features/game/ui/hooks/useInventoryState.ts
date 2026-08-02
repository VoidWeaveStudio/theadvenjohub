// src/features/game/ui/hooks/useInventoryState.ts
import { useCallback, useState } from "react";
import { InventoryEntry } from "../Inventory";

export function useInventoryState() {
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [ash, setAsh] = useState(0);
  const [placeables, setPlaceables] = useState<Record<string, number>>({});
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [activeTokenData, setActiveTokenData] = useState<any>(null);

  const handleInventoryChange = useCallback((inv: InventoryEntry[], ashValue: number, placeablesValue: Record<string, number>) => {
    setInventory(inv);
    setAsh(ashValue);
    setPlaceables(placeablesValue);
  }, []);

  const handleOpenTokenUI = useCallback((tokenData: any) => {
    setActiveTokenData(tokenData);
    document.exitPointerLock();
  }, []);

  return {
    inventory,
    ash,
    placeables,
    isInventoryOpen,
    setIsInventoryOpen,
    activeTokenData,
    setActiveTokenData,
    handleInventoryChange,
    handleOpenTokenUI,
  };
}
