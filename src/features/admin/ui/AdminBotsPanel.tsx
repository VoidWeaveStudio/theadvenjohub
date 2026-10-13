// src/features/admin/ui/AdminBotsPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Users,
    Play,
    ShieldCheck,
    Coins,
    Flag,
    Star,
    Wifi,
    Trophy,
    Timer,
    Gift,
    Target,
} from "lucide-react";
import { Alert, Badge, Empty, Panel, Stat, formatNumber, formatRelative } from "./AdminKit";
import { useAdminSignature } from "../lib/useAdminSignature";

interface BotStats {
    players: number;
    named: number;
    stars: number;
    byItem: { itemId: string; stars: number; count: number }[];
    runs?: number;
    runs24h?: number;
    verified?: number;
    coins?: number;
    hiddenCoins?: number;
    openReports?: number;
    active24h?: number;
    islands?: number;
    reached?: number;
    contacts?: number;
    raids24h?: number;
    alliances?: number;
    new24h?: number;
    online?: number;
    ranked?: number;
    survivors?: number;
    bestSurvival?: number;
    bestRange?: number;
    gold?: number;
    tnj?: number;
    dailyClaims24h?: number;
    streak?: number;
}

function formatSpan(seconds: number): string {
    if (seconds <= 0) return "—";
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, "0")}`;
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
    moderated: boolean;
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
                    No bot is wired up yet. A game shows here once its pair of variables is set:
                    MEMETIC_API_URL and MEMETIC_ADMIN_TOKEN, SKERRA_API_URL and
                    SKERRA_ADMIN_TOKEN, BLOXARO_API_URL and BLOXARO_ADMIN_TOKEN.
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
                                    {bot.stats.active24h !== undefined && (
                                        <Stat
                                            label="Active"
                                            value={formatNumber(bot.stats.active24h)}
                                            hint={
                                                bot.stats.new24h !== undefined
                                                    ? `${formatNumber(bot.stats.new24h)} joined, seen in the last day`
                                                    : "seen in the last day"
                                            }
                                            icon={<Play className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.online !== undefined && (
                                        <Stat
                                            label="Online"
                                            value={formatNumber(bot.stats.online)}
                                            hint="in the lobby right now"
                                            icon={<Wifi className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.ranked !== undefined && (
                                        <Stat
                                            label="Ranked"
                                            value={formatNumber(bot.stats.ranked)}
                                            hint="past the training levels"
                                            icon={<Trophy className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.bestSurvival !== undefined && (
                                        <Stat
                                            label="Longest stand"
                                            value={formatSpan(bot.stats.bestSurvival)}
                                            hint={`${formatNumber(bot.stats.survivors ?? 0)} held the full run`}
                                            icon={<Timer className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.gold !== undefined && (
                                        <Stat
                                            label="Gold"
                                            value={formatNumber(bot.stats.gold)}
                                            hint={`${formatNumber(bot.stats.tnj ?? 0)} TNJ held`}
                                            icon={<Coins className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.dailyClaims24h !== undefined && (
                                        <Stat
                                            label="Daily claims"
                                            value={formatNumber(bot.stats.dailyClaims24h)}
                                            hint={`longest streak ${formatNumber(bot.stats.streak ?? 0)}`}
                                            icon={<Gift className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.bestRange !== undefined && (
                                        <Stat
                                            label="Range record"
                                            value={formatNumber(bot.stats.bestRange)}
                                            hint="best score on a firing range"
                                            icon={<Target className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.runs !== undefined && (
                                        <Stat
                                            label="Runs"
                                            value={formatNumber(bot.stats.runs)}
                                            hint={`${formatNumber(bot.stats.runs24h ?? 0)} in the last day`}
                                            icon={<Play className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.runs !== undefined && bot.stats.verified !== undefined && (
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
                                    )}
                                    <Stat
                                        label="Stars"
                                        value={formatNumber(bot.stats.stars)}
                                        hint={`${bot.stats.byItem.length} item kinds sold`}
                                        icon={<Star className="w-3 h-3" />}
                                    />
                                    {bot.stats.coins !== undefined && (
                                        <Stat
                                            label="Player coins"
                                            value={formatNumber(bot.stats.coins)}
                                            hint={`${formatNumber(bot.stats.hiddenCoins ?? 0)} hidden`}
                                            icon={<Coins className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.openReports !== undefined && (
                                        <Stat
                                            label="Open reports"
                                            value={formatNumber(bot.stats.openReports)}
                                            tone={bot.stats.openReports > 0 ? "warn" : "good"}
                                            icon={<Flag className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.islands !== undefined && (
                                        <Stat
                                            label="Shards"
                                            value={formatNumber(bot.stats.islands)}
                                            hint={`${formatNumber(bot.stats.reached ?? 0)} past the first rank`}
                                            icon={<Coins className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.contacts !== undefined && (
                                        <Stat
                                            label="Contacts"
                                            value={formatNumber(bot.stats.contacts)}
                                            hint={`${formatNumber(bot.stats.alliances ?? 0)} alliances`}
                                            icon={<Users className="w-3 h-3" />}
                                        />
                                    )}
                                    {bot.stats.raids24h !== undefined && (
                                        <Stat
                                            label="Raids"
                                            value={formatNumber(bot.stats.raids24h)}
                                            hint="opened in the last day"
                                            icon={<Flag className="w-3 h-3" />}
                                        />
                                    )}
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

                            {bot.moderated && (
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
                            )}
                        </>
                    )}
                </div>
            ))}
        </>
    );
}
