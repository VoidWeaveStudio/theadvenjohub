// src/features/game/ui/TokenHoverModal.tsx
"use client";

import { useState } from "react";
import { Copy, Check, Pin, X } from "lucide-react";
import { formatMC } from "../utils/formatMC";
import { useLanguage } from "@/core/i18n/LanguageContext";

export interface HoveredToken {
    address: string;
    name: string;
    symbol: string;
    image: string;
}

interface TokenHoverModalProps {
    token: HoveredToken | null;
    marketCap?: number | null;
    pinned?: boolean;
    onUnpin?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export function TokenHoverModal({ token, marketCap, pinned, onUnpin, onMouseEnter, onMouseLeave }: TokenHoverModalProps) {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);

    if (!token) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(token.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) { }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none font-oxanium">
            <div
                className={`bg-[rgba(12,12,14,0.97)] border rounded-[16px] p-6 shadow-2xl flex flex-col items-center gap-3 w-full max-w-[320px] pointer-events-auto ${pinned ? "border-[#4FD1FF]/60" : "border-[rgba(255,255,255,0.15)]"}`}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {pinned && (
                    <div className="w-full flex items-center justify-between -mt-2">
                        <span className="flex items-center gap-1.5 text-[#4FD1FF] text-[10px] font-bold tracking-wider">
                            <Pin className="w-3 h-3" /> {t("g.token.pinned")}
                        </span>
                        <button
                            onClick={onUnpin}
                            title={t("g.tokenHover.unpin")}
                            className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <img
                    src={token.image || "/fallback-token.png"}
                    alt={token.symbol || token.name}
                    className="w-24 h-24 rounded-[12px] object-cover border border-[rgba(255,255,255,0.1)]"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                />

                <div className="text-center">
                    <div className="text-[#E5E7EB] text-lg font-bold">{token.name || t("g.token.unknown")}</div>
                    <div className="text-[#8B8F98] text-sm">${token.symbol || "?"}</div>
                </div>

                <div className="w-full border-t border-[rgba(255,255,255,0.08)]" />

                <div className="w-full">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-1.5">{t("g.token.contractAddress")}</div>
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-between gap-2 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] rounded-[8px] px-3 py-2 transition-colors group"
                        title={t("g.token.copyCa")}
                    >
                        <span className="text-[#E5E7EB] font-mono text-[11px] break-all text-left">
                            {token.address || "N/A"}
                        </span>
                        {token.address && (
                            copied ? (
                                <Check className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />
                            ) : (
                                <Copy className="w-4 h-4 text-[#8B8F98] group-hover:text-[#E5E7EB] flex-shrink-0" />
                            )
                        )}
                    </button>
                </div>

                <div className="w-full flex items-center justify-between">
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.tokenHover.marketCap")}</span>
                    <span className="text-[#4FD1FF] font-bold text-sm">
                        {marketCap === null ? "N/A" : marketCap !== undefined ? formatMC(marketCap) : "Loading..."}
                    </span>
                </div>
            </div>
        </div>
    );
}
