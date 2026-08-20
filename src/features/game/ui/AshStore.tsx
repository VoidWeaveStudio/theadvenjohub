// src/features/game/ui/AshStore.tsx
"use client";

import { useState } from "react";
import { Gem, Minus, Plus } from "lucide-react";
import { PLACEABLE_ITEMS } from "../data/placeableItems";
import type { LiveShopPrice } from "./hooks/useShopPrices";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface AshStoreProps {
    ash: number;
    placeables: Record<string, number>;
    prices: Map<string, LiveShopPrice>;
    onBuyItem: (itemId: string, quantity: number) => void;
}

export function AshStore({ ash, placeables, prices, onBuyItem }: AshStoreProps) {
    const { t } = useLanguage();
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const items = PLACEABLE_ITEMS.filter((definition) => {
        if (definition.pet) return false;
        const live = prices.get(definition.id);
        if (!live) return true;
        return live.enabled !== false && live.currency === "ash";
    });

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.shop.goods")}</div>
                <div className="flex items-center gap-1.5 text-[#FFD166] text-sm font-bold">
                    <Gem className="w-4 h-4" />
                    {ash} Ash
                </div>
            </div>

            {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[#6B7280] text-sm">
                    {t("g.ashStore.empty")}
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                    {items.map((definition) => {
                        const live = prices.get(definition.id);
                        const price = live && live.currency === "ash" ? live.priceAsh : definition.price;
                        const owned = placeables[definition.id] || 0;
                        const capRemaining = definition.maxOwned === null
                            ? Number.MAX_SAFE_INTEGER
                            : Math.max(0, definition.maxOwned - owned);
                        const affordable = price > 0 ? Math.floor(ash / price) : 0;
                        const maxBuyable = Math.min(capRemaining, affordable);
                        const quantity = Math.min(Math.max(1, quantities[definition.id] || 1), Math.max(1, maxBuyable));

                        const setQuantity = (value: number) => {
                            setQuantities((prev) => ({
                                ...prev,
                                [definition.id]: Math.min(Math.max(1, value), Math.max(1, maxBuyable)),
                            }));
                        };

                        return (
                            <div
                                key={definition.id}
                                className="flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg px-4 py-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-2xl flex-shrink-0">{definition.icon}</span>
                                    <div className="min-w-0">
                                        <div className="text-[#E5E7EB] font-bold text-sm truncate">{t(definition.name)}</div>
                                        <div className="text-[#FFD166] text-xs font-bold">{price} ash</div>
                                        {definition.hint && <div className="text-[#6B7280] text-xs">{t(definition.hint)}</div>}
                                        <div className="text-[#8B8F98] text-xs">
                                            Owned: {owned}{definition.maxOwned === null ? "" : `/${definition.maxOwned}`}
                                        </div>
                                    </div>
                                </div>

                                {capRemaining <= 0 ? (
                                    <span className="text-[#8B8F98] text-xs font-bold px-3 flex-shrink-0">{t("g.shop.maxed")}</span>
                                ) : (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="flex items-center gap-1 bg-black/30 rounded-lg px-1">
                                            <button
                                                onClick={() => setQuantity(quantity - 1)}
                                                disabled={quantity <= 1}
                                                className="w-6 h-6 p-0 border-0 bg-transparent rounded flex items-center justify-center text-[#C5C9D1] hover:text-[#E5E7EB] disabled:opacity-30"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[#E5E7EB] text-sm font-bold w-5 text-center">{quantity}</span>
                                            <button
                                                onClick={() => setQuantity(quantity + 1)}
                                                disabled={quantity >= maxBuyable}
                                                className="w-6 h-6 p-0 border-0 bg-transparent rounded flex items-center justify-center text-[#C5C9D1] hover:text-[#E5E7EB] disabled:opacity-30"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => onBuyItem(definition.id, quantity)}
                                            disabled={maxBuyable <= 0}
                                            className="bg-gradient-to-r from-[#FFD166] to-[#D4AF50] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2 rounded-[8px] text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Buy
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
