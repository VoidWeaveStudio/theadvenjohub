// src/features/admin/ui/AdminGamePricesTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Save } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Empty, SearchInput } from "./AdminKit";
import type { GamePriceCurrency } from "@/core/lib/gamePricing";

interface GameRow {
    id: string;
    slug: string;
    title: string;
    price: number;
    priceCurrency: GamePriceCurrency;
    priceUsdCents: number;
    isActive: boolean;
    status: string;
    tnjEstimate: number | null;
}

interface Draft {
    currency: GamePriceCurrency;
    tnj: string;
    usdt: string;
}

function toDraft(game: GameRow): Draft {
    return {
        currency: game.priceCurrency,
        tnj: String(game.price),
        usdt: (game.priceUsdCents / 100).toFixed(2),
    };
}

export const AdminGamePricesTable = forwardRef<AdminTableRef>(function AdminGamePricesTable(_props, ref) {
    const [games, setGames] = useState<GameRow[]>([]);
    const [tnjUsdPrice, setTnjUsdPrice] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [loading, setLoading] = useState(true);
    const [busySlug, setBusySlug] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/games", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                const list: GameRow[] = data.games || [];
                setGames(list);
                setTnjUsdPrice(data.tnjUsdPrice ?? null);
                setDrafts(Object.fromEntries(list.map((game) => [game.slug, toDraft(game)])));
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const save = async (game: GameRow) => {
        const draft = drafts[game.slug];
        if (!draft) return;

        const price = Math.max(0, Math.round(Number(draft.tnj) || 0));
        const priceUsdCents = Math.max(0, Math.round((Number(draft.usdt) || 0) * 100));

        setError(null);
        setBusySlug(game.slug);
        try {
            const res = await signedFetch("/api/admin/games", "game_price_set", `game:${game.slug}`, {
                slug: game.slug,
                priceCurrency: draft.currency,
                price,
                priceUsdCents,
            });
            if (res.ok) {
                await load();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Save failed");
            }
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setBusySlug(null);
        }
    };

    if (loading) return <Empty>Loading games…</Empty>;

    const needle = query.trim().toLowerCase();
    const visible = games.filter((game) => !needle || `${game.title} ${game.slug} ${game.status}`.toLowerCase().includes(needle));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search game title, slug or status…" />
                <Badge tone="info">TNJ {tnjUsdPrice ? `$${tnjUsdPrice.toPrecision(4)}` : "rate unavailable"}</Badge>
            </div>

            <p className="a-hint">
                Store price per game. Pick <strong style={{ color: "var(--a-text)" }}>USDT → TNJ</strong> and the buyer pays the
                TNJ that amount is worth at checkout, recalculated on every quote.
            </p>

            {error && <Alert tone="bad">{error}</Alert>}

            {visible.length === 0 && <Empty>No games match.</Empty>}

            <div className="a-list">
                {visible.map((game) => {
                    const draft = drafts[game.slug];
                    if (!draft) return null;

                    const usdCents = Math.max(0, Math.round((Number(draft.usdt) || 0) * 100));
                    const liveTnj = draft.currency === "usdt" && tnjUsdPrice
                        ? Math.ceil(usdCents / 100 / tnjUsdPrice)
                        : null;

                    const dirty =
                        draft.currency !== game.priceCurrency ||
                        Math.round(Number(draft.tnj) || 0) !== game.price ||
                        usdCents !== game.priceUsdCents;

                    const update = (patch: Partial<Draft>) =>
                        setDrafts((prev) => ({ ...prev, [game.slug]: { ...prev[game.slug], ...patch } }));

                    return (
                        <div key={game.id} className="a-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, padding: 11 }}>
                            <div className="a-row">
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{game.title}</span>
                                <span className="a-hint a-mono">{game.slug}</span>
                                <Badge>{game.status}</Badge>
                                {!game.isActive && <Badge tone="bad">hidden</Badge>}
                            </div>

                            <div className="a-row">
                                <select
                                    value={draft.currency}
                                    onChange={(e) => update({ currency: e.target.value as GamePriceCurrency })}
                                    
                                >
                                    <option value="tnj">TNJ (fixed)</option>
                                    <option value="usdt">USDT → TNJ</option>
                                </select>

                                {draft.currency === "tnj" ? (
                                    <label className="a-row" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
                                        TNJ
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.tnj}
                                            onChange={(e) => update({ tnj: e.target.value })}
                                            style={{ width: 160 }}
                                        />
                                    </label>
                                ) : (
                                    <>
                                        <label className="a-row" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
                                            USDT
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={draft.usdt}
                                                onChange={(e) => update({ usdt: e.target.value })}
                                                style={{ width: 128 }}
                                            />
                                        </label>
                                        <span style={{ fontSize: 12, color: "var(--a-accent)", fontWeight: 700 }}>
                                            ≈ {liveTnj !== null ? `${liveTnj.toLocaleString("en-US")} TNJ` : "—"}
                                        </span>
                                    </>
                                )}

                                <button
                                    onClick={() => save(game)}
                                    disabled={!dirty || busySlug === game.slug}
                                    className="a-btn a-btn-sm a-btn-primary a-spacer"
                                >
                                    <Save />
                                    {busySlug === game.slug ? "Saving..." : "Save"}
                                </button>
                            </div>

                            {game.priceCurrency === "usdt" && (
                                <div className="a-hint">
                                    Live: buyers pay{" "}
                                    <span style={{ color: "var(--a-text)", fontWeight: 700 }}>
                                        {game.tnjEstimate !== null ? `${game.tnjEstimate.toLocaleString("en-US")} TNJ` : "—"}
                                    </span>{" "}
                                    for ${(game.priceUsdCents / 100).toFixed(2)}. The storefront listing is cached for up to
                                    5 minutes, so the card can lag the checkout figure slightly.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
