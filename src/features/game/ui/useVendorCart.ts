// src/features/game/ui/useVendorCart.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { InventoryGridItem } from "./InventoryGrid";
import { TokenInfo } from "./useMarketCaps";

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

export function useVendorCart(inventory: InventoryGridItem[], marketCaps: Record<string, TokenInfo>) {
    const [cart, setCart] = useState<Record<string, CartEntry>>({});
    const [pickItem, setPickItem] = useState<InventoryGridItem | null>(null);
    const [pickOrigin, setPickOrigin] = useState<CartOrigin>("sell");
    const [pickQuantity, setPickQuantity] = useState(1);
    const [warning, setWarning] = useState<string | null>(null);
    const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const showWarning = (msg: string) => {
        setWarning(msg);
        if (warningTimer.current) clearTimeout(warningTimer.current);
        warningTimer.current = setTimeout(() => setWarning(null), 2500);
    };

    const cartEntries = Object.entries(cart).filter(([, entry]) => entry.qty > 0);
    const cartOrigin: CartOrigin | null = cartEntries[0]?.[1].origin ?? null;
    const cartFull = cartEntries.length >= MAX_CART_SLOTS;

    const ownedOf = (address: string) => inventory.find((i) => i.address === address)?.quantity ?? 0;

    const openPicker = (item: InventoryGridItem, origin: CartOrigin) => {
        setPickItem(item);
        setPickOrigin(origin);
        setPickQuantity(Math.min(cart[item.address]?.qty || 1, item.quantity));
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

        const available = origin === "sell" ? ownedOf(item.address) : item.quantity;
        if (available <= 0) return;

        if (available <= 1) {
            setCart((prev) => (prev[item.address] ? prev : { ...prev, [item.address]: { qty: 1, origin } }));
            return;
        }

        openPicker({ ...item, quantity: available }, origin);
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

    return {
        vendorItems: VENDOR_ITEMS,
        maxCartSlots: MAX_CART_SLOTS,
        cartEntries,
        cartOrigin,
        cartFull,
        sellStaged,
        buyStaged,
        cartItems,
        totalAsh,
        warning,
        pickItem,
        pickOrigin,
        pickQuantity,
        setPickQuantity,
        handleSlotClick,
        removeFromCart,
        clearCart,
        confirmPick,
        cancelPick: () => setPickItem(null),
    };
}
