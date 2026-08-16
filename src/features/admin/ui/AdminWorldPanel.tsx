// src/features/admin/ui/AdminWorldPanel.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

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
        <div className="rounded-lg p-4 border bg-white/5 border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-white text-sm font-bold">🏯 World State</div>
                    <div className="text-[#8B8F98] text-xs">
                        MC {formatUsd(state?.mc ?? 0)} · peak {formatUsd(state?.mcPeak ?? 0)}
                    </div>
                </div>
                <button onClick={() => load()} className="btn-secondary px-3 py-1.5 text-xs" disabled={busy}>
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/30 rounded p-3 border border-white/10">
                    <div className="text-[#8B8F98]">Rampart</div>
                    <div className="text-white font-bold mt-1">
                        Tier {effectiveTier} · {active.radius === null ? "no wall" : `R ${active.radius}m`}
                    </div>
                    <div className="text-[#8B8F98] mt-1">
                        {state?.adminTier !== null && state?.adminTier !== undefined
                            ? `forced by admin (mc tier ${state.tier})`
                            : "driven by market cap"}
                    </div>
                </div>

                <div className="bg-black/30 rounded p-3 border border-white/10">
                    <div className="text-[#8B8F98]">Rift</div>
                    <div className="text-white font-bold mt-1">
                        {portal?.status === "active" && `active at ${portal.x.toFixed(0)}, ${portal.z.toFixed(0)}`}
                        {portal?.status === "cooldown" && `cooldown ${formatRemaining(portal.cooldownUntil)}`}
                        {(!portal || portal.status === "locked") && "locked"}
                    </div>
                    <div className="text-[#8B8F98] mt-1">unlocks at {formatUsd(500000)}</div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => send("force_portal")}
                    className="btn-primary px-3 py-1.5 text-xs"
                    disabled={busy}
                >
                    Force rift near base
                </button>

                <select
                    value={effectiveTier}
                    onChange={(e) => send("set_tier", { tier: Number(e.target.value) })}
                    className="bg-zinc-900 text-white px-3 py-1.5 rounded text-xs border border-zinc-700 focus:border-cyan-500 outline-none"
                    disabled={busy}
                >
                    {TIERS.map((entry) => (
                        <option key={entry.tier} value={entry.tier}>
                            Tier {entry.tier} · {entry.radius === null ? "no wall" : `${entry.radius}m`} · {formatUsd(entry.mc)}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => send("clear_tier")}
                    className="btn-secondary px-3 py-1.5 text-xs"
                    disabled={busy || state?.adminTier === null || state?.adminTier === undefined}
                >
                    Clear override
                </button>
            </div>

            {notice && <p className="text-cyan-400 text-xs">{notice}</p>}
            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
});
