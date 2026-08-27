// src/features/admin/ui/AdminPlayersTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AdminPlayerDetailModal } from "./AdminPlayerDetailModal";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, Panel, SearchInput, formatNumber, formatPlaytime, formatRelative, truncateWallet } from "./AdminKit";

interface AdminPlayer {
    id: string;
    number: number | null;
    wallet: string;
    nickname: string | null;
    isBanned: boolean;
    banReason: string | null;
    isOnline: boolean;
    mutedUntil: string | null;
    lastSeenAt: string | null;
    createdAt: string;
    ownsGame: boolean;
    promoFactionName: string | null;
    factionName: string | null;
    level: number;
    kills: number;
    deaths: number;
    playtimeSeconds: number;
    ash: number;
    spentTnj: number;
}

type OwnsFilter = "all" | "1" | "0";
type StatusFilter = "all" | "online" | "banned" | "muted";
type FactionFilter = "all" | "in" | "out";
type SortKey = "created" | "lastSeen" | "level" | "playtime" | "kills";

const OWNS_OPTIONS: { id: OwnsFilter; label: string }[] = [
    { id: "all", label: "All accounts" },
    { id: "1", label: "Owns the game" },
    { id: "0", label: "Registered only" },
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Any status" },
    { id: "online", label: "Online" },
    { id: "banned", label: "Banned" },
    { id: "muted", label: "Muted" },
];

const FACTION_OPTIONS: { id: FactionFilter; label: string }[] = [
    { id: "all", label: "Any faction" },
    { id: "in", label: "In a faction" },
    { id: "out", label: "No faction" },
];

const PAGE_SIZE = 50;

