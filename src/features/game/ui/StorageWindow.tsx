// src/features/game/ui/StorageWindow.tsx
"use client";

import { useState } from "react";
import { ArrowLeftRight, Box, X } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";

interface StorageWindowProps {
    isOpen: boolean;
    slots: number;
    entries: InventoryGridItem[];
    inventory: InventoryGridItem[];
    onClose: () => void;
    onDeposit: (address: string, quantity: number) => void;
    onWithdraw: (address: string, quantity: number) => void;
}

type Side = "inventory" | "crate";

export function StorageWindow({ isOpen, slots, entries, inventory, onClose, onDeposit, onWithdraw }: StorageWindowProps) {
    const [side, setSide] = useState<Side>("inventory");
    const [selected, setSelected] = useState<InventoryGridItem | null>(null);

    if (!isOpen) return null;

    const items = side === "inventory" ? inventory : entries;
    const active = selected && items.some((item) => item.address === selected.address) ? selected : null;
    const move = side === "inventory" ? onDeposit : onWithdraw;

    const transfer = (quantity: number) => {
        if (!active || quantity <= 0) return;
        move(active.address, quantity);
        setSelected(null);
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto font-oxanium" onClick={onClose}>
            <div
                className="bg-[rgba(12,12,14,0.95)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[12px] p-5 w-[520px] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-[#8AD4FF]" />
                        <span className="text-[#E5E7EB] text-xs font-bold tracking-wider">STORAGE CRATE</span>
                        <span className="text-[#6B7280] text-[11px]">{entries.length}/{slots} stacks</span>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-1 mb-3">
                    {(["inventory", "crate"] as Side[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setSide(tab); setSelected(null); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-colors ${side === tab
                                ? "bg-[rgba(138,212,255,0.15)] text-[#8AD4FF] border border-[#8AD4FF]/40"
                                : "bg-[rgba(255,255,255,0.03)] text-[#8B8F98] border border-white/10 hover:text-[#E5E7EB]"
                                }`}
                        >
                            {tab === "inventory" ? "YOUR BAG" : "IN THE CRATE"}
                        </button>
                    ))}
                </div>

                <InventoryGrid
                    items={items}
                    slotCount={side === "crate" ? slots : 64}
                    columns={8}
                    interactive
                    selectedAddress={active?.address ?? null}
                    onSlotClick={(item) => setSelected((prev) => (prev?.address === item.address ? null : item))}
                    emptyMessage={side === "crate" ? "This crate is empty" : "Nothing in your bag"}
                />

                <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)]">
                    {active ? (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-[#E5E7EB] text-sm font-bold truncate">{active.symbol || active.name}</div>
                                <div className="text-[#6B7280] text-[11px]">{active.quantity} held</div>
                            </div>
                            <button
                                onClick={() => transfer(1)}
                                className="bg-[rgba(255,255,255,0.06)] border border-white/10 hover:border-[#8AD4FF] text-[#E5E7EB] text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                            >
                                1
                            </button>
                            <button
                                onClick={() => transfer(Math.max(1, Math.floor(active.quantity / 2)))}
                                className="bg-[rgba(255,255,255,0.06)] border border-white/10 hover:border-[#8AD4FF] text-[#E5E7EB] text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                            >
                                Half
                            </button>
                            <button
                                onClick={() => transfer(active.quantity)}
                                className="flex items-center gap-1.5 bg-[rgba(138,212,255,0.15)] border border-[#8AD4FF]/40 hover:border-[#8AD4FF] text-[#8AD4FF] text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                {side === "inventory" ? "Store all" : "Take all"}
                            </button>
                        </div>
                    ) : (
                        <div className="text-[#6B7280] text-[11px] text-center py-2">
                            Pick a stack to move it {side === "inventory" ? "into the crate" : "back into your bag"}.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
