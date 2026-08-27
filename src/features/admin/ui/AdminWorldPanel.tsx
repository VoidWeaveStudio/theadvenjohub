// src/features/admin/ui/AdminWorldPanel.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Tile } from "./AdminKit";

const TIERS = [
    { tier: 0, mc: 0, radius: 44 },
    { tier: 1, mc: 25000, radius: 68 },
    { tier: 2, mc: 60000, radius: 92 },
    { tier: 3, mc: 120000, radius: 116 },
    { tier: 4, mc: 200000, radius: 140 },
    { tier: 5, mc: 320000, radius: 168 },
    { tier: 6, mc: 500000, radius: 200 },
    { tier: 7, mc: 750000, radius: 400 },
    { tier: 8, mc: 1000000, radius: null },
];

interface WorldStateView {
    mc: number;
    mcPeak: number;
    tier: number;
    adminTier: number | null;
    portal: {
        status: "locked" | "active" | "cooldown";
        x: number;
        z: number;
        cooldownUntil: number;
        spawnedAt: number;
    };
}

function formatUsd(value: number) {
    return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatRemaining(until: number) {
    const total = Math.max(0, Math.floor((until - Date.now()) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export const AdminWorldPanel = forwardRef<AdminTableRef>(function AdminWorldPanel(_props, ref) {
    const [state, setState] = useState<WorldStateView | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = () => {
        setLoading(true);
        return fetch("/api/admin/world", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => setState(data.state ?? null))
            .catch(() => setError("Failed to load world state"))
            .finally(() => setLoading(false));
    };

    useImperativeHandle(ref, () => ({ refresh: () => { load(); } }));

    useEffect(() => {
        load();
    }, []);

    const send = async (action: string, extra: Record<string, unknown> = {}) => {
        setError(null);
        setNotice(null);
        setBusy(true);

        try {
            const res = await signedFetch("/api/admin/world", `world_${action}`, "global", { action, ...extra });
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

    const effectiveTier = state?.adminTier ?? state?.tier ?? 0;
    const active = TIERS[Math.min(TIERS.length - 1, effectiveTier)];
    const portal = state?.portal;

    return (
        <section className="a-panel">
            <header className="a-panel-head">
                <span className="a-panel-title">World state</span>
                <span className="a-hint">
                    MC {formatUsd(state?.mc ?? 0)} · peak {formatUsd(state?.mcPeak ?? 0)}
                </span>
                <button type="button" onClick={() => load()} className="a-btn a-btn-sm a-spacer" disabled={busy}>
                    Reload
                </button>
            </header>

            <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="a-grid a-grid-2">
                    <Tile
                        label="Rampart"
                        value={
                            <>
                                Tier {effectiveTier} · {active.radius === null ? "no wall" : `R ${active.radius}m`}
                                <div className="a-hint">
                                    {state?.adminTier !== null && state?.adminTier !== undefined
                                        ? `forced by admin (market-cap tier ${state.tier})`
                                        : "driven by market cap"}
                                </div>
                            </>
                        }
                    />
                    <Tile
                        label="Rift"
                        value={
                            <>
                                {portal?.status === "active" && `active at ${portal.x.toFixed(0)}, ${portal.z.toFixed(0)}`}
                                {portal?.status === "cooldown" && `cooldown ${formatRemaining(portal.cooldownUntil)}`}
                                {(!portal || portal.status === "locked") && "locked"}
                                <div className="a-hint">unlocks at {formatUsd(500000)}</div>
                            </>
                        }
                    />
                </div>

                <div className="a-row">
                    <button type="button" onClick={() => send("force_portal")} className="a-btn a-btn-primary" disabled={busy}>
                        Force rift near base
                    </button>

                    <select value={effectiveTier} onChange={(e) => send("set_tier", { tier: Number(e.target.value) })} disabled={busy}>
                        {TIERS.map((entry) => (
                            <option key={entry.tier} value={entry.tier}>
                                Tier {entry.tier} · {entry.radius === null ? "no wall" : `${entry.radius}m`} · {formatUsd(entry.mc)}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => send("clear_tier")}
                        className="a-btn"
                        disabled={busy || state?.adminTier === null || state?.adminTier === undefined}
                    >
                        Clear override
                    </button>
                </div>

                {notice && <Alert tone="info">{notice}</Alert>}
                {error && <Alert tone="bad">{error}</Alert>}
            </div>
        </section>
    );
});