export const AdminPlayersTable = forwardRef<AdminTableRef>(function AdminPlayersTable(_props, ref) {
    const [players, setPlayers] = useState<AdminPlayer[]>([]);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState("");
    const [owns, setOwns] = useState<OwnsFilter>("all");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [faction, setFaction] = useState<FactionFilter>("all");
    const [sort, setSort] = useState<SortKey>("created");
    const [dir, setDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("q", query.trim());
            if (owns !== "all") params.set("owns", owns);
            if (status !== "all") params.set("status", status);
            if (faction !== "all") params.set("faction", faction);
            params.set("sort", sort);
            params.set("dir", dir);
            params.set("limit", String(PAGE_SIZE));
            params.set("offset", String(page * PAGE_SIZE));

            const res = await fetch(`/api/admin/players?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setPlayers(data.players || []);
            setTotal(Number(data.total) || 0);
        } catch {
            setError("Failed to load players");
        } finally {
            setLoading(false);
        }
    }, [query, owns, status, faction, sort, dir, page]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    useEffect(() => {
        setPage(0);
    }, [query, owns, status, faction, sort, dir]);

    const toggleSort = (key: SortKey) => {
        if (sort === key) {
            setDir((prev) => (prev === "desc" ? "asc" : "desc"));
            return;
        }
        setSort(key);
        setDir("desc");
    };

    const sortIcon = (key: SortKey) =>
        sort === key ? (dir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : null;

    const handleBanChanged = (userId: string, isBanned: boolean, banReason: string | null) => {
        setPlayers((prev) => prev.map((p) => (p.id === userId ? { ...p, isBanned, banReason } : p)));
    };

    const handleLicenseChanged = (userId: string, ownsGame: boolean) => {
        setPlayers((prev) => prev.map((p) => (p.id === userId ? { ...p, ownsGame } : p)));
    };

    return (
        <Panel
            title="Players"
            actions={<span className="a-hint">{formatNumber(total)} accounts match</span>}
            flush
        >
            <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="a-row">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search by nickname or wallet…" />
                    {(query || owns !== "all" || status !== "all" || faction !== "all") && (
                        <button
                            type="button"
                            className="a-btn a-btn-ghost"
                            onClick={() => {
                                setQuery("");
                                setOwns("all");
                                setStatus("all");
                                setFaction("all");
                            }}
                        >
                            Reset
                        </button>
                    )}
                </div>
                <div className="a-row">
                    <Chips value={owns} options={OWNS_OPTIONS} onChange={setOwns} />
                    <Chips value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                    <Chips value={faction} options={FACTION_OPTIONS} onChange={setFaction} />
                </div>
                {error && <Alert tone="bad">{error}</Alert>}
            </div>

            {loading && players.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : players.length === 0 ? (
                <Empty>No players match these filters.</Empty>
            ) : (
                <div className="a-table-wrap">
                    <table className="a-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Status</th>
                                <th data-sortable="true" onClick={() => toggleSort("level")}>
                                    <span className="a-row" style={{ gap: 4 }}>Level {sortIcon("level")}</span>
                                </th>
                                <th>Ash</th>
                                <th>Spent</th>
                                <th data-sortable="true" onClick={() => toggleSort("kills")}>
                                    <span className="a-row" style={{ gap: 4 }}>K / D {sortIcon("kills")}</span>
                                </th>
                                <th data-sortable="true" onClick={() => toggleSort("playtime")}>
                                    <span className="a-row" style={{ gap: 4 }}>Playtime {sortIcon("playtime")}</span>
                                </th>
                                <th>Faction</th>
                                <th data-sortable="true" onClick={() => toggleSort("lastSeen")}>
                                    <span className="a-row" style={{ gap: 4 }}>Last seen {sortIcon("lastSeen")}</span>
                                </th>
                                <th data-sortable="true" onClick={() => toggleSort("created")}>
                                    <span className="a-row" style={{ gap: 4 }}>Joined {sortIcon("created")}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player) => {
                                const muted = !!player.mutedUntil && new Date(player.mutedUntil).getTime() > Date.now();
                                return (
                                    <tr
                                        key={player.id}
                                        data-clickable="true"
                                        data-flag={player.isBanned ? "banned" : player.isOnline ? "online" : undefined}
                                        onClick={() => setSelectedUserId(player.id)}
                                    >
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{player.nickname || "—"}</div>
                                            <div className="a-hint a-mono">{truncateWallet(player.wallet)}</div>
                                        </td>
                                        <td>
                                            <div className="a-pills">
                                                <Badge tone={player.isOnline ? "good" : "neutral"} dot>
                                                    {player.isOnline ? "Online" : "Offline"}
                                                </Badge>
                                                {player.ownsGame ? (
                                                    <Badge tone="violet">Owner</Badge>
                                                ) : (
                                                    <Badge>No licence</Badge>
                                                )}
                                                {player.isBanned && <Badge tone="bad">Banned</Badge>}
                                                {muted && <Badge tone="warn">Muted</Badge>}
                                                {player.promoFactionName && <Badge tone="warn">Promo</Badge>}
                                            </div>
                                            {player.isBanned && player.banReason && (
                                                <div className="a-hint">{player.banReason}</div>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 700, color: "var(--a-accent)" }}>{player.level || 1}</td>
                                        <td style={{ color: "var(--a-warn)", fontWeight: 600 }}>{formatNumber(player.ash)}</td>
                                        <td>{player.spentTnj ? `${formatNumber(player.spentTnj)} TNJ` : <span className="a-muted">—</span>}</td>
                                        <td className="a-dim">{formatNumber(player.kills)} / {formatNumber(player.deaths)}</td>
                                        <td className="a-dim">{formatPlaytime(player.playtimeSeconds)}</td>
                                        <td className="a-dim">{player.factionName || <span className="a-muted">—</span>}</td>
                                        <td className="a-dim">{formatRelative(player.lastSeenAt)}</td>
                                        <td className="a-dim">{new Date(player.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="a-panel-body a-row">
                <span className="a-hint">
                    Showing {page * PAGE_SIZE + (players.length ? 1 : 0)}–{page * PAGE_SIZE + players.length} of {formatNumber(total)}
                </span>
                <span className="a-spacer" />
                <button type="button" className="a-btn a-btn-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    Previous
                </button>
                <button
                    type="button"
                    className="a-btn a-btn-sm"
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>
            </div>

            <AdminPlayerDetailModal
                userId={selectedUserId}
                onClose={() => setSelectedUserId(null)}
                onBanChanged={handleBanChanged}
                onLicenseChanged={handleLicenseChanged}
            />
        </Panel>
    );
});
