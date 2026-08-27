// src/features/admin/ui/AdminTradeHistoryTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useAdminLabel } from "../lib/useAdminLabel";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, SearchInput, formatDate, formatNumber, truncateWallet } from "./AdminKit";

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

type StatusFilter = "all" | "completed" | "failed";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All trades" },
    { id: "completed", label: "Successful" },
    { id: "failed", label: "Failed" },
];

export const AdminTradeHistoryTable = forwardRef<AdminTableRef>(function AdminTradeHistoryTable(_props, ref) {
    const [trades, setTrades] = useState<TradeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const translateItem = useAdminLabel();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("q", query.trim());
            if (status !== "all") params.set("status", status);
            params.set("page", String(page));

            const res = await fetch(`/api/admin/trades?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setTrades(data.trades || []);
        } catch {
            setError("Failed to load trades");
        } finally {
            setLoading(false);
        }
    }, [query, status, page]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    useEffect(() => {
        setPage(1);
    }, [query, status]);

    const volume = trades.filter((t) => t.status === "completed").reduce((sum, t) => sum + (Number(t.priceTnj) || 0), 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search nickname, wallet, item or tx…" />
                <Chips value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                <span className="a-hint a-spacer">{formatNumber(volume)} TNJ on this page</span>
            </div>

            {error && <Alert tone="bad">{error}</Alert>}

            {loading && trades.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : trades.length === 0 ? (
                <Empty>No trades match.</Empty>
            ) : (
                <div className="a-table-wrap">
                    <table className="a-table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Seller</th>
                                <th />
                                <th>Buyer</th>
                                <th>Item</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Tx</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((trade) => (
                                <tr key={trade.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(trade.createdAt)}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{trade.sellerNickname || truncateWallet(trade.sellerWallet)}</div>
                                        <div className="a-hint a-mono">{truncateWallet(trade.sellerWallet)}</div>
                                    </td>
                                    <td>
                                        <ArrowRight className="w-3 h-3" style={{ color: "var(--a-mute)" }} />
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{trade.buyerNickname || truncateWallet(trade.buyerWallet)}</div>
                                        <div className="a-hint a-mono">{truncateWallet(trade.buyerWallet)}</div>
                                    </td>
                                    <td>
                                        {translateItem(trade.itemName)}
                                        {trade.quantity > 1 ? ` ×${trade.quantity}` : ""}
                                    </td>
                                    <td style={{ color: "var(--a-warn)", fontWeight: 700, whiteSpace: "nowrap" }}>{formatNumber(trade.priceTnj)} TNJ</td>
                                    <td>
                                        <Badge tone={trade.status === "completed" ? "good" : "bad"}>{trade.status === "completed" ? "Success" : "Failed"}</Badge>
                                        {trade.status !== "completed" && trade.failureReason && <div className="a-hint">{trade.failureReason}</div>}
                                    </td>
                                    <td>
                                        <a
                                            href={`https://solscan.io/tx/${trade.txSignature}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="a-row"
                                            style={{ gap: 5, color: "var(--a-accent)" }}
                                        >
                                            <span className="a-mono">{truncateWallet(trade.txSignature)}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="a-row">
                <span className="a-hint">Page {page}</span>
                <span className="a-spacer" />
                <button type="button" className="a-btn a-btn-sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                </button>
                <button type="button" className="a-btn a-btn-sm" disabled={trades.length < 100} onClick={() => setPage((p) => p + 1)}>
                    Next
                </button>
            </div>
        </div>
    );
});
