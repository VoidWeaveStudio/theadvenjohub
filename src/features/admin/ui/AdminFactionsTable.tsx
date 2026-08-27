// src/features/admin/ui/AdminFactionsTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Plus } from "lucide-react";
import { AdminFactionDetailModal } from "./AdminFactionDetailModal";
import { AdminCreateFactionModal } from "./AdminCreateFactionModal";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, Panel, SearchInput, formatNumber, truncateWallet } from "./AdminKit";

interface AdminFaction {
    id: string;
    number: number;
    name: string;
    symbol: string | null;
    image: string | null;
    tokenCa: string | null;
    founderWallet: string;
    level: number;
    levelProgressAsh: number;
    roomAccess: string;
    promoCode: string | null;
    promoPaid: boolean;
    creationPaid: boolean;
    createdAt: string;
    memberCount: number;
    hasGate: boolean;
    gatePaid: boolean;
}

type PerkFilter = "all" | "gate" | "promo" | "paid" | "none";
type SortKey = "level" | "members" | "new" | "name";

const PERK_OPTIONS: { id: PerkFilter; label: string }[] = [
    { id: "all", label: "All factions" },
    { id: "gate", label: "Has gate room" },
    { id: "promo", label: "Has promo code" },
    { id: "paid", label: "Paid on-chain" },
    { id: "none", label: "No perks" },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
    { id: "level", label: "By level" },
    { id: "members", label: "By members" },
    { id: "new", label: "Newest" },
    { id: "name", label: "By name" },
];

export const AdminFactionsTable = forwardRef<AdminTableRef>(function AdminFactionsTable(_props, ref) {
    const [factions, setFactions] = useState<AdminFaction[]>([]);
    const [query, setQuery] = useState("");
    const [perk, setPerk] = useState<PerkFilter>("all");
    const [sort, setSort] = useState<SortKey>("level");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("q", query.trim());
            if (perk !== "all") params.set("perk", perk);
            params.set("sort", sort);

            const res = await fetch(`/api/admin/factions?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setFactions(data.factions || []);
        } catch {
            setError("Failed to load factions");
        } finally {
            setLoading(false);
        }
    }, [query, perk, sort]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    const handleDeleted = (factionId: string) => {
        setFactions((prev) => prev.filter((f) => f.id !== factionId));
    };

    const gateCount = factions.filter((f) => f.hasGate).length;
    const promoCount = factions.filter((f) => f.promoCode).length;

    return (
        <Panel
            title="Factions"
            actions={
                <>
                    <span className="a-hint">
                        {formatNumber(factions.length)} shown · {gateCount} gate rooms · {promoCount} promo codes
                    </span>
                    <button type="button" className="a-btn a-btn-primary" onClick={() => setIsCreateOpen(true)}>
                        <Plus />
                        New faction
                    </button>
                </>
            }
            flush
        >
            <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="a-row">
                    <SearchInput value={query} onChange={setQuery} placeholder="Name, symbol, token CA, founder wallet or promo code…" />
                    {(query || perk !== "all") && (
                        <button
                            type="button"
                            className="a-btn a-btn-ghost"
                            onClick={() => {
                                setQuery("");
                                setPerk("all");
                            }}
                        >
                            Reset
                        </button>
                    )}
                </div>
                <div className="a-row">
                    <Chips value={perk} options={PERK_OPTIONS} onChange={setPerk} />
                    <span className="a-spacer" />
                    <Chips value={sort} options={SORT_OPTIONS} onChange={setSort} />
                </div>
                {error && <Alert tone="bad">{error}</Alert>}
            </div>

            {loading && factions.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : factions.length === 0 ? (
                <Empty>No factions match these filters.</Empty>
            ) : (
                <div className="a-table-wrap">
                    <table className="a-table">
                        <thead>
                            <tr>
                                <th>Faction</th>
                                <th>Level</th>
                                <th>Members</th>
                                <th>Paid perks</th>
                                <th>Room</th>
                                <th>Founder</th>
                                <th>Token CA</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {factions.map((faction) => (
                                <tr key={faction.id} data-clickable="true" onClick={() => setSelectedFactionId(faction.id)}>
                                    <td>
                                        <div className="a-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                                            {faction.image ? (
                                                <img src={faction.image} alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: "cover" }} />
                                            ) : (
                                                <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--a-panel-3)" }} />
                                            )}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600 }}>
                                                    {faction.name} <span className="a-hint">#{faction.number}</span>
                                                </div>
                                                {faction.symbol && <div className="a-hint">${faction.symbol}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ color: "var(--a-accent)", fontWeight: 700 }}>Lv.{faction.level}</td>
                                    <td className="a-dim">{formatNumber(faction.memberCount)}</td>
                                    <td>
                                        <div className="a-pills">
                                            {faction.hasGate && <Badge tone={faction.gatePaid ? "good" : "info"}>{faction.gatePaid ? "Gate · paid" : "Gate · granted"}</Badge>}
                                            {faction.promoCode && <Badge tone={faction.promoPaid ? "good" : "info"}>{faction.promoPaid ? "Promo · paid" : "Promo · granted"}</Badge>}
                                            {faction.creationPaid && <Badge tone="warn">Founded on-chain</Badge>}
                                            {!faction.hasGate && !faction.promoCode && !faction.creationPaid && <span className="a-muted">—</span>}
                                        </div>
                                    </td>
                                    <td className="a-dim">{faction.roomAccess}</td>
                                    <td className="a-hint a-mono">{truncateWallet(faction.founderWallet)}</td>
                                    <td className="a-hint a-mono">{faction.tokenCa ? truncateWallet(faction.tokenCa) : "—"}</td>
                                    <td className="a-dim">{new Date(faction.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminFactionDetailModal factionId={selectedFactionId} onClose={() => setSelectedFactionId(null)} onDeleted={handleDeleted} onChanged={load} />
            <AdminCreateFactionModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={load} />
        </Panel>
    );
});
