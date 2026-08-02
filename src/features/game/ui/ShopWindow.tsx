// src/features/game/ui/ShopWindow.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Gem, Minus, Plus } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { PLACEABLE_ITEMS } from "../data/placeableItems";

interface ShopWindowProps {
    isOpen: boolean;
    onClose: () => void;
    ash: number;
    placeables: Record<string, number>;
    onBuyItem: (itemId: string, quantity: number) => void;
}

export function ShopWindow({ isOpen, onClose, ash, placeables, onBuyItem }: ShopWindowProps) {
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Shop"
            icon={
                <Image
                    src="/icons/topmenu/shop-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            size="md"
        >
            <div className="flex items-center justify-end gap-1.5 text-[#FFD166] text-sm font-bold mb-4">
                <Gem className="w-4 h-4" />
                {ash} Ash
            </div>

            <div className="space-y-2">
                {PLACEABLE_ITEMS.map((item) => {
                    const owned = placeables[item.id] || 0;
                    const capRemaining = Math.max(0, item.maxOwned - owned);
                    const affordable = item.price > 0 ? Math.floor(ash / item.price) : 0;
                    const maxBuyable = Math.min(capRemaining, affordable);
                    const quantity = Math.min(Math.max(1, quantities[item.id] || 1), Math.max(1, maxBuyable));

                    const setQuantity = (value: number) => {
                        setQuantities((prev) => ({ ...prev, [item.id]: Math.min(Math.max(1, value), Math.max(1, maxBuyable)) }));
                    };

                    return (
                        <div
                            key={item.id}
                            className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{item.icon}</span>
                                <div>
                                    <div className="text-[#E5E7EB] font-bold text-sm">{item.name}</div>
                                    <div className="text-[#8B8F98] text-xs">{item.price} ash</div>
                                    <div className="text-[#8B8F98] text-xs">Owned: {owned}/{item.maxOwned}</div>
                                </div>
                            </div>

                            {capRemaining <= 0 ? (
                                <span className="text-[#8B8F98] text-xs font-bold px-3">Maxed out</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-black/30 rounded-lg px-1">
                                        <button
                                            onClick={() => setQuantity(quantity - 1)}
                                            disabled={quantity <= 1}
                                            className="w-6 h-6 flex items-center justify-center text-[#C5C9D1] hover:text-[#E5E7EB] disabled:opacity-30"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-[#E5E7EB] text-sm font-bold w-5 text-center">{quantity}</span>
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            disabled={quantity >= maxBuyable}
                                            className="w-6 h-6 flex items-center justify-center text-[#C5C9D1] hover:text-[#E5E7EB] disabled:opacity-30"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => onBuyItem(item.id, quantity)}
                                        disabled={maxBuyable <= 0}
                                        className="bg-gradient-to-r from-[#4FD1FF] to-[#3B9FD9] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2 rounded-[8px] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Buy
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </WindowFrame>
    );
}
