// src/features/game/ui/VendorPanel.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { X, Sparkles, Store, ArrowLeftRight } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";
import { useMarketCaps } from "./useMarketCaps";
import { TokenHoverModal } from "./TokenHoverModal";
import { useVendorCart } from "./useVendorCart";
import { VendorQuantityDialog } from "./VendorQuantityDialog";

interface VendorPanelProps {
    isOpen: boolean;
    inventory: InventoryGridItem[];
    onClose: () => void;
    onSell: (address: string, quantity: number) => void;
}

export function VendorPanel({ isOpen, inventory, onClose, onSell }: VendorPanelProps) {
    const [hovered, setHovered] = useState<InventoryGridItem | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const marketCaps = useMarketCaps(inventory.map((i) => i.address), isOpen);
    const cart = useVendorCart(inventory, marketCaps);

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

    const handleConfirm = () => {
        if (cart.cartOrigin !== "sell") return;
        for (const [address, entry] of cart.cartEntries) {
            onSell(address, entry.qty);
        }
        cart.clearCart();
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
                        items={cart.vendorItems}
                        columns={6}
                        stagedQuantities={cart.buyStaged}
                        interactive
                        onSlotClick={(item) => cart.handleSlotClick(item, "buy")}
                        onSlotRightClick={(item) => cart.removeFromCart(item.address)}
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
                            <span className={`text-[10px] font-bold ${cart.cartFull ? "text-red-400" : "text-[#8B8F98]"}`}>
                                {cart.cartEntries.length}/{cart.maxCartSlots}
                            </span>
                            {cart.cartEntries.length > 0 && (
                                <button
                                    onClick={cart.clearCart}
                                    className="text-[#8B8F98] hover:text-red-400 text-[10px] font-bold underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    {cart.warning && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">{cart.warning}</div>
                    )}
                    {!cart.warning && cart.cartFull && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">
                            Exchange full — confirm or clear before adding more.
                        </div>
                    )}

                    <div className="flex-1 min-h-[120px] mb-2">
                        <InventoryGrid
                            items={cart.cartItems}
                            slotCount={cart.maxCartSlots}
                            columns={4}
                            interactive
                            onSlotClick={(item) => cart.removeFromCart(item.address)}
                            emptyMessage="Click items to stage a sale or purchase here."
                        />
                    </div>

                    <div className="pt-3 mt-3 border-t border-[rgba(255,209,102,0.2)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                                {cart.cartOrigin === "buy" ? "COST" : "TOTAL"}
                            </span>
                            <div className="flex items-center gap-1.5 text-[#FFD166] font-bold">
                                <Sparkles className="w-4 h-4" />
                                ~{cart.totalAsh}
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={cart.cartEntries.length === 0 || cart.cartOrigin === "buy"}
                            title={cart.cartOrigin === "buy" ? "Buying isn't available yet" : undefined}
                            className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] disabled:opacity-40 disabled:cursor-not-allowed text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                        >
                            {cart.cartOrigin === "buy" ? "Buying isn't available yet" : "Sell"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-5 shadow-2xl">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-3">YOUR INVENTORY</div>
                    <InventoryGrid
                        items={inventory}
                        columns={6}
                        stagedQuantities={cart.sellStaged}
                        interactive
                        onSlotClick={(item) => cart.handleSlotClick(item, "sell")}
                        onSlotRightClick={(item) => cart.removeFromCart(item.address)}
                        onHoverChange={handleHoverChange}
                        emptyMessage="You have nothing to sell."
                    />
                </div>
            </div>

            {cart.pickItem && (
                <VendorQuantityDialog
                    item={cart.pickItem}
                    origin={cart.pickOrigin}
                    quantity={cart.pickQuantity}
                    onQuantityChange={cart.setPickQuantity}
                    onCancel={cart.cancelPick}
                    onConfirm={cart.confirmPick}
                />
            )}

            {!cart.pickItem && (
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
