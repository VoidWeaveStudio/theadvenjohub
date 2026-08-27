// src/features/admin/ui/AdminShopPricesTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, SearchInput } from "./AdminKit";

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
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState("all");
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

    const kindOptions = useMemo(() => {
        const kinds = Array.from(new Set(items.map((item) => item.kind)));
        return [
            { id: "all", label: "All items", count: items.length },
            ...kinds.map((entry) => ({
                id: entry,
                label: KIND_LABEL[entry] || entry,
                count: items.filter((item) => item.kind === entry).length,
            })),
        ];
    }, [items]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return items.filter((item) => {
            if (kind !== "all" && item.kind !== kind) return false;
            if (!needle) return true;
            return `${item.name} ${item.itemId} ${item.description}`.toLowerCase().includes(needle);
        });
    }, [items, query, kind]);

    if (loading) return <Empty>Loading prices…</Empty>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search item name or id…" />
                <Badge tone="info">TNJ {tnjUsdPrice ? `$${tnjUsdPrice.toPrecision(4)}` : "rate unavailable"}</Badge>
            </div>
            <Chips value={kind} options={kindOptions} onChange={setKind} />

            <p className="a-hint">
                Prices for <strong style={{ color: "var(--a-text)" }}>{gameName ?? "—"}</strong>
                {gameSlug ? <span className="a-mono"> ({gameSlug})</span> : null}. They apply without a game rebuild; ash prices
                reach the game server within a minute.
            </p>

            {error && <Alert tone="bad">{error}</Alert>}

            {visible.length === 0 ? (
                <Empty>No items match.</Empty>
            ) : (
            <div className="a-list">
                {visible.map((item) => {
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
                        <div key={item.itemId} className="a-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, padding: 11 }}>
                            <div className="a-row">
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                                <Badge>{KIND_LABEL[item.kind] || item.kind}</Badge>
                                <span className="a-hint a-mono">{item.itemId}</span>
                                {item.maxOwned !== null && <span className="a-hint">max {item.maxOwned}</span>}
                                {!draft.enabled && <Badge tone="bad">off sale</Badge>}
                            </div>

                            <div className="a-row">
                                <select
                                    value={draft.currency}
                                    onChange={(e) => update({ currency: e.target.value as "ash" | "tnj" | "usd" })}
                                    
                                >
                                    <option value="ash">Ash</option>
                                    <option value="tnj">TNJ (fixed)</option>
                                    <option value="usd">USD → TNJ</option>
                                </select>

                                {draft.currency === "ash" ? (
                                    <label className="a-row" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
                                        Ash
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.ash}
                                            onChange={(e) => update({ ash: e.target.value })}
                                            style={{ width: 112 }}
                                        />
                                    </label>
                                ) : draft.currency === "tnj" ? (
                                    <label className="a-row" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
                                        TNJ
                                        <input
                                            type="number"
                                            min={0}
                                            value={draft.tnj}
                                            onChange={(e) => update({ tnj: e.target.value })}
                                            style={{ width: 144 }}
                                        />
                                    </label>
                                ) : (
                                    <>
                                        <label className="a-row" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
                                            USD $
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={draft.usd}
                                                onChange={(e) => update({ usd: e.target.value })}
                                                style={{ width: 112 }}
                                            />
                                        </label>
                                        <span style={{ fontSize: 12, color: "var(--a-accent)", fontWeight: 700 }}>
                                            ≈ {liveTnj !== null ? `${liveTnj.toLocaleString("en-US")} TNJ` : "—"}
                                        </span>
                                    </>
                                )}

                                <label className="a-row a-spacer" style={{ gap: 6, fontSize: 12, color: "var(--a-dim)" }}>
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
                                    className="a-btn a-btn-sm a-btn-primary"
                                >
                                    <Save />
                                    {busyId === item.itemId ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );
});
