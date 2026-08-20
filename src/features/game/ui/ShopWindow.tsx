// src/features/game/ui/ShopWindow.tsx
"use client";

import Image from "next/image";
import { Coins, Store } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { SHOP_CATALOG } from "@/core/lib/shopCatalog";
import { useShopPrices } from "./hooks/useShopPrices";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface ShopWindowProps {
    isOpen: boolean;
    gameSlug: string;
    onClose: () => void;
}

function formatTnj(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`;
    return `${amount}`;
}

export function ShopWindow({ isOpen, gameSlug, onClose }: ShopWindowProps) {
    const { t } = useLanguage();
    const livePrices = useShopPrices(gameSlug, isOpen);

    const items = SHOP_CATALOG.filter((entry) => {
        if (entry.kind === "faction") return false;
        const live = livePrices.get(entry.itemId);
        const currency = live?.currency ?? entry.defaultCurrency;
        if (live && live.enabled === false) return false;
        return currency === "tnj" || currency === "usd";
    });

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.shop.title")}
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
            <div className="flex items-start gap-2.5 text-xs bg-[rgba(255,209,102,0.08)] border border-[#FFD166]/25 rounded-lg px-3 py-2.5 mb-4">
                <Store className="w-4 h-4 text-[#FFD166] flex-shrink-0 mt-px" />
                <span className="text-[#C9CDD3]">
                    {t("g.shop.tnjOnly")}
                </span>
            </div>

            {items.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280] text-sm">
                    {t("g.shop.nothingListed")}
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((entry) => {
                        const live = livePrices.get(entry.itemId);
                        const tnj = live?.payableTnj ?? (live?.priceTnj || entry.defaultPriceTnj);
                        const usdCents = live?.priceUsdCents ?? entry.defaultPriceUsdCents;
                        const currency = live?.currency ?? entry.defaultCurrency;

                        return (
                            <div
                                key={entry.itemId}
                                className="flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <div className="text-[#E5E7EB] font-bold text-sm truncate">{t(entry.nameKey)}</div>
                                    <div className="text-[#8B8F98] text-xs">{t(entry.descriptionKey)}</div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <div className="flex items-center justify-end gap-1.5 text-[#4FD1FF] font-bold text-sm">
                                        <Coins className="w-3.5 h-3.5" />
                                        {tnj > 0 ? `${formatTnj(tnj)} TNJ` : "—"}
                                    </div>
                                    {currency === "usd" && usdCents > 0 && (
                                        <div className="text-[#6B7280] text-[11px]">
                                            ≈ ${(usdCents / 100).toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </WindowFrame>
    );
}
