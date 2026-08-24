// src/features/admin/ui/AdminShopPricesTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Save } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

interface ShopPriceRow {
    itemId: string;
    name: string;
    kind: string;
    description: string;
    maxOwned: number | null;
    currency: "ash" | "tnj" | "usd";
    priceAsh: number;
    priceTnj: number;
    priceUsdCents: number;
    enabled: boolean;
    tnjEstimate: number | null;
}

interface Draft {
    currency: "ash" | "tnj" | "usd";
    ash: string;
    tnj: string;
    usd: string;
    enabled: boolean;
}

const KIND_LABEL: Record<string, string> = {
    placeable: "Placeable",
    cosmetic: "Cosmetic",
    faction: "Faction",
    consumable: "Consumable",
    pet: "Pet",
    lootbox: "Lootbox",
    companion: "Companion",
    weapon: "Weapon",
    emote: "Emote",
};

export const AdminShopPricesTable = forwardRef<AdminTableRef>(function AdminShopPricesTable(_props, ref) {
    const [items, setItems] = useState<ShopPriceRow[]>([]);
    const [gameSlug, setGameSlug] = useState<string | null>(null);
    const [gameName, setGameName] = useState<string | null>(null);
    const [tnjUsdPrice, setTnjUsdPrice] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/shop-prices", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
                setGameSlug(data.gameSlug || null);
                setGameName(data.gameName || null);
                setTnjUsdPrice(data.tnjUsdPrice ?? null);
                const next: Record<string, Draft> = {};
                for (const item of data.items || []) {
                    next[item.itemId] = {
                        currency: item.currency,
                        ash: String(item.priceAsh),
                        tnj: String(item.priceTnj),
                        usd: (item.priceUsdCents / 100).toFixed(2),
                        enabled: item.enabled,
                    };
                }
                setDrafts(next);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const save = async (item: ShopPriceRow) => {
        const draft = drafts[item.itemId];
        if (!draft) return;

        const priceAsh = Math.max(0, Math.round(Number(draft.ash) || 0));
        const priceTnj = Math.max(0, Math.round(Number(draft.tnj) || 0));
        const priceUsdCents = Math.max(0, Math.round((Number(draft.usd) || 0) * 100));

        setError(null);
        setBusyId(item.itemId);
        try {
            const res = await signedFetch("/api/admin/shop-prices", "shop_price_set", item.itemId, {
                itemId: item.itemId,
                currency: draft.currency,
                priceAsh,
                priceTnj,
                priceUsdCents,
                enabled: draft.enabled,
                gameSlug,
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
            setBusyId(null);
        }
    };

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading prices...</div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-[#8B8F98]">
                    Prices for <span className="text-[#E5E7EB] font-bold">{gameName ?? "—"}</span>
                    {gameSlug ? <span className="text-[#6B7280] font-mono"> ({gameSlug})</span> : null}. They apply without a
                    game rebuild, ash prices reach the game server within a minute.
                </span>
                <span className="text-white font-bold">
                    TNJ: {tnjUsdPrice ? `$${tnjUsdPrice.toPrecision(4)}` : "price unavailable"}
                </span>
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="space-y-2">
                {items.map((item) => {
                    const draft = drafts[item.itemId];
                    if (!draft) return null;

                    const usdCents = Math.max(0, Math.round((Number(draft.usd) || 0) * 100));
                    const liveTnj = draft.currency === "usd" && tnjUsdPrice
                        ? Math.ceil(usdCents / 100 / tnjUsdPrice)
                        : null;

                    const dirty =
                        draft.currency !== item.currency ||
                        Math.round(Number(draft.ash) || 0) !== item.priceAsh ||
                        Math.round(Number(draft.tnj) || 0) !== item.priceTnj ||
                        usdCents !== item.priceUsdCents ||
                        draft.enabled !== item.enabled;

                    const update = (patch: Partial<Draft>) =>
                        setDrafts((prev) => ({ ...prev, [item.itemId]: { ...prev[item.itemId], ...patch } }));

                    return (
                        <div key={item.itemId} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm">{item.name}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#8B8F98]">
                                    {KIND_LABEL[item.kind] || item.kind}
                                </span>
                                <span className="text-[#6B7280] text-xs font-mono">{item.itemId}</span>
                                {item.maxOwned !== null && (
                                    <span className="text-[#6B7280] text-xs">max {item.maxOwned}</span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={draft.currency}
                                    onChange={(e) => update({ currency: e.target.value as "ash" | "tnj" | "usd" })}
                                    className="bg-black/40 text-white px-2 py-1.5 rounded text-xs border border-white/10 outline-none"
                                >
                                    <option value="ash">Ash</option>
                                    <option value="tnj">TNJ (fixed)</option>
                                    <option value="usd">USD → TNJ</option>
                                </select>

                                {draft.currency === "ash" ? (
                                    <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                                        Ash
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.ash}
                                            onChange={(e) => update({ ash: e.target.value })}
                                            className="w-28 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                                        />
                                    </label>
                                ) : draft.currency === "tnj" ? (
                                    <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                                        TNJ
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.tnj}
                                            onChange={(e) => update({ tnj: e.target.value })}
                                            className="w-36 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                                        />
                                    </label>
                                ) : (
                                    <>
                                        <label className="flex items-center gap-1.5 text-xs text-[#8B8F98]">
                                            USD $
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={draft.usd}
                                                onChange={(e) => update({ usd: e.target.value })}
                                                className="w-28 bg-black/40 text-white px-2 py-1.5 rounded border border-white/10 outline-none"
                                            />
                                        </label>
                                        <span className="text-xs text-cyan-400 font-bold">
                                            ≈ {liveTnj !== null ? `${liveTnj.toLocaleString("en-US")} TNJ` : "—"}
                                        </span>
                                    </>
                                )}

                                <label className="flex items-center gap-1.5 text-xs text-[#8B8F98] ml-auto">
                                    <input
                                        type="checkbox"
                                        checked={draft.enabled}
                                        onChange={(e) => update({ enabled: e.target.checked })}
                                    />
                                    On sale
                                </label>

                                <button
                                    onClick={() => save(item)}
                                    disabled={!dirty || busyId === item.itemId}
                                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {busyId === item.itemId ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
