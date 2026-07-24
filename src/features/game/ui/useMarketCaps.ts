// src/features/game/ui/useMarketCaps.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export interface TokenInfo {
    mc: number;
    image?: string;
    name?: string;
    symbol?: string;
}

export function useMarketCaps(addresses: string[], enabled: boolean): Record<string, TokenInfo> {
    const [info, setInfo] = useState<Record<string, TokenInfo>>({});
    const addressKey = useMemo(() => Array.from(new Set(addresses)).sort().join(","), [addresses]);

    useEffect(() => {
        if (!enabled || !addressKey) return;
        const list = addressKey.split(",");
        let cancelled = false;

        const refresh = async () => {
            for (const address of list) {
                try {
                    const res = await fetch(`/api/token-by-ca?ca=${address}`);
                    const data = await res.json();
                    if (cancelled || !data) continue;
                    setInfo((prev) => ({
                        ...prev,
                        [address]: {
                            mc: data.mc || 0,
                            image: data.image || undefined,
                            name: data.name || undefined,
                            symbol: data.symbol || undefined,
                        },
                    }));
                } catch (e) { }
            }
        };

        refresh();
        const interval = setInterval(refresh, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [addressKey, enabled]);

    return info;
}
