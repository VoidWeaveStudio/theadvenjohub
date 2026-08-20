// src/features/game/ui/hooks/useShopQuote.ts
"use client";

import { useEffect, useState } from "react";
import { fetchShopQuote, type ShopQuote } from "../../utils/shopQuote";

export function useShopQuote(itemId: string, enabled: boolean, gameSlug?: string | null): ShopQuote | null {
    const [quote, setQuote] = useState<ShopQuote | null>(null);

    useEffect(() => {
        if (!enabled || !itemId) return;
        let cancelled = false;

        const load = async () => {
            const next = await fetchShopQuote(itemId, gameSlug);
            if (!cancelled && next) setQuote(next);
        };

        load();
        const interval = setInterval(load, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [itemId, enabled, gameSlug]);

    return quote;
}
