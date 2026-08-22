// src/features/admin/ui/AdminGamePricesTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Save } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
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

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading games...</div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-[#8B8F98]">
                    Store price per game. Pick <span className="text-[#E5E7EB] font-bold">USDT → TNJ</span> and the buyer
                    pays the TNJ that amount is worth at checkout, recalculated on every quote.
                </span>
                <span className="text-white font-bold">
                    TNJ: {tnjUsdPrice ? `$${tnjUsdPrice.toPrecision(4)}` : "price unavailable"}
                </span>
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            {games.length === 0 && <div className="text-[#6B7280] text-sm py-6 text-center">No games yet.</div>}

            <div className="space-y-2">
                {games.map((game) => {
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
                        <div key={game.id} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm">{game.title}</span>
                                <span className="text-[#6B7280] text-xs font-mono">{game.slug}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#8B8F98]">
                                    {game.status}
                                </span>
                                {!game.isActive && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                                        hidden
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={draft.currency}
                                    onChange={(e) => update({ currency: e.target.value as GamePriceCurrency })}
                                    className="bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                                >
                                    <option value="tnj">TNJ (fixed)</option>
                                    <option value="usdt">USDT → TNJ</option>
                                </select>

                                {draft.currency === "tnj" ? (
                                    <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                                        TNJ
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.tnj}
                                            onChange={(e) => update({ tnj: e.target.value })}
                                            className="w-40 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                                        />
                                    </label>
                                ) : (
                                    <>
                                        <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                                            USDT
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={draft.usdt}
                                                onChange={(e) => update({ usdt: e.target.value })}
                                                className="w-32 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                                            />
                                        </label>
                                        <span className="text-xs text-cyan-400 font-bold">
                                            ≈ {liveTnj !== null ? `${liveTnj.toLocaleString("en-US")} TNJ` : "—"}
                                        </span>
                                    </>
                                )}

                                <button
                                    onClick={() => save(game)}
                                    disabled={!dirty || busySlug === game.slug}
                                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 ml-auto disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {busySlug === game.slug ? "Saving..." : "Save"}
                                </button>
                            </div>

                            {game.priceCurrency === "usdt" && (
                                <div className="text-[11px] text-[#6B7280]">
                                    Live: buyers pay{" "}
                                    <span className="text-[#C9CDD3] font-bold">
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
