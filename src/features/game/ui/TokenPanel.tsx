// src/features/game/ui/TokenPanel.tsx
"use client";

import { useEffect, useState } from "react";
import "./TokenPanel.css";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface TokenData {
    image?: string;
    name: string;
    symbol: string;
    price?: string;
    priceNative?: string;
    mc: number;
    liquidity?: number;
    liquidityBase?: number;
    liquidityQuote?: number;
    volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
    txns?: {
        m5?: { buys?: number; sells?: number };
        h1?: { buys?: number; sells?: number };
        h6?: { buys?: number; sells?: number };
        h24?: { buys?: number; sells?: number };
    };
    priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
    dex?: string;
    pairAddress?: string;
    url?: string;
    labels?: string[];
}

interface TokenPanelProps {
    ca: string;
    onClose: () => void;
}

function isSafeHttpUrl(url: string | undefined): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function isSafeDexscreenerUrl(url: string | undefined): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname === "dexscreener.com";
    } catch {
        return false;
    }
}

export function TokenPanel({ ca, onClose }: TokenPanelProps) {
    const { t } = useLanguage();
    const [data, setData] = useState<TokenData | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState<"overview" | "trading">("overview");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const res = await fetch(`/api/token-by-ca?ca=${ca}`, { signal: controller.signal });
                const json = await res.json();
                if (cancelled) return;
                setData(json);
                setNotFound(!json);
                setFailed(false);
            } catch (e) {
                console.error("Failed to load token data", e);
                if (!cancelled) setFailed(true);
            } finally {
                clearTimeout(timeout);
            }
        };

        load();
        const i = setInterval(load, 30000);
        return () => {
            cancelled = true;
            clearInterval(i);
        };
    }, [ca]);

    const format = (val: number | undefined) => {
        if (val === undefined || val === null) return "0";
        if (val > 1e9) return (val / 1e9).toFixed(2) + "B";
        if (val > 1e6) return (val / 1e6).toFixed(2) + "M";
        if (val > 1e3) return (val / 1e3).toFixed(2) + "K";
        return val.toFixed(2);
    };

    if (!data) {
        return (
            <div className="token-overlay" onClick={onClose}>
                <div className="token-panel" onClick={(e) => e.stopPropagation()}>
                    <button className="close-btn" onClick={onClose}>✖</button>
                    <div className="loading-state">
                        {failed
                            ? t("g.token.connectionError")
                            : notFound
                                ? t("g.token.noMarketData")
                                : t("g.token.loading")}
                    </div>
                </div>
            </div>
        );
    }

    const price = parseFloat(data.price || "0");
    const change24h = Number(data.priceChange?.h24) || 0;
    const positive = change24h >= 0;

    return (
        <div className="token-overlay" onClick={onClose}>
            <div className="token-panel" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>✖</button>

                {data.labels && data.labels.length > 0 && (
                    <div className="labels">
                        {data.labels.map((l, i) => (
                            <span key={i}>{l}</span>
                        ))}
                    </div>
                )}

                <div className="top-metrics">
                    <div>
                        <span>{t("g.token.marketCap")}</span>
                        <b>${format(data.mc)}</b>
                    </div>
                    <div>
                        <span>{t("g.token.liquidity")}</span>
                        <b>${format(data.liquidity)}</b>
                    </div>
                    <div>
                        <span>{t("g.token.volume24h")}</span>
                        <b>${format(data.volume?.h24)}</b>
                    </div>
                </div>

                <div className={`price-change ${positive ? "positive" : "negative"}`}>
                    <span>${price.toFixed(6)}</span>
                    <span>
                        {positive ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% (24h)
                    </span>
                </div>

                <div className="tabs">
                    <button onClick={() => setTab("overview")} className={tab === "overview" ? "active" : ""}>{t("g.token.overview")}</button>
                    <button onClick={() => setTab("trading")} className={tab === "trading" ? "active" : ""}>{t("g.token.trading")}</button>
                </div>

                <div className="tab-content">
                    {tab === "overview" && (
                        <div className="stats-grid">
                            <Stat label={t("g.token.priceNative")} value={data.priceNative || "0"} />
                            <Stat label={t("g.token.liquidityBase")} value={format(data.liquidityBase)} />
                            <Stat label={t("g.token.liquidityQuote")} value={format(data.liquidityQuote)} />
                            <Stat label={t("g.token.pairAddress")} value={`${data.pairAddress?.slice(0, 6)}...${data.pairAddress?.slice(-4)}` || "N/A"} />
                            <Stat label={t("g.token.dex")} value={data.dex?.toUpperCase() || t("g.token.unknownDex")} />
                            <Stat label={t("g.token.chain")} value="Solana" />
                        </div>
                    )}

                    {tab === "trading" && (
                        <div className="stats-grid">
                            <Stat label={t("g.token.volume5m")} value={`${format(data.volume?.m5)}`} />
                            <Stat label={t("g.token.volume1h")} value={`${format(data.volume?.h1)}`} />
                            <Stat label={t("g.token.volume6h")} value={`${format(data.volume?.h6)}`} />

                            <Stat label={t("g.token.tx5m")} value={`${data.txns?.m5?.buys || 0} / ${data.txns?.m5?.sells || 0}`} />
                            <Stat label={t("g.token.tx1h")} value={`${data.txns?.h1?.buys || 0} / ${data.txns?.h1?.sells || 0}`} />
                            <Stat label={t("g.token.tx24h")} value={`${data.txns?.h24?.buys || 0} / ${data.txns?.h24?.sells || 0}`} />

                            <Stat label={t("g.token.change5m")} value={`${(data.priceChange?.m5 || 0).toFixed(2)}%`} />
                            <Stat label={t("g.token.change1h")} value={`${(data.priceChange?.h1 || 0).toFixed(2)}%`} />
                            <Stat label={t("g.token.change6h")} value={`${(data.priceChange?.h6 || 0).toFixed(2)}%`} />
                        </div>
                    )}

                </div>

                <div className="token-bottom">
                    <img src={isSafeHttpUrl(data.image) ? data.image : "/fallback-token.png"} alt={data.symbol} />
                    <div className="token-meta">
                        <h2>{data.name}</h2>
                        <span className="symbol">{data.symbol}</span>
                    </div>
                </div>

                {isSafeDexscreenerUrl(data.url) && (
                    <a
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="buy-btn"
                    >
                        📊 View on Dexscreener
                    </a>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="stat-box">
            <span>{label}</span>
            <b>{value}</b>
        </div>
    );
}