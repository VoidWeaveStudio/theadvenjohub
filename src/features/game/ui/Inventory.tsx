// src/features/game/ui/Inventory.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Backpack, X, Sparkles } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";
import { useMarketCaps } from "./useMarketCaps";
import { TokenHoverModal } from "./TokenHoverModal";

export type InventoryEntry = InventoryGridItem;

interface InventoryProps {
    items: InventoryEntry[];
    ash: number;
    isOpen: boolean;
    onClose: () => void;
}

export function Inventory({ items, ash, isOpen, onClose }: InventoryProps) {
    const marketCaps = useMarketCaps(items.map((i) => i.address), isOpen);
    const [hovered, setHovered] = useState<InventoryGridItem | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleHoverChange = useCallback((item: InventoryGridItem | null) => {
        if (clearTimer.current) {
            clearTimeout(clearTimer.current);
            clearTimer.current = null;
        }
        if (item) {
            setHovered(item);
        } else {
            clearTimer.current = setTimeout(() => setHovered(null), 250);
        }
    }, []);

    const cancelClear = useCallback(() => {
        if (clearTimer.current) {
            clearTimeout(clearTimer.current);
            clearTimer.current = null;
        }
    }, []);

    const clearNow = useCallback(() => {
        cancelClear();
        setHovered(null);
    }, [cancelClear]);

    const hoveredDisplay = useMemo(() => {
        if (!hovered) return null;
        const info = marketCaps[hovered.address];
        return {
            address: hovered.address,
            image: info?.image || hovered.image,
            name: info?.name || hovered.name,
            symbol: info?.symbol || hovered.symbol,
        };
    }, [hovered, marketCaps]);

    if (!isOpen) return null;

    return (
        <div className="absolute right-8 top-24 bottom-24 pointer-events-auto font-oxanium flex items-center">
            <div className="bg-[rgba(12,12,14,0.9)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] p-4 w-[420px] max-h-full flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Backpack className="w-4 h-4 text-[#4FD1FF]" />
                        <span className="text-[#E5E7EB] text-xs font-bold tracking-wider">INVENTORY</span>
                    </div>
                    <button onClick={onClose} className="text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <InventoryGrid items={items} onHoverChange={handleHoverChange} />

                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">ASH</span>
                    </div>
                    <span className="text-[#FFD166] text-lg font-bold">{ash}</span>
                </div>
            </div>

            <TokenHoverModal
                token={hoveredDisplay}
                marketCap={hovered ? marketCaps[hovered.address]?.mc : undefined}
                onMouseEnter={cancelClear}
                onMouseLeave={clearNow}
            />
        </div>
    );
}
