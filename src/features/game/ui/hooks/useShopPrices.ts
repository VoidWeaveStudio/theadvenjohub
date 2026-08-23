// src/features/game/ui/hooks/useShopPrices.ts
"use client";

import { useEffect, useState } from "react";

export interface LiveShopPrice {
    itemId: string;
    currency: "ash" | "tnj" | "usd";
    priceAsh: number;
    priceTnj: number;
    priceUsdCents: number;
    payableTnj: number | null;
    enabled: boolean;
}

export interface ShopPriceState {
    prices: Map<string, LiveShopPrice>;
    ready: boolean;
}

export function useShopPrices(gameSlug: string, enabled: boolean): ShopPriceState {
    const [prices, setPrices] = useState<Map<string, LiveShopPrice>>(new Map());
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!enabled || !gameSlug) {
            setReady(false);
            return;
        }
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch(`/api/game/shop-prices?gameSlug=${encodeURIComponent(gameSlug)}`);
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                setPrices(new Map((data.items || []).map((i: LiveShopPrice) => [i.itemId, i])));
                setReady(true);
            } catch {
                return;
            }
        };

        load();
        const interval = setInterval(load, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [gameSlug, enabled]);

    return { prices, ready };
}
