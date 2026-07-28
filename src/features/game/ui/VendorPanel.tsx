// src/features/game/ui/VendorPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Store, ArrowLeftRight } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";
import { useMarketCaps } from "./useMarketCaps";
import { TokenHoverModal } from "./TokenHoverModal";

interface VendorPanelProps {
    isOpen: boolean;
    inventory: InventoryGridItem[];
    onClose: () => void;
    onSell: (address: string, quantity: number) => void;
}

const MAX_CART_SLOTS = 32;
const VENDOR_ITEMS: InventoryGridItem[] = [];

type CartOrigin = "sell" | "buy";
type CartEntry = { qty: number; origin: CartOrigin };

function estimateAsh(mc: number): number {
    if (mc < 10000) return 1;
    if (mc < 50000) return 2;
    if (mc < 100000) return 4;
    if (mc < 500000) return 10;
    return 20;
}

export function VendorPanel({ isOpen, inventory, onClose, onSell }: VendorPanelProps) {
    const [cart, setCart] = useState<Record<string, CartEntry>>({});
    const [pickItem, setPickItem] = useState<InventoryGridItem | null>(null);
    const [pickOrigin, setPickOrigin] = useState<CartOrigin>("sell");
    const [pickQuantity, setPickQuantity] = useState(1);
    const [hovered, setHovered] = useState<InventoryGridItem | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const marketCaps = useMarketCaps(inventory.map((i) => i.address), isOpen);

    useEffect(() => {
        setCart((prev) => {
            let changed = false;
            const next: Record<string, CartEntry> = {};
            for (const [address, entry] of Object.entries(prev)) {
                if (entry.origin !== "sell") { next[address] = entry; continue; }
                const owned = inventory.find((i) => i.address === address)?.quantity ?? 0;
                if (owned <= 0) { changed = true; continue; }
                const clampedQty = Math.min(entry.qty, owned);
                if (clampedQty !== entry.qty) changed = true;
                if (clampedQty > 0) next[address] = { qty: clampedQty, origin: entry.origin };
            }
            return changed ? next : prev;
        });
    }, [inventory]);

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

    const hoveredDisplay = useMemo(() => {
        if (!hovered) return null;
        const info = marketCaps[hovered.address];
        return {
            address: hovered.address,
            image: info?.image || hovered.image,
            name: info?.name || hovered.name,
            symbol: info?.symbol || hovered.symbol,
        };
    }, [hovered, marketCaps]);

    if (!isOpen) return null;

    const showWarning = (msg: string) => {
        setWarning(msg);
        if (warningTimer.current) clearTimeout(warningTimer.current);
        warningTimer.current = setTimeout(() => setWarning(null), 2500);
    };

    const cartEntries = Object.entries(cart).filter(([, entry]) => entry.qty > 0);
    const cartOrigin: CartOrigin | null = cartEntries[0]?.[1].origin ?? null;
    const cartFull = cartEntries.length >= MAX_CART_SLOTS;

    const openPicker = (item: InventoryGridItem, origin: CartOrigin) => {
        setPickItem(item);
        setPickOrigin(origin);
        setPickQuantity(cart[item.address]?.qty || 1);
    };

    const handleSlotClick = (item: InventoryGridItem, origin: CartOrigin) => {
        const alreadyStaged = Boolean(cart[item.address]);
        if (!alreadyStaged) {
            if (cartOrigin && cartOrigin !== origin) {
                showWarning(
                    origin === "sell"
                        ? "Clear the exchange before selling."
                        : "Clear the exchange before buying."
                );
                return;
            }
            if (cartEntries.length >= MAX_CART_SLOTS) return;
        }
        if (item.quantity <= 1) {
            setCart((prev) => (prev[item.address] ? prev : { ...prev, [item.address]: { qty: 1, origin } }));
            return;
        }
        openPicker(item, origin);
    };

    const removeFromCart = (address: string) => {
        setCart((prev) => {
            if (!prev[address]) return prev;
            const next = { ...prev };
            delete next[address];
            return next;
        });
    };

    const clearCart = () => setCart({});

    const confirmPick = (quantityOverride?: number) => {
        if (!pickItem) return;
        const qty = Math.max(1, Math.min(quantityOverride ?? pickQuantity, pickItem.quantity));
        setCart((prev) => ({ ...prev, [pickItem.address]: { qty, origin: pickOrigin } }));
        setPickItem(null);
    };

    const sellStaged: Record<string, number> = {};
    const buyStaged: Record<string, number> = {};
    for (const [address, entry] of cartEntries) {
        if (entry.origin === "sell") sellStaged[address] = entry.qty;
        else buyStaged[address] = entry.qty;
    }

    const cartItems: InventoryGridItem[] = cartEntries.map(([address, entry]) => {
        const sourceList = entry.origin === "sell" ? inventory : VENDOR_ITEMS;
        const item = sourceList.find((i) => i.address === address);
        const info = marketCaps[address];
        return {
            address,
            name: info?.name || item?.name || info?.symbol || item?.symbol || address,
            symbol: info?.symbol || item?.symbol || "",
            image: info?.image || item?.image || "",
            quantity: entry.qty,
        };
    });

    const totalAsh = cartEntries.reduce((sum, [address, entry]) => {
        const mc = marketCaps[address]?.mc;
        return sum + (mc !== undefined ? estimateAsh(mc ?? 0) * entry.qty : 0);
    }, 0);

    const handleConfirm = () => {
        if (cartOrigin !== "sell") return;
        for (const [address, entry] of cartEntries) {
            onSell(address, entry.qty);
        }
        setCart({});
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-auto font-oxanium gap-4 p-4">
            <div className="flex items-center justify-between w-full max-w-6xl">
                <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-[#FFD166]" />
                    <h2 className="text-xl font-black text-[#E5E7EB]">Token Vendor</h2>
                </div>
                <button onClick={onClose} className="text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-4 w-full max-w-6xl items-stretch">
                <div className="flex-1 bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-5 shadow-2xl">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-3">VENDOR</div>
                    <InventoryGrid
                        items={VENDOR_ITEMS}
                        columns={6}
                        stagedQuantities={buyStaged}
                        interactive
                        onSlotClick={(item) => handleSlotClick(item, "buy")}
                        onSlotRightClick={(item) => removeFromCart(item.address)}
                        onHoverChange={handleHoverChange}
                        emptyMessage="Nothing for sale yet. Check back later."
                    />
                </div>

                <div className="w-[260px] flex-shrink-0 bg-[rgba(20,16,8,0.92)] border-2 border-[#FFD166]/50 rounded-[16px] p-5 shadow-[0_0_35px_rgba(255,209,102,0.15)] flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <ArrowLeftRight className="w-4 h-4 text-[#FFD166]" />
                            <span className="text-[#FFD166] text-xs font-bold tracking-wider">EXCHANGE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${cartFull ? "text-red-400" : "text-[#8B8F98]"}`}>
                                {cartEntries.length}/{MAX_CART_SLOTS}
                            </span>
                            {cartEntries.length > 0 && (
                                <button
                                    onClick={clearCart}
                                    className="text-[#8B8F98] hover:text-red-400 text-[10px] font-bold underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    {warning && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">{warning}</div>
                    )}
                    {!warning && cartFull && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">
                            Exchange full — confirm or clear before adding more.
                        </div>
                    )}

                    <div className="flex-1 min-h-[120px] mb-2">
                        <InventoryGrid
                            items={cartItems}
                            slotCount={MAX_CART_SLOTS}
                            columns={4}
                            interactive
                            onSlotClick={(item) => removeFromCart(item.address)}
                            emptyMessage="Click items to stage a sale or purchase here."
                        />
                    </div>

                    <div className="pt-3 mt-3 border-t border-[rgba(255,209,102,0.2)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                                {cartOrigin === "buy" ? "COST" : "TOTAL"}
                            </span>
                            <div className="flex items-center gap-1.5 text-[#FFD166] font-bold">
                                <Sparkles className="w-4 h-4" />
                                ~{totalAsh}
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={cartEntries.length === 0 || cartOrigin === "buy"}
                            title={cartOrigin === "buy" ? "Buying isn't available yet" : undefined}
                            className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] disabled:opacity-40 disabled:cursor-not-allowed text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                        >
                            {cartOrigin === "buy" ? "Buying isn't available yet" : "Sell"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-5 shadow-2xl">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-3">YOUR INVENTORY</div>
                    <InventoryGrid
                        items={inventory}
                        columns={6}
                        stagedQuantities={sellStaged}
                        interactive
                        onSlotClick={(item) => handleSlotClick(item, "sell")}
                        onSlotRightClick={(item) => removeFromCart(item.address)}
                        onHoverChange={handleHoverChange}
                        emptyMessage="You have nothing to sell."
                    />
                </div>
            </div>

            {pickItem && (
                <div
                    className="absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-10"
                    onClick={() => setPickItem(null)}
                >
                    <div
                        className="bg-[rgba(18,18,20,0.98)] border border-[rgba(255,255,255,0.12)] rounded-[12px] p-5 w-[280px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <img
                                src={pickItem.image || "/fallback-token.png"}
                                alt={pickItem.symbol}
                                className="w-10 h-10 rounded-[6px] object-cover"
                            />
                            <div className="min-w-0">
                                <div className="text-[#E5E7EB] text-sm font-bold truncate">{pickItem.name || pickItem.symbol}</div>
                                <div className="text-[#8B8F98] text-[10px]">
                                    {pickOrigin === "sell" ? "You own" : "Available"} {pickItem.quantity}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 mb-4">
                            <button
                                onClick={() => setPickQuantity((q) => Math.max(1, q - 1))}
                                className="w-9 h-9 rounded-[8px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#E5E7EB] font-bold text-lg"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min={1}
                                max={pickItem.quantity}
                                value={pickQuantity}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setPickQuantity(Number.isFinite(v) ? Math.max(1, Math.min(v, pickItem.quantity)) : 1);
                                }}
                                className="w-16 text-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[8px] py-2 text-[#E5E7EB] font-bold outline-none focus:border-[#4FD1FF]"
                            />
                            <button
                                onClick={() => setPickQuantity((q) => Math.min(pickItem.quantity, q + 1))}
                                className="w-9 h-9 rounded-[8px] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#E5E7EB] font-bold text-lg"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setPickItem(null)}
                                className="flex-1 py-2.5 rounded-[8px] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[#8B8F98] font-bold text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmPick()}
                                className="flex-1 py-2.5 rounded-[8px] bg-[#4FD1FF] hover:bg-[#4FD1FF]/90 text-[rgba(12,12,14,0.9)] font-bold text-sm transition-all"
                            >
                                Add {pickQuantity}
                            </button>
                        </div>
                        <button
                            onClick={() => confirmPick(pickItem.quantity)}
                            className="w-full py-2.5 rounded-[8px] bg-[rgba(255,209,102,0.15)] hover:bg-[rgba(255,209,102,0.25)] border border-[#FFD166]/40 text-[#FFD166] font-bold text-sm transition-all"
                        >
                            Max ({pickItem.quantity})
                        </button>
                    </div>
                </div>
            )}

            {!pickItem && (
                <TokenHoverModal
                    token={hoveredDisplay}
                    marketCap={hovered ? marketCaps[hovered.address]?.mc : undefined}
                    onMouseEnter={cancelClear}
                    onMouseLeave={clearNow}
                />
            )}
        </div>
    );
}
