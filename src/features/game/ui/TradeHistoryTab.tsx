// src/features/game/ui/TradeHistoryTab.tsx
"use client";

import { useEffect, useState } from "react";
import { CopyableText } from "./shell/CopyableText";

interface TradeHistoryEntry {
    id: string;
    role: "bought" | "sold";
    counterpartyWallet: string;
    counterpartyNickname: string | null;
    itemName: string;
    quantity: number;
    priceTnj: number;
    status: string;
    failureReason: string | null;
    createdAt: string;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function TradeHistoryTab() {
    const [trades, setTrades] = useState<TradeHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/user/trades", { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setTrades(Array.isArray(data.trades) ? data.trades : []);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div>
            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">TRADE HISTORY ({trades.length})</span>
            <div className="mt-2 space-y-2">
                {loading ? (
                    <p className="text-[#8B8F98] text-sm text-center py-6">Loading…</p>
                ) : trades.length === 0 ? (
                    <p className="text-[#8B8F98] text-sm text-center py-6">No trades yet.</p>
                ) : (
                    trades.map((t) => (
                        <div key={t.id} className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[10px] font-bold tracking-wide ${t.role === "bought" ? "text-[#4ADE80]" : "text-[#FFD166]"}`}>
                                    {t.role === "bought" ? "PURCHASE" : "SALE"}
                                </span>
                                <span className={`text-[10px] font-bold tracking-wide ${t.status === "completed" ? "text-[#4ADE80]" : "text-red-400"}`}>
                                    {t.status === "completed" ? "SUCCESS" : "FAILED"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[#E5E7EB] text-sm font-bold">{t.itemName}</span>
                                <span className="text-[#FFD166] text-sm font-bold">{t.priceTnj.toLocaleString("en-US")} TNJ</span>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[#8B8F98] text-xs">{t.role === "bought" ? "Seller" : "Buyer"}</span>
                                <CopyableText
                                    value={t.counterpartyWallet}
                                    display={t.counterpartyNickname || truncateWallet(t.counterpartyWallet)}
                                    className="text-xs text-[#8B8F98]"
                                />
                            </div>
                            {t.status !== "completed" && t.failureReason && (
                                <div className="text-red-400/80 text-[10px] mt-1">{t.failureReason}</div>
                            )}
                            <div className="text-[#6B7280] text-[10px] mt-1">{new Date(t.createdAt).toLocaleString()}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
