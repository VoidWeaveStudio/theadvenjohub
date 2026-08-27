// src/features/admin/ui/AdminInfluencePanel.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Tile } from "./AdminKit";

interface InfluenceStateView {
    status: "closed" | "open" | "collapsing";
    phase: "sealed" | "claimable" | "owned" | "siege" | "collapse";
    breach: { x: number; y: number; z: number; spawnedAt: number };
    ownerFactionId: string | null;
    ownerFactionName: string | null;
    feeCurrency: "none" | "ash" | "tnj" | "faction";
    feeAmount: number;
    bossDefeated: boolean;
    crystalHealth: number;
    nextSiegeAt: number;
}

interface EntryRow {
    id: string;
    wallet: string;
    currency: string;
    amount: string;
    credited: boolean;
    createdAt: string;
}

const CRYSTAL_MAX = 40000;

function formatWhen(value: number) {
    if (!value) return "—";
    const delta = value - Date.now();
    if (delta <= 0) return "due";

    const hours = Math.floor(delta / 3600000);
    const minutes = Math.floor((delta % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function shortWallet(wallet: string) {
    return wallet.length > 10 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
}

export const AdminInfluencePanel = forwardRef<AdminTableRef>(function AdminInfluencePanel(_props, ref) {
    const [state, setState] = useState<InfluenceStateView | null>(null);
    const [entries, setEntries] = useState<EntryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = () => {
        setLoading(true);
        return fetch("/api/admin/influence", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                setState(data.state ?? null);
                setEntries(Array.isArray(data.entries) ? data.entries : []);
            })
            .catch(() => setError("Failed to load influence state"))
            .finally(() => setLoading(false));
    };

    useImperativeHandle(ref, () => ({ refresh: () => { load(); } }));

    useEffect(() => {
        load();
    }, []);

    const send = async (action: string) => {
        setError(null);
        setNotice(null);
        setBusy(true);

        try {
            const res = await signedFetch("/api/admin/influence", `influence_${action}`, "global", { action });
            if (!res.ok) {
                setError("Command rejected");
                return;
            }
            setNotice("Command queued — the game server applies it within 15s");
            setTimeout(load, 16000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        } finally {
            setBusy(false);
        }
    };

    if (loading && !state) return null;

    const open = state?.status === "open" || state?.status === "collapsing";
    const health = state?.crystalHealth ?? 0;

    return (
        <section className="a-panel">
            <header className="a-panel-head">
                <span className="a-panel-title">Influence point</span>
                <span className="a-hint">
                    {open ? `breach at ${state?.breach.x.toFixed(0)}, ${state?.breach.y.toFixed(0)}, ${state?.breach.z.toFixed(0)}` : "no breach"}
                </span>
                <button type="button" onClick={() => load()} className="a-btn a-btn-sm a-spacer" disabled={busy}>
                    Reload
                </button>
            </header>

            <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="a-grid a-grid-2">
                    <Tile
                        label="Breach"
                        value={
                            <>
                                {state?.status ?? "closed"} · {state?.phase ?? "sealed"}
                                <div className="a-hint">
                                    {state?.bossDefeated ? "cathedral boss defeated" : "the Pale Confessor still stands"}
                                </div>
                            </>
                        }
                    />
                    <Tile
                        label="Control"
                        value={
                            <>
                                {state?.ownerFactionName ?? "unclaimed"}
                                <div className="a-hint">
                                    {state?.feeCurrency === "none"
                                        ? "entry free"
                                        : `entry ${state?.feeAmount} ${state?.feeCurrency?.toUpperCase()}`}
                                </div>
                            </>
                        }
                    />
                    <Tile
                        label="Crystal"
                        value={
                            <>
                                {Math.round((health / CRYSTAL_MAX) * 100)}%
                                <div className="a-hint">{health.toLocaleString("en-US")} / {CRYSTAL_MAX.toLocaleString("en-US")}</div>
                            </>
                        }
                    />
                    <Tile
                        label="Next siege"
                        value={
                            <>
                                {formatWhen(state?.nextSiegeAt ?? 0)}
                                <div className="a-hint">every 2 days at 12:00 server time</div>
                            </>
                        }
                    />
                </div>

                <div className="a-row">
                    <button type="button" onClick={() => send("spawn_breach")} className="a-btn a-btn-primary" disabled={busy}>
                        {open ? "Move breach" : "Open breach"}
                    </button>
                    <button type="button" onClick={() => send("close_breach")} className="a-btn" disabled={busy || !open}>
                        Close breach
                    </button>
                    <button type="button" onClick={() => send("force_siege")} className="a-btn" disabled={busy || !open}>
                        Force siege now
                    </button>
                    <button type="button" onClick={() => send("reset_point")} className="a-btn a-btn-danger" disabled={busy}>
                        Reset point
                    </button>
                </div>

                {entries.length > 0 && (
                    <table className="a-table">
                        <thead>
                            <tr>
                                <th>Wallet</th>
                                <th>Paid</th>
                                <th>Credited</th>
                                <th>When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td>{shortWallet(entry.wallet)}</td>
                                    <td>{Number(entry.amount).toLocaleString("en-US")} {entry.currency.toUpperCase()}</td>
                                    <td>{entry.credited ? "yes" : "pending"}</td>
                                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {notice && <Alert tone="info">{notice}</Alert>}
                {error && <Alert tone="bad">{error}</Alert>}
            </div>
        </section>
    );
});
