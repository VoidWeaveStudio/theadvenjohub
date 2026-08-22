// src/features/game/ui/Inventory.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Backpack, X, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";
import { useMarketCaps } from "./useMarketCaps";
import { TokenHoverModal } from "./TokenHoverModal";
import { useLanguage } from "@/core/i18n/LanguageContext";

export type InventoryEntry = InventoryGridItem;

interface InventoryProps {
    items: InventoryEntry[];
    ash: number;
    isOpen: boolean;
    onClose: () => void;
    placeables?: Record<string, number>;
    homeTeleport?: { casting: boolean; cooldownUntil: number };
    onTeleportHome?: () => void;
}

export function Inventory({ items, ash, isOpen, onClose, placeables = {}, homeTeleport, onTeleportHome }: InventoryProps) {
    const { t } = useLanguage();
    const marketCaps = useMarketCaps(items.map((i) => i.address), isOpen);
    const [hovered, setHovered] = useState<InventoryGridItem | null>(null);
    const [pinnedAddress, setPinnedAddress] = useState<string | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleHoverChange = useCallback((item: InventoryGridItem | null) => {
        if (clearTimer.current) {
            clearTimeout(clearTimer.current);
            clearTimer.current = null;
        }
        if (item) {
            setHovered(item);
        } else {
            clearTimer.current = setTimeout(() => setHovered(null), 250);
        }
    }, []);

    const cancelClear = useCallback(() => {
        if (clearTimer.current) {
            clearTimeout(clearTimer.current);
            clearTimer.current = null;
        }
    }, []);

    const clearNow = useCallback(() => {
        cancelClear();
        setHovered(null);
    }, [cancelClear]);

    const handleSlotClick = useCallback((item: InventoryGridItem) => {
        setPinnedAddress((prev) => (prev === item.address ? null : item.address));
        setHovered(item);
    }, []);

    useEffect(() => {
        if (!isOpen) setPinnedAddress(null);
    }, [isOpen]);

    useEffect(() => {
        if (pinnedAddress && !items.some((i) => i.address === pinnedAddress)) {
            setPinnedAddress(null);
        }
    }, [items, pinnedAddress]);

    const pinnedItem = useMemo(
        () => (pinnedAddress ? items.find((i) => i.address === pinnedAddress) ?? null : null),
        [items, pinnedAddress]
    );

    const active = pinnedItem ?? hovered;

    const activeDisplay = useMemo(() => {
        if (!active) return null;
        const info = marketCaps[active.address];
        return {
            address: active.address,
            image: info?.image || active.image,
            name: info?.name || active.name,
            symbol: info?.symbol || active.symbol,
        };
    }, [active, marketCaps]);

    if (!isOpen) return null;

    return (
        <div className="absolute right-8 top-24 bottom-24 pointer-events-auto font-oxanium flex items-center">
            <div className="bg-[rgba(12,12,14,0.9)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] p-4 w-full max-w-[420px] max-h-full flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Backpack className="w-4 h-4 text-[#4FD1FF]" />
                        <span className="text-[#E5E7EB] text-xs font-bold tracking-wider">{t("g.inv.title")}</span>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <InventoryGrid
                    items={items}
                    interactive
                    selectedAddress={pinnedAddress}
                    onSlotClick={handleSlotClick}
                    onHoverChange={handleHoverChange}
                />

                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.stat.ashCaps")}</span>
                    </div>
                    <span className="text-[#FFD166] text-lg font-bold">{ash}</span>
                </div>

                {(placeables["run-insurance"] || 0) > 0 && (
                    <div className="mt-2 flex items-center gap-2 bg-[rgba(74,222,128,0.1)] border border-[#4ADE80]/30 rounded-lg px-3 py-2">
                        <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />
                        <span className="text-[#4ADE80] text-xs font-bold tracking-wider">{t("g.inv.insured")}</span>
                        <span className="text-[#6B7280] text-[10px] ml-auto">{t("g.inv.insuredHint")}</span>
                    </div>
                )}

                <button
                    onClick={onTeleportHome}
                    disabled={homeTeleport?.casting === true || (placeables["home-teleport"] || 0) <= 0}
                    className="mt-2 w-full flex items-center justify-center gap-2 bg-[rgba(138,212,255,0.12)] border border-[#8AD4FF]/30 hover:border-[#8AD4FF] disabled:border-white/10 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-[#8AD4FF] text-xs font-bold tracking-wider transition-colors"
                >
                    {homeTeleport?.casting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🌀</span>}
                    <span>{homeTeleport?.casting ? t("g.inv.channelling") : t("g.inv.teleportHome")}</span>
                    <span className="ml-auto text-[#6B7280] text-[10px]">x{placeables["home-teleport"] || 0}</span>
                </button>

                <div className="mt-2 text-[#6B7280] text-[10px]">
                    {t("g.inv.pinHint")}
                </div>
            </div>

            <TokenHoverModal
                token={activeDisplay}
                marketCap={active ? marketCaps[active.address]?.mc : undefined}
                pinned={pinnedItem !== null}
                onUnpin={() => setPinnedAddress(null)}
                onMouseEnter={cancelClear}
                onMouseLeave={pinnedItem ? undefined : clearNow}
            />
        </div>
    );
}
