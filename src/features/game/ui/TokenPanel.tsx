//src\features\game\ui\TokenPanel.tsx
"use client";

import { useEffect, useState } from "react";
import "./TokenPanel.css";

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
    websites?: { label?: string; url: string }[];
    socials?: { type: string; url: string }[];
    labels?: string[];
}

interface TokenPanelProps {
    ca: string;
    onClose: () => void;
}

export function TokenPanel({ ca, onClose }: TokenPanelProps) {
    const [data, setData] = useState<TokenData | null>(null);
    const [tab, setTab] = useState<"overview" | "trading" | "links">("overview");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/token-by-ca?ca=${ca}`);
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Failed to load token data", e);
            }
        };

        load();
        const i = setInterval(load, 30000);
        return () => clearInterval(i);
    }, [ca]);

    const format = (val: number | undefined) => {
        if (val === undefined || val === null) return "0";
        if (val > 1e9) return (val / 1e9).toFixed(2) + "B";
        if (val > 1e6) return (val / 1e6).toFixed(2) + "M";
        if (val > 1e3) return (val / 1e3).toFixed(2) + "K";
        return val.toFixed(2);
    };

    const getDexName = () => {
        if (!data?.url) return "DEX";
        if (data.url.includes("dexscreener")) return "Dexscreener";
        return data.dex?.toUpperCase() || "DEX";
    };

    if (!data) {
        return (
            <div className="token-overlay" onClick={onClose}>
                <div className="token-panel" onClick={(e) => e.stopPropagation()}>
                    <button className="close-btn" onClick={onClose}>✖</button>
                    <div className="loading-state">⏳ Loading token data...</div>
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
                        <span>Market Cap</span>
                        <b>${format(data.mc)}</b>
                    </div>
                    <div>
                        <span>Liquidity</span>
                        <b>${format(data.liquidity)}</b>
                    </div>
                    <div>
                        <span>24h Volume</span>
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
                    <button onClick={() => setTab("overview")} className={tab === "overview" ? "active" : ""}>Overview</button>
                    <button onClick={() => setTab("trading")} className={tab === "trading" ? "active" : ""}>Trading</button>
                    <button onClick={() => setTab("links")} className={tab === "links" ? "active" : ""}>Links</button>
                </div>

                <div className="tab-content">
                    {tab === "overview" && (
                        <div className="stats-grid">
                            <Stat label="Price (Native)" value={data.priceNative || "0"} />
                            <Stat label="Liquidity (Base)" value={format(data.liquidityBase)} />
                            <Stat label="Liquidity (Quote)" value={format(data.liquidityQuote)} />
                            <Stat label="Pair Address" value={`${data.pairAddress?.slice(0, 6)}...${data.pairAddress?.slice(-4)}` || "N/A"} />
                            <Stat label="DEX" value={data.dex?.toUpperCase() || "Unknown"} />
                            <Stat label="Chain" value="Solana" /> 
                        </div>
                    )}

                    {tab === "trading" && (
                        <div className="stats-grid">
                            <Stat label="5m Volume" value={`$${format(data.volume?.m5)}`} />
                            <Stat label="1h Volume" value={`$${format(data.volume?.h1)}`} />
                            <Stat label="6h Volume" value={`$${format(data.volume?.h6)}`} />
                            
                            <Stat label="5m TX" value={`${data.txns?.m5?.buys || 0} / ${data.txns?.m5?.sells || 0}`} />
                            <Stat label="1h TX" value={`${data.txns?.h1?.buys || 0} / ${data.txns?.h1?.sells || 0}`} />
                            <Stat label="24h TX" value={`${data.txns?.h24?.buys || 0} / ${data.txns?.h24?.sells || 0}`} />
                            
                            <Stat label="5m Change" value={`${(data.priceChange?.m5 || 0).toFixed(2)}%`} />
                            <Stat label="1h Change" value={`${(data.priceChange?.h1 || 0).toFixed(2)}%`} />
                            <Stat label="6h Change" value={`${(data.priceChange?.h6 || 0).toFixed(2)}%`} />
                        </div>
                    )}

                    {tab === "links" && (
                        <div className="links-container">
                            {data.websites?.map((w: any, i: number) => (
                                <a key={i} href={w.url} target="_blank" rel="noopener noreferrer" className="link-item">
                                    🌍 {w.label || "Official Website"}
                                </a>
                            ))}
                            {data.socials?.map((s: any, i: number) => (
                                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="link-item">
                                    🔗 {s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                                </a>
                            ))}
                            {data.url && (
                                <a href={data.url} target="_blank" rel="noopener noreferrer" className="link-item">
                                    📊 View Full Chart on Dexscreener
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className="token-bottom">
                    <img src={data.image || "/fallback-token.png"} alt={data.symbol} />
                    <div className="token-meta">
                        <h2>{data.name}</h2>
                        <span className="symbol">{data.symbol}</span>
                    </div>
                </div>

                {data.url && (
                    <a
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="buy-btn"
                    >
                        🚀 Buy on {getDexName()}
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