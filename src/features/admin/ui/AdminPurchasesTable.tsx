// src/features/admin/ui/AdminPurchasesTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, Panel, SearchInput, Stat, formatDate, formatNumber, truncateWallet } from "./AdminKit";
import type { Tone } from "./AdminKit";

type Kind = "all" | "game" | "shop" | "trade" | "faction" | "marketplace";
type Status = "all" | "completed" | "free" | "failed";

interface PurchaseRow {
    id: string;
    kind: Exclude<Kind, "all">;
    at: string;
    label: string;
    itemId: string | null;
    quantity: number;
    buyerWallet: string | null;
    buyerNickname: string | null;
    sellerWallet: string | null;
    sellerNickname: string | null;
    priceTnj: number | null;
    status: string;
    note: string | null;
    tx: string | null;
}

interface Totals {
    count: number;
    tnj: number;
    paidCount: number;
    freeCount: number;
    failedCount: number;
}

const KIND_OPTIONS: { id: Kind; label: string }[] = [
    { id: "all", label: "Everything" },
    { id: "game", label: "Game copies" },
    { id: "shop", label: "In-game shop" },
    { id: "faction", label: "Faction perks" },
    { id: "trade", label: "Player trades" },
    { id: "marketplace", label: "Marketplace" },
];

const STATUS_OPTIONS: { id: Status; label: string }[] = [
    { id: "all", label: "Any status" },
    { id: "completed", label: "Paid" },
    { id: "free", label: "Free / promo" },
    { id: "failed", label: "Failed" },
];

const KIND_LABEL: Record<string, string> = {
    game: "Game",
    shop: "Shop",
    trade: "Trade",
    faction: "Faction",
    marketplace: "Market",
};

const KIND_TONE: Record<string, Tone> = {
    game: "violet",
    shop: "info",
    trade: "neutral",
    faction: "warn",
    marketplace: "neutral",
};

function statusTone(status: string): Tone {
    if (status === "completed") return "good";
    if (status === "promo" || status === "granted") return "info";
    if (status === "revoked") return "neutral";
    return "bad";
}

const PAGE_SIZE = 100;

