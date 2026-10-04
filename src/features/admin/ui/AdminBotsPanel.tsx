// src/features/admin/ui/AdminBotsPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Play, ShieldCheck, Coins, Flag, Star } from "lucide-react";
import { Alert, Badge, Empty, Panel, Stat, formatNumber, formatRelative } from "./AdminKit";
import { useAdminSignature } from "../lib/useAdminSignature";

interface BotStats {
    players: number;
    named: number;
    runs: number;
    runs24h: number;
    verified: number;
    coins: number;
    hiddenCoins: number;
    openReports: number;
    stars: number;
    byItem: { itemId: string; stars: number; count: number }[];
}

interface BotReport {
    id: string;
    coinId: string;
    ticker: string;
    name: string;
    creator: string;
    reporter: string;
    reason: string;
    createdAt: string;
}

interface BotEntry {
    id: string;
    label: string;
    ok: boolean;
    error: string | null;
    stats: BotStats | null;
    reports: BotReport[];
}

export function AdminBotsPanel({ refreshKey }: { refreshKey: number }) {
    const { signedFetch } = useAdminSignature();
    const [bots, setBots] = useState<BotEntry[] | null>(null);
    const [configured, setConfigured] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const load = useCallback(() => {
        let cancelled = false;
        setLoading(true);
        fetch("/api/admin/bots", { credentials: "include" })
            .then(async (res) => {
                const payload = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setError(payload?.error || `HTTP ${res.status}`);
                    return;
                }
                setError(null);
                setBots(payload.bots ?? []);
                setConfigured(payload.configured ?? 0);
            })
            .catch(() => !cancelled && setError("Failed to reach the bots"))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => load(), [load, refreshKey, tick]);

    async function setHidden(botId: string, coinId: string, hidden: boolean) {
        setBusy(coinId);
        try {
            const res = await signedFetch(
                "/api/admin/bots",
                hidden ? "bot_coin_hide" : "bot_coin_show",
                coinId,
                { bot: botId, coinId, hidden },
                "POST"
            );
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                setError(payload?.error || `HTTP ${res.status}`);
                return;
            }
            setError(null);
            setTick((value) => value + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Action failed");
        } finally {
            setBusy(null);
        }
    }

    if (loading && !bots) {
        return (
            <Panel title="Bot games">
                <p className="a-dim">Loading…</p>
            </Panel>
        );
    }

    if (configured === 0) {
        return (
            <Panel title="Bot games">
                <Empty>
                    No bot is wired up yet. Set MEMETIC_API_URL and MEMETIC_ADMIN_TOKEN to see it here.
                </Empty>
            </Panel>
        );
    }

    return (
        <>
            {error && <Alert tone="bad">{error}</Alert>}

            {bots?.map((bot) => (
                <div key={bot.id}>
                    {!bot.ok && (
                        <Panel title={bot.label}>
                            <Alert tone="warn">
                                {bot.error === "timed_out"
                                    ? "The service did not answer in time. A free instance takes up to a minute to wake up — try again."
                                    : bot.error === "bad_admin_token"
                                      ? "The admin token does not match what the bot expects."
                                      : `Unreachable: ${bot.error}`}
                            </Alert>
                        </Panel>
                    )}

                    {bot.ok && bot.stats && (
                        <>
                            <Panel title={bot.label}>
                                <div className="a-grid a-grid-4">
                                    <Stat
                                        label="Players"
                                        value={formatNumber(bot.stats.players)}
                                        hint={`${formatNumber(bot.stats.named)} with a nickname`}
                                        icon={<Users className="w-3 h-3" />}
                                    />
                                    <Stat
                                        label="Runs"
                                        value={formatNumber(bot.stats.runs)}
                                        hint={`${formatNumber(bot.stats.runs24h)} in the last day`}
                                        icon={<Play className="w-3 h-3" />}
                                    />
                                    <Stat
                                        label="Verified"
                                        value={
                                            bot.stats.runs > 0
                                                ? `${Math.round((bot.stats.verified / bot.stats.runs) * 100)}%`
                                                : "—"
                                        }
                                        hint={`${formatNumber(bot.stats.verified)} passed the replay`}
                                        tone={
                                            bot.stats.runs > 0 && bot.stats.verified / bot.stats.runs < 0.5
                                                ? "warn"
                                                : "good"
                                        }
                                        icon={<ShieldCheck className="w-3 h-3" />}
                                    />
                                    <Stat
                                        label="Stars"
                                        value={formatNumber(bot.stats.stars)}
                                        hint={`${bot.stats.byItem.length} item kinds sold`}
                                        icon={<Star className="w-3 h-3" />}
                                    />
                                    <Stat
                                        label="Player coins"
                                        value={formatNumber(bot.stats.coins)}
                                        hint={`${formatNumber(bot.stats.hiddenCoins)} hidden`}
                                        icon={<Coins className="w-3 h-3" />}
                                    />
                                    <Stat
                                        label="Open reports"
                                        value={formatNumber(bot.stats.openReports)}
                                        tone={bot.stats.openReports > 0 ? "warn" : "good"}
                                        icon={<Flag className="w-3 h-3" />}
                                    />
                                </div>
                            </Panel>

                            {bot.stats.byItem.length > 0 && (
                                <Panel title={`${bot.label} — stars by item`}>
                                    <table className="a-table">
                                        <thead>
                                            <tr>
                                                <th>Item</th>
                                                <th>Payments</th>
                                                <th>Stars</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bot.stats.byItem.map((item) => (
                                                <tr key={item.itemId}>
                                                    <td>{item.itemId}</td>
                                                    <td>{formatNumber(item.count)}</td>
                                                    <td>{formatNumber(item.stars)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Panel>
                            )}

                            <Panel
                                title={`${bot.label} — reports`}
                                actions={
                                    bot.reports.length > 0 ? (
                                        <Badge tone="warn">{bot.reports.length} waiting</Badge>
                                    ) : null
                                }
                            >
                                {bot.reports.length === 0 ? (
                                    <Empty>Nothing reported.</Empty>
                                ) : (
                                    <table className="a-table">
                                        <thead>
                                            <tr>
                                                <th>Coin</th>
                                                <th>Author</th>
                                                <th>Reported by</th>
                                                <th>Reason</th>
                                                <th>When</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bot.reports.map((report) => (
                                                <tr key={report.id}>
                                                    <td>
                                                        ${report.ticker} · {report.name}
                                                    </td>
                                                    <td>{report.creator}</td>
                                                    <td>{report.reporter}</td>
                                                    <td>{report.reason || "—"}</td>
                                                    <td>{formatRelative(report.createdAt)}</td>
                                                    <td>
                                                        <button
                                                            className="a-btn a-btn-danger"
                                                            disabled={busy === report.coinId}
                                                            onClick={() => setHidden(bot.id, report.coinId, true)}
                                                        >
                                                            Hide
                                                        </button>
                                                        <button
                                                            className="a-btn"
                                                            disabled={busy === report.coinId}
                                                            onClick={() => setHidden(bot.id, report.coinId, false)}
                                                        >
                                                            Keep
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </Panel>
                        </>
                    )}
                </div>
            ))}
        </>
    );
}
