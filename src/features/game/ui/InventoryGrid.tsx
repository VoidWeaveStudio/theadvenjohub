// src/features/game/ui/InventoryGrid.tsx
"use client";

export interface InventoryGridItem {
    address: string;
    name: string;
    symbol: string;
    image: string;
    quantity: number;
}

interface InventoryGridProps {
    items: InventoryGridItem[];
    slotCount?: number;
    columns?: number;
    stagedQuantities?: Record<string, number>;
    interactive?: boolean;
    onSlotClick?: (item: InventoryGridItem) => void;
    onSlotRightClick?: (item: InventoryGridItem) => void;
    onHoverChange?: (item: InventoryGridItem | null) => void;
    emptyMessage?: string;
}

export function InventoryGrid({
    items,
    slotCount = 128,
    columns = 8,
    stagedQuantities = {},
    interactive = false,
    onSlotClick,
    onSlotRightClick,
    onHoverChange,
    emptyMessage,
}: InventoryGridProps) {
    if (items.length === 0 && emptyMessage) {
        return (
            <div className="text-[#8B8F98] text-xs text-center py-10">
                {emptyMessage}
            </div>
        );
    }

    const slots = Array.from({ length: slotCount }, (_, i) => items[i] ?? null);

    return (
        <div
            className="grid gap-1.5 overflow-y-auto pr-1"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxHeight: 480 }}
            onMouseLeave={() => onHoverChange?.(null)}
        >
            {slots.map((item, i) => {
                if (!item) {
                    return (
                        <div
                            key={`empty-${i}`}
                            className="aspect-square rounded-[6px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
                            onMouseEnter={() => onHoverChange?.(null)}
                        />
                    );
                }

                const staged = stagedQuantities[item.address] || 0;

                return (
                    <div
                        key={item.address}
                        className={`relative aspect-square rounded-[6px] border overflow-hidden ${interactive ? "cursor-pointer" : "cursor-default"
                            } ${staged > 0
                                ? "border-[#4FD1FF] shadow-[0_0_0_1px_rgba(79,209,255,0.5)]"
                                : "border-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.3)]"
                            } bg-[rgba(255,255,255,0.04)]`}
                        onMouseEnter={() => onHoverChange?.(item)}
                        onClick={interactive ? () => onSlotClick?.(item) : undefined}
                        onContextMenu={
                            interactive
                                ? (e) => {
                                    e.preventDefault();
                                    onSlotRightClick?.(item);
                                }
                                : undefined
                        }
                    >
                        <img
                            src={item.image || "/fallback-token.png"}
                            alt={item.symbol || item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                        />

                        {item.quantity > 1 && (
                            <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                {item.quantity}
                            </span>
                        )}

                        {staged > 0 && (
                            <span className="absolute top-0.5 left-0.5 bg-[#4FD1FF] text-[rgba(12,12,14,0.9)] text-[9px] font-black rounded-[3px] px-1 leading-tight">
                                {staged}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