export const AdminPurchasesTable = forwardRef<AdminTableRef>(function AdminPurchasesTable(_props, ref) {
    const [rows, setRows] = useState<PurchaseRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [byKind, setByKind] = useState<Record<string, { count: number; tnj: number }>>({});
    const [hasMore, setHasMore] = useState(false);
    const [kind, setKind] = useState<Kind>("all");
    const [status, setStatus] = useState<Status>("all");
    const [query, setQuery] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (kind !== "all") params.set("kind", kind);
            if (status !== "all") params.set("status", status);
            if (query.trim()) params.set("q", query.trim());
            if (from) params.set("from", new Date(from).toISOString());
            if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
            params.set("limit", String(PAGE_SIZE));
            params.set("offset", String(page * PAGE_SIZE));

            const res = await fetch(`/api/admin/purchases?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setRows(data.rows || []);
            setTotals(data.totals || null);
            setByKind(data.byKind || {});
            setHasMore(!!data.hasMore);
        } catch {
            setError("Failed to load purchases");
        } finally {
            setLoading(false);
        }
    }, [kind, status, query, from, to, page]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    useEffect(() => {
        setPage(0);
    }, [kind, status, query, from, to]);

    return (
        <>
            <div className="a-grid a-grid-4">
                <Stat label="Matching records" value={formatNumber(totals?.count ?? 0)} hint={`${formatNumber(totals?.paidCount ?? 0)} paid`} />
                <Stat label="Volume" value={`${formatNumber(totals?.tnj ?? 0)} TNJ`} hint="Sum of completed payments" tone="warn" />
                <Stat label="Free / promo" value={formatNumber(totals?.freeCount ?? 0)} hint="Granted by admin or promo codes" tone="violet" />
                <Stat
                    label="Failed"
                    value={formatNumber(totals?.failedCount ?? 0)}
                    hint="Payments that never settled"
                    tone={(totals?.failedCount ?? 0) > 0 ? "bad" : "good"}
                />
            </div>

            <Panel
                title="Transactions"
                actions={
                    <span className="a-hint">
                        {Object.entries(byKind)
                            .map(([entry, value]) => `${KIND_LABEL[entry] ?? entry}: ${value.count}`)
                            .join(" · ")}
                    </span>
                }
                flush
            >
                <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="a-row">
                        <SearchInput value={query} onChange={setQuery} placeholder="Wallet, nickname, item, tx signature…" />
                        <label className="a-row" style={{ gap: 6 }}>
                            <span className="a-hint">From</span>
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                        </label>
                        <label className="a-row" style={{ gap: 6 }}>
                            <span className="a-hint">To</span>
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                        </label>
                        {(from || to || query || kind !== "all" || status !== "all") && (
                            <button
                                type="button"
                                className="a-btn a-btn-ghost"
                                onClick={() => {
                                    setFrom("");
                                    setTo("");
                                    setQuery("");
                                    setKind("all");
                                    setStatus("all");
                                }}
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="a-row">
                        <Chips value={kind} options={KIND_OPTIONS} onChange={setKind} />
                        <span className="a-spacer" />
                        <Chips value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                    </div>

                    {error && <Alert tone="bad">{error}</Alert>}
                </div>

                {loading && rows.length === 0 ? (
                    <Empty>Loading…</Empty>
                ) : rows.length === 0 ? (
                    <Empty>No transactions match these filters.</Empty>
                ) : (
                    <div className="a-table-wrap">
                        <table className="a-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Type</th>
                                    <th>Item</th>
                                    <th>Who</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                    <th>Transaction</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: "nowrap" }}>{formatDate(row.at)}</td>
                                        <td>
                                            <Badge tone={KIND_TONE[row.kind] ?? "neutral"}>{KIND_LABEL[row.kind] ?? row.kind}</Badge>
                                        </td>
                                        <td>
                                            <div className="a-item-title" style={{ maxWidth: 260 }}>
                                                {row.label}
                                                {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                                            </div>
                                            {row.note && <div className="a-hint">{row.note}</div>}
                                        </td>
                                        <td>
                                            <div>{row.buyerNickname || truncateWallet(row.buyerWallet)}</div>
                                            <div className="a-hint a-mono">{truncateWallet(row.buyerWallet)}</div>
                                            {row.sellerWallet && (
                                                <div className="a-hint">
                                                    from {row.sellerNickname || truncateWallet(row.sellerWallet)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ whiteSpace: "nowrap" }}>
                                            {row.priceTnj === null ? (
                                                <span className="a-muted">not recorded</span>
                                            ) : row.priceTnj === 0 ? (
                                                <span className="a-muted">free</span>
                                            ) : (
                                                <span style={{ color: "var(--a-warn)", fontWeight: 700 }}>{formatNumber(row.priceTnj)} TNJ</span>
                                            )}
                                        </td>
                                        <td>
                                            <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                                        </td>
                                        <td>
                                            {row.tx ? (
                                                <a
                                                    href={`https://solscan.io/tx/${row.tx}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="a-row"
                                                    style={{ gap: 5, color: "var(--a-accent)" }}
                                                >
                                                    <span className="a-mono">{truncateWallet(row.tx)}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : (
                                                <span className="a-muted">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="a-panel-body a-row">
                    <span className="a-hint">
                        Showing {page * PAGE_SIZE + (rows.length ? 1 : 0)}–{page * PAGE_SIZE + rows.length} of {formatNumber(totals?.count ?? 0)}
                    </span>
                    <span className="a-spacer" />
                    <button type="button" className="a-btn a-btn-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                        Previous
                    </button>
                    <button type="button" className="a-btn a-btn-sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                        Next
                    </button>
                </div>
            </Panel>
        </>
    );
});
