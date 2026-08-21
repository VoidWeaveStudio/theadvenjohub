// src/features/admin/ui/AdminTradeHistoryTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAdminLabel } from "../lib/useAdminLabel";
import { AdminTableRef } from "./AdminTableRef";

interface TradeRow {
    id: string;
    sellerId: string;
    sellerWallet: string;
    sellerNickname: string | null;
    buyerId: string;
    buyerWallet: string;
    buyerNickname: string | null;
    itemName: string;
    quantity: number;
    priceTnj: number;
    txSignature: string;
    status: string;
    failureReason: string | null;
    createdAt: string;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const AdminTradeHistoryTable = forwardRef<AdminTableRef>(function AdminTradeHistoryTable(_props, ref) {
    const [trades, setTrades] = useState<TradeRow[]>([]);
    const translateItem = useAdminLabel();
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const load = async (q?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            const res = await fetch(`/api/admin/trades?${params.toString()}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setTrades(data.trades || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: () => load(query) }));

    useEffect(() => {
        load();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        load(query);
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by nickname, wallet, or item..."
                    className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                />
                <button type="submit" className="btn-primary px-4 py-2 text-xs flex-shrink-0">
                    Search
                </button>
            </form>

            {loading ? (
                <p className="text-[#8B8F98] text-sm">Loading...</p>
            ) : trades.length === 0 ? (
                <p className="text-[#8B8F98] text-sm">No trades found.</p>
            ) : (
                <div className="space-y-1.5">
                    {trades.map((t) => (
                        <div key={t.id} className="rounded-lg px-3 py-2.5 border bg-white/5 border-white/10">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[#6B7280] text-[10px] font-mono">{t.id}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[#6B7280] text-[10px]">{new Date(t.createdAt).toLocaleString()}</span>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "completed" ? "bg-[rgba(74,222,128,0.15)] text-[#4ADE80]" : "bg-[rgba(248,113,113,0.15)] text-red-400"
                                            }`}
                                    >
                                        {t.status === "completed" ? "Success" : "Failed"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm mb-1">
                                <span className="text-white font-bold truncate">
                                    {t.sellerNickname || truncateWallet(t.sellerWallet)}
                                </span>
                                <span className="text-[#6B7280] text-[10px]">{truncateWallet(t.sellerWallet)}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                                <span className="text-white font-bold truncate">
                                    {t.buyerNickname || truncateWallet(t.buyerWallet)}
                                </span>
                                <span className="text-[#6B7280] text-[10px]">{truncateWallet(t.buyerWallet)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-[#E5E7EB] text-sm">
                                    {translateItem(t.itemName)}{t.quantity > 1 ? ` x${t.quantity}` : ""}
                                </span>
                                <span className="text-[#FFD166] text-sm font-bold">{t.priceTnj.toLocaleString("en-US")} TNJ</span>
                            </div>

                            {t.status !== "completed" && t.failureReason && (
                                <p className="text-red-400/80 text-[10px] mt-1">{t.failureReason}</p>
                            )}
                            <p className="text-[#6B7280] text-[9px] font-mono mt-1 truncate">{t.txSignature}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
