// src/features/admin/ui/AdminOverview.tsx
"use client";

import { useEffect, useState } from "react";
import { Users, Wifi, ShieldBan, Coins, ShoppingCart, Gamepad2, Shield, LifeBuoy, Clock, Gauge } from "lucide-react";
import { Alert, Panel, Stat, Tile, formatNumber } from "./AdminKit";

interface OverviewData {
    generatedAt: string;
    tnjUsdPrice: number | null;
    players: {
        total: number;
        newDay: number;
        newWeek: number;
        online: number;
        banned: number;
        muted: number;
        owners: number;
        activeMonth: number;
        playtimeHours: number;
        avgLevel: number;
    };
    revenue: {
        grossTnj: number;
        grossUsd: number | null;
        gameSalesCount: number;
        gameSalesTnj: number;
        gameSalesTnjWeek: number;
        promoLicenses: number;
        shopCount: number;
        shopTnj: number;
        shopTnjWeek: number;
        shopFailed: number;
        tradeCount: number;
        tradeTnj: number;
        marketplaceCount: number;
        marketplaceTnj: number;
        factionCreationPaid: number;
        factionPromoPaid: number;
        factionGatePaid: number;
    };
    world: {
        factions: number;
        gates: number;
        questsActive: number;
        ticketsOpen: number;
        tournamentsLive: number;
    };
}

function usd(tnj: number, rate: number | null): string {
    if (!rate) return "—";
    return `$${(tnj * rate).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function AdminOverview({ refreshKey, onNavigate }: { refreshKey: number; onNavigate: (section: string) => void }) {
    const [data, setData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch("/api/admin/overview", { credentials: "include" })
            .then(async (res) => {
                const payload = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setError(payload?.error || `HTTP ${res.status}`);
                    return;
                }
                setError(null);
                setData(payload);
            })
            .catch(() => !cancelled && setError("Failed to load overview"))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    if (loading && !data) return <Panel title="Overview"><p className="a-dim">Loading…</p></Panel>;
    if (error) return <Alert tone="bad">{error}</Alert>;
    if (!data) return null;

    const { players, revenue, world } = data;
    const conversion = players.total > 0 ? Math.round((players.owners / players.total) * 100) : 0;

    return (
        <>
            <div className="a-grid a-grid-4">
                <Stat
                    label="Players"
                    value={formatNumber(players.total)}
                    hint={`+${players.newDay} today · +${players.newWeek} this week`}
                    icon={<Users className="w-3 h-3" />}
                />
                <Stat
                    label="Own the game"
                    value={formatNumber(players.owners)}
                    hint={`${conversion}% of all accounts · ${revenue.promoLicenses} via promo`}
                    tone="violet"
                    icon={<Gamepad2 className="w-3 h-3" />}
                />
                <Stat
                    label="Online now"
                    value={formatNumber(players.online)}
                    hint={`${formatNumber(players.activeMonth)} played in 30 days`}
                    tone="good"
                    icon={<Wifi className="w-3 h-3" />}
                />
                <Stat
                    label="Gross revenue"
                    value={`${formatNumber(revenue.grossTnj)} TNJ`}
                    hint={`≈ ${usd(revenue.grossTnj, data.tnjUsdPrice)} at the live rate`}
                    tone="warn"
                    icon={<Coins className="w-3 h-3" />}
                />
            </div>

            <div className="a-grid a-grid-2">
                <Panel
                    title="Revenue breakdown"
                    actions={
                        <button type="button" className="a-btn a-btn-sm" onClick={() => onNavigate("purchases")}>
                            Open purchases
                        </button>
                    }
                >
                    <div className="a-grid a-grid-3">
                        <Tile label="Game sales" value={`${formatNumber(revenue.gameSalesTnj)} TNJ`} />
                        <Tile label="Copies sold" value={formatNumber(revenue.gameSalesCount)} />
                        <Tile label="Game sales · 7d" value={`${formatNumber(revenue.gameSalesTnjWeek)} TNJ`} />
                        <Tile label="Shop revenue" value={`${formatNumber(revenue.shopTnj)} TNJ`} />
                        <Tile label="Shop purchases" value={formatNumber(revenue.shopCount)} />
                        <Tile label="Shop · 7d" value={`${formatNumber(revenue.shopTnjWeek)} TNJ`} />
                        <Tile label="Trade volume" value={`${formatNumber(revenue.tradeTnj)} TNJ`} />
                        <Tile label="Trades" value={formatNumber(revenue.tradeCount)} />
                        <Tile label="Failed shop payments" value={formatNumber(revenue.shopFailed)} />
                    </div>
                </Panel>

                <Panel title="Paid faction perks">
                    <div className="a-grid a-grid-3">
                        <Tile label="Factions" value={formatNumber(world.factions)} />
                        <Tile label="Paid creations" value={formatNumber(revenue.factionCreationPaid)} />
                        <Tile label="Paid promo codes" value={formatNumber(revenue.factionPromoPaid)} />
                        <Tile label="Token gate rooms" value={formatNumber(world.gates)} />
                        <Tile label="Paid gates" value={formatNumber(revenue.factionGatePaid)} />
                        <Tile label="Marketplace" value={`${formatNumber(revenue.marketplaceTnj)} TNJ`} />
                    </div>
                </Panel>
            </div>

            <div className="a-grid a-grid-4">
                <Stat
                    label="Banned"
                    value={formatNumber(players.banned)}
                    hint={`${formatNumber(players.muted)} currently muted`}
                    tone={players.banned > 0 ? "bad" : "neutral"}
                    icon={<ShieldBan className="w-3 h-3" />}
                />
                <Stat
                    label="Open tickets"
                    value={formatNumber(world.ticketsOpen)}
                    hint={world.ticketsOpen > 0 ? "Waiting for a reply" : "All answered"}
                    tone={world.ticketsOpen > 0 ? "warn" : "good"}
                    icon={<LifeBuoy className="w-3 h-3" />}
                />
                <Stat
                    label="Total playtime"
                    value={`${formatNumber(players.playtimeHours)} h`}
                    hint={`Average level ${players.avgLevel}`}
                    icon={<Clock className="w-3 h-3" />}
                />
                <Stat
                    label="Live content"
                    value={`${world.questsActive} quests · ${world.tournamentsLive} contests`}
                    hint="Active faction quests and published tournaments"
                    tone="violet"
                    icon={<Gauge className="w-3 h-3" />}
                />
            </div>

            <Panel title="Jump to">
                <div className="a-row">
                    <button type="button" className="a-btn" onClick={() => onNavigate("players")}>
                        <Users />
                        Players
                    </button>
                    <button type="button" className="a-btn" onClick={() => onNavigate("factions")}>
                        <Shield />
                        Factions
                    </button>
                    <button type="button" className="a-btn" onClick={() => onNavigate("shop")}>
                        <ShoppingCart />
                        Item prices
                    </button>
                    <button type="button" className="a-btn" onClick={() => onNavigate("support")}>
                        <LifeBuoy />
                        Support
                    </button>
                    <span className="a-hint a-spacer">Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>
                </div>
            </Panel>
        </>
    );
}
