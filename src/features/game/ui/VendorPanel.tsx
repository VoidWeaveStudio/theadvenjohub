// src/features/game/ui/VendorPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Store, ArrowLeftRight } from "lucide-react";
import { InventoryGrid, InventoryGridItem } from "./InventoryGrid";
import { useMarketCaps } from "./useMarketCaps";
import { TokenHoverModal } from "./TokenHoverModal";
import { useVendorCart } from "./useVendorCart";
import { VendorQuantityDialog } from "./VendorQuantityDialog";
import { SoundManager } from "../core/SoundManager";
import { AshStore } from "./AshStore";
import { QuestInfoData } from "../network/NetworkManager";
import { useShopPrices } from "./hooks/useShopPrices";
import { NpcQuestSection } from "./NpcQuestCard";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface VendorPanelProps {
    isOpen: boolean;
    quest: QuestInfoData | null;
    onAcceptQuest: (questId: string) => void;
    onTurnInQuest: (questId: string) => void;
    inventory: InventoryGridItem[];
    lastSellResult?: { address: string; at: number } | null;
    gameSlug: string;
    ash: number;
    placeables: Record<string, number>;
    onClose: () => void;
    onSell: (address: string, quantity: number) => void;
    onBuyItem: (itemId: string, quantity: number) => void;
}

type VendorTab = "buy" | "sell";

const PENDING_TIMEOUT = 12000;
const SELL_SEND_SPACING = 70;

