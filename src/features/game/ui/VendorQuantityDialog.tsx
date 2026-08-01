// src/features/game/ui/VendorQuantityDialog.tsx
"use client";

import { X } from "lucide-react";
import { InventoryGridItem } from "./InventoryGrid";

interface VendorQuantityDialogProps {
    item: InventoryGridItem;
    origin: "sell" | "buy";
    quantity: number;
    onQuantityChange: (quantity: number) => void;
    onCancel: () => void;
    onConfirm: (quantityOverride?: number) => void;
}

export function VendorQuantityDialog({ item, origin, quantity, onQuantityChange, onCancel, onConfirm }: VendorQuantityDialogProps) {
    return (
        <div
            className="absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-10"
            onClick={onCancel}
        >
            <div
                className="bg-[rgba(18,18,20,0.98)] border border-[rgba(255,255,255,0.12)] rounded-[12px] p-5 w-[280px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end mb-1">
                    <button onClick={onCancel} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <img
                        src={item.image || "/fallback-token.png"}
                        alt={item.symbol}
                        className="w-10 h-10 rounded-[6px] object-cover"
                    />
                    <div className="min-w-0">
                        <div className="text-[#E5E7EB] text-sm font-bold truncate">{item.name || item.symbol}</div>
                        <div className="text-[#8B8F98] text-[10px]">
                            {origin === "sell" ? "You own" : "Available"} {item.quantity}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-3 mb-4">
                    <button
                        onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                        className="w-9 h-9 rounded-[8px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#E5E7EB] font-bold text-lg"
                    >
                        −
                    </button>
                    <input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={quantity}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            onQuantityChange(Number.isFinite(v) ? Math.max(1, Math.min(v, item.quantity)) : 1);
                        }}
                        className="w-16 text-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[8px] py-2 text-[#E5E7EB] font-bold outline-none focus:border-[#4FD1FF]"
                    />
                    <button
                        onClick={() => onQuantityChange(Math.min(item.quantity, quantity + 1))}
                        className="w-9 h-9 rounded-[8px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#E5E7EB] font-bold text-lg"
                    >
                        +
                    </button>
                </div>

                <div className="flex gap-2 mb-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-[8px] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[#8B8F98] font-bold text-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm()}
                        className="flex-1 py-2.5 rounded-[8px] bg-[#4FD1FF] hover:bg-[#4FD1FF]/90 text-[rgba(12,12,14,0.9)] font-bold text-sm transition-all"
                    >
                        Add {quantity}
                    </button>
                </div>
                <button
                    onClick={() => onConfirm(item.quantity)}
                    className="w-full py-2.5 rounded-[8px] bg-[rgba(255,209,102,0.15)] hover:bg-[rgba(255,209,102,0.25)] border border-[#FFD166]/40 text-[#FFD166] font-bold text-sm transition-all"
                >
                    Max ({item.quantity})
                </button>
            </div>
        </div>
    );
}
