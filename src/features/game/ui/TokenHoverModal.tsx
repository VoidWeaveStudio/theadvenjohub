// src/features/game/ui/TokenHoverModal.tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { formatMC } from "../utils/formatMC";

export interface HoveredToken {
    address: string;
    name: string;
    symbol: string;
    image: string;
}

interface TokenHoverModalProps {
    token: HoveredToken | null;
    marketCap?: number;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export function TokenHoverModal({ token, marketCap, onMouseEnter, onMouseLeave }: TokenHoverModalProps) {
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
                className="bg-[rgba(12,12,14,0.97)] border border-[rgba(255,255,255,0.15)] rounded-[16px] p-6 shadow-2xl flex flex-col items-center gap-3 w-[320px] pointer-events-auto"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <img
                    src={token.image || "/fallback-token.png"}
                    alt={token.symbol || token.name}
                    className="w-24 h-24 rounded-[12px] object-cover border border-[rgba(255,255,255,0.1)]"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                />

                <div className="text-center">
                    <div className="text-[#E5E7EB] text-lg font-bold">{token.name || "Unknown Token"}</div>
                    <div className="text-[#8B8F98] text-sm">${token.symbol || "?"}</div>
                </div>

                <div className="w-full border-t border-[rgba(255,255,255,0.08)]" />

                <div className="w-full">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-1.5">CONTRACT ADDRESS</div>
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-between gap-2 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)] rounded-[8px] px-3 py-2 transition-colors group"
                        title="Copy contract address"
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
                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">MARKET CAP</span>
                    <span className="text-[#4FD1FF] font-bold text-sm">
                        {marketCap !== undefined ? formatMC(marketCap) : "Loading..."}
                    </span>
                </div>
            </div>
        </div>
    );
}