export function VendorPanel({ isOpen, quest, onAcceptQuest, onTurnInQuest, inventory, lastSellResult, gameSlug, ash, placeables, onClose, onSell, onBuyItem }: VendorPanelProps) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<VendorTab>("buy");
    const { prices: shopPrices } = useShopPrices(gameSlug, isOpen);
    const [hovered, setHovered] = useState<InventoryGridItem | null>(null);
    const [pending, setPending] = useState<Record<string, number>>({});
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const marketCaps = useMarketCaps(inventory.map((i) => i.address), isOpen);
    const cart = useVendorCart(inventory, marketCaps);

    useEffect(() => {
        if (!lastSellResult) return;
        setPending((prev) => {
            if (!prev[lastSellResult.address]) return prev;
            const next = { ...prev };
            delete next[lastSellResult.address];
            return next;
        });
    }, [lastSellResult]);

    useEffect(() => {
        if (Object.keys(pending).length === 0) return;
        const timer = setTimeout(() => setPending({}), PENDING_TIMEOUT);
        return () => clearTimeout(timer);
    }, [pending]);

    const sellTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => () => {
        sellTimers.current.forEach(clearTimeout);
        sellTimers.current = [];
    }, []);

    const clearCartRef = useRef(cart.clearCart);
    clearCartRef.current = cart.clearCart;

    useEffect(() => {
        if (isOpen) return;
        setPending({});
        clearCartRef.current();
    }, [isOpen]);

    const availableInventory = useMemo(
        () => inventory
            .map((item) => ({
                ...item,
                quantity: item.quantity - (cart.sellStaged[item.address] ?? 0) - (pending[item.address] ?? 0),
            }))
            .filter((item) => item.quantity > 0),
        [inventory, cart.sellStaged, pending]
    );

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

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (cart.cartOrigin !== "sell") return;

        const staged = cart.cartEntries.filter(([, entry]) => entry.origin === "sell");
        if (staged.length === 0) return;

        setPending((prev) => {
            const next = { ...prev };
            for (const [address, entry] of staged) {
                next[address] = (next[address] ?? 0) + entry.qty;
            }
            return next;
        });

        staged.forEach(([address, entry], index) => {
            if (index === 0) {
                onSell(address, entry.qty);
                return;
            }
            sellTimers.current.push(setTimeout(() => onSell(address, entry.qty), index * SELL_SEND_SPACING));
        });

        cart.clearCart();
    };

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-auto font-oxanium gap-4 p-2 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="flex items-center justify-between w-full max-w-6xl">
                <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-[#FFD166]" />
                    <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.npc.tony")}</h2>
                </div>

                <div className="flex gap-1 bg-[rgba(12,12,14,0.8)] border border-white/10 rounded-[10px] p-1">
                    {([["buy", t("g.vendor.tabBuy")], ["sell", t("g.vendor.tabSell")]] as [VendorTab, string][]).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`px-4 py-1.5 rounded-[7px] text-xs font-bold transition-colors ${tab === id
                                ? "bg-[rgba(255,209,102,0.16)] text-[#FFD166]"
                                : "bg-transparent text-[#8B8F98] hover:text-[#E5E7EB]"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="w-full max-w-3xl empty:hidden">
                <NpcQuestSection
                    quest={quest}
                    accent="#FFD166"
                    onAccept={onAcceptQuest}
                    onTurnIn={onTurnInQuest}
                />
            </div>

            {tab === "buy" && (
                <div className="w-full max-w-3xl h-[calc(60*var(--game-vh))] bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-5 shadow-2xl">
                    <AshStore ash={ash} placeables={placeables} prices={shopPrices} onBuyItem={onBuyItem} />
                </div>
            )}

            <div className={`gap-4 w-full max-w-4xl items-stretch ${tab === "sell" ? "flex" : "hidden"}`}>
                <div className="flex-1 bg-[rgba(12,12,14,0.92)] border border-[rgba(255,255,255,0.1)] rounded-[16px] p-5 shadow-2xl">
                    <div className="text-[#8B8F98] text-xs font-bold tracking-wider mb-3">{t("g.vendor.yourInventory")}</div>
                    <InventoryGrid
                        items={availableInventory}
                        columns={6}
                        interactive
                        onSlotClick={(item) => cart.handleSlotClick(item, "sell")}
                        onSlotRightClick={(item) => cart.removeFromCart(item.address)}
                        onHoverChange={handleHoverChange}
                        emptyMessage={
                            cart.cartEntries.length > 0
                                ? t("g.vendor.allStaged")
                                : t("g.vendor.nothingToSell")
                        }
                    />
                </div>

                <div className="w-full max-w-[260px] flex-shrink-0 bg-[rgba(20,16,8,0.92)] border-2 border-[#FFD166]/50 rounded-[16px] p-5 shadow-[0_0_35px_rgba(255,209,102,0.15)] flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <ArrowLeftRight className="w-4 h-4 text-[#FFD166]" />
                            <span className="text-[#FFD166] text-xs font-bold tracking-wider">{t("g.vendor.exchange")}</span>
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
                                    {t("g.vendor.clear")}
                                </button>
                            )}
                        </div>
                    </div>
                    {cart.warning && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">{t(cart.warning)}</div>
                    )}
                    {!cart.warning && cart.cartFull && (
                        <div className="text-red-400 text-[10px] font-semibold mb-2">
                            {t("g.vendor.exchangeFull")}
                        </div>
                    )}

                    <div className="flex-1 min-h-[120px] mb-2">
                        <InventoryGrid
                            items={cart.cartItems}
                            slotCount={cart.maxCartSlots}
                            columns={4}
                            interactive
                            onSlotClick={(item) => cart.removeFromCart(item.address)}
                            emptyMessage={t("g.vendor.stageHint")}
                        />
                    </div>

                    {Object.keys(pending).length > 0 && (
                        <div className="text-[#7FE6CF] text-[10px] font-semibold mb-1">
                            {t("g.vendor.selling")}
                        </div>
                    )}

                    <div className="pt-3 mt-3 border-t border-[rgba(255,209,102,0.2)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                                {t("g.vendor.total")}
                            </span>
                            <div className="flex items-center gap-1.5 text-[#FFD166] font-bold">
                                <Sparkles className="w-4 h-4" />
                                ~{cart.totalAsh}
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={cart.cartEntries.length === 0}
                            className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] disabled:opacity-40 disabled:cursor-not-allowed text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                        >
                            {t("g.vendor.sell")}
                        </button>
                    </div>
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
