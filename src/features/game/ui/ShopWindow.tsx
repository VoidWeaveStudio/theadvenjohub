// src/features/game/ui/ShopWindow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Boxes, Coins, PawPrint, Shirt, Smile, Store, Swords } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { SHOP_CATALOG, ShopCatalogEntry, ShopItemKind } from "@/core/lib/shopCatalog";
import { COMPANIONS, COMPANIONS_BY_ID, RARITY_META, RARITY_ORDER, type CompanionId } from "../data/companions";
import { COSMETICS_BY_ID, type CosmeticId } from "../data/cosmetics";
import { PreviewModal } from "./preview/PreviewModal";
import type { PreviewSubject } from "./preview/PreviewScene";
import { CompanionStateData } from "../network/NetworkManager";
import { CompanionCard } from "./CompanionCard";
import { useShopPrices, type LiveShopPrice } from "./hooks/useShopPrices";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { ShopBuyButton } from "./ShopBuyButton";

type ShopTab = "personalization" | "lootboxes" | "companions" | "weapons" | "emotes";

const TAB_KINDS: Record<ShopTab, ShopItemKind> = {
    personalization: "cosmetic",
    lootboxes: "lootbox",
    companions: "companion",
    weapons: "weapon",
    emotes: "emote",
};

interface ShopWindowProps {
    isOpen: boolean;
    gameSlug: string;
    placeables: Record<string, number>;
    companions: CompanionStateData;
    onRequestCompanions: () => void;
    onOpenCrate: () => void;
    onClose: () => void;
}

function formatTnj(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`;
    return `${amount}`;
}

function priceOf(entry: ShopCatalogEntry, live: LiveShopPrice | undefined) {
    return {
        tnj: live?.payableTnj ?? (live?.priceTnj || entry.defaultPriceTnj),
        currency: live?.currency ?? entry.defaultCurrency,
        enabled: live?.enabled !== false,
    };
}

export function ShopWindow({
    isOpen,
    gameSlug,
    placeables,
    companions,
    onRequestCompanions,
    onOpenCrate,
    onClose,
}: ShopWindowProps) {
    const { t } = useLanguage();
    const livePrices = useShopPrices(gameSlug, isOpen);
    const [activeTab, setActiveTab] = useState<ShopTab>("companions");
    const [justBought, setJustBought] = useState<Set<string>>(new Set());
    const [expandedCrate, setExpandedCrate] = useState<string | null>(null);
    const [preview, setPreview] = useState<
        { subject: PreviewSubject; title: string; subtitle?: string; accent: string } | null
    >(null);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) onRequestCompanions();
        wasOpenRef.current = isOpen;
    }, [isOpen, onRequestCompanions]);

    const sellableOf = (kind: ShopItemKind) =>
        SHOP_CATALOG.filter((entry) => {
            if (entry.kind !== kind) return false;
            const price = priceOf(entry, livePrices.get(entry.itemId));
            if (!price.enabled) return false;
            if (price.currency !== "tnj" && price.currency !== "usd") return false;
            return price.tnj > 0;
        });

    const priceTag = (entry: ShopCatalogEntry) => {
        const price = priceOf(entry, livePrices.get(entry.itemId));
        return (
            <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-[#4FD1FF]">
                    <Coins className="h-3.5 w-3.5" />
                    {price.tnj > 0 ? `${formatTnj(price.tnj)} TNJ` : "—"}
                </div>
            </div>
        );
    };

    const buyButton = (entry: ShopCatalogEntry, ownedCount: number) => {
        const price = priceOf(entry, livePrices.get(entry.itemId));
        if (price.tnj <= 0) return null;
        const owned =
            entry.maxOwned !== null && (justBought.has(entry.itemId) || ownedCount >= entry.maxOwned);
        return (
            <ShopBuyButton
                itemId={entry.itemId}
                gameSlug={gameSlug}
                owned={owned}
                onPurchased={(id) => {
                    setJustBought((prev) => new Set(prev).add(id));
                    onRequestCompanions();
                }}
            />
        );
    };

    const renderGenericList = (kind: ShopItemKind) => {
        const items = sellableOf(kind);
        if (items.length === 0) {
            return <div className="py-12 text-center text-sm text-[#6B7280]">{t("g.shop.nothingListed")}</div>;
        }

        return (
            <div className="space-y-2">
                {items.map((entry) => (
                    <div
                        key={entry.itemId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3"
                    >
                        <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[#E5E7EB]">{t(entry.nameKey)}</div>
                            <div className="text-xs text-[#8B8F98]">{t(entry.descriptionKey)}</div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                            {priceTag(entry)}
                            {buyButton(entry, placeables[entry.itemId] || 0)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const quantityOf = (id: CompanionId) =>
        companions.owned.find((entry) => entry.itemId === id)?.quantity ?? 0;

    const previewCompanion = (companionId: CompanionId) => {
        const companion = COMPANIONS_BY_ID.get(companionId);
        if (!companion) return;
        const rarity = RARITY_META[companion.rarity];
        setPreview({
            subject: { kind: "companion", companionId },
            title: t(companion.nameKey),
            subtitle: t(rarity.labelKey),
            accent: rarity.color,
        });
    };

    const previewCosmetic = (itemId: string) => {
        const cosmetic = COSMETICS_BY_ID.get(itemId as CosmeticId);
        if (!cosmetic) return;
        setPreview({
            subject: {
                kind: "character",
                skinId: cosmetic.slot === "skin" ? cosmetic.id : null,
                accessoryId: cosmetic.slot === "accessory" ? cosmetic.id : null,
            },
            title: t(cosmetic.name),
            accent: cosmetic.accent,
        });
    };

    const crateSummary = () => {
        const lowest = RARITY_META[RARITY_ORDER[0]];
        const highest = RARITY_META[RARITY_ORDER[RARITY_ORDER.length - 1]];
        return t("g.crate.summary", {
            count: COMPANIONS.length,
            from: t(lowest.labelKey),
            to: t(highest.labelKey),
        });
    };

    const renderPersonalization = () => {
        const items = SHOP_CATALOG.filter((entry) => {
            if (entry.kind !== "cosmetic") return false;
            return priceOf(entry, livePrices.get(entry.itemId)).enabled;
        });

        if (items.length === 0) {
            return <div className="py-12 text-center text-sm text-[#6B7280]">{t("g.shop.nothingListed")}</div>;
        }

        return (
            <div className="space-y-2">
                {items.map((entry) => {
                    const price = priceOf(entry, livePrices.get(entry.itemId));
                    const cosmetic = COSMETICS_BY_ID.get(entry.itemId as CosmeticId);
                    const forTnj = (price.currency === "tnj" || price.currency === "usd") && price.tnj > 0;

                    return (
                        <div
                            key={entry.itemId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3"
                        >
                            <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[#E5E7EB]">{t(entry.nameKey)}</div>
                                <div className="text-xs text-[#8B8F98]">{t(entry.descriptionKey)}</div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-3">
                                {cosmetic && (
                                    <button
                                        onClick={() => previewCosmetic(entry.itemId)}
                                        className="btn-secondary px-3 py-1.5 text-[11px]"
                                    >
                                        {t("g.cosmetic.tryOn")}
                                    </button>
                                )}
                                {forTnj ? (
                                    <>
                                        {priceTag(entry)}
                                        {buyButton(entry, placeables[entry.itemId] || 0)}
                                    </>
                                ) : (
                                    <span className="text-[11px] text-[#6B7280]">{t("g.shop.ashOnly")}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderLootboxes = () => {
        const items = sellableOf("lootbox");
        if (items.length === 0) {
            return <div className="py-12 text-center text-sm text-[#6B7280]">{t("g.shop.nothingListed")}</div>;
        }

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#FFD166]/25 bg-[rgba(255,209,102,0.07)] px-4 py-2.5 text-xs">
                    <span className="text-[#C9CDD3]">{t("g.crate.ownedLabel")}</span>
                    <div className="flex items-center gap-3">
                        <span className="font-black text-[#FFD166]">{companions.crates}</span>
                        <button
                            onClick={onOpenCrate}
                            disabled={companions.crates <= 0}
                            className="btn-primary px-3 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {t("g.crate.open")}
                        </button>
                    </div>
                </div>

                {items.map((entry) => (
                    <div
                        key={entry.itemId}
                        className="rounded-xl border border-[#FFD166]/25 bg-[rgba(255,209,102,0.05)] p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">📦</span>
                                    <span className="text-sm font-black text-[#E5E7EB]">{t(entry.nameKey)}</span>
                                </div>
                                <p className="mt-1.5 text-xs leading-snug text-[#8B8F98]">{t(entry.descriptionKey)}</p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-3">
                                {priceTag(entry)}
                                {buyButton(entry, companions.crates)}
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
                            <span className="text-[11px] text-[#8B8F98]">{crateSummary()}</span>
                            <button
                                onClick={() =>
                                    setExpandedCrate((prev) => (prev === entry.itemId ? null : entry.itemId))
                                }
                                className="btn-secondary flex-shrink-0 px-3 py-1 text-[11px]"
                            >
                                {expandedCrate === entry.itemId ? t("g.crate.hideDetails") : t("g.crate.details")}
                            </button>
                        </div>

                        {expandedCrate === entry.itemId && (
                            <div className="mt-3">
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                                    {t("g.crate.contents")}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {COMPANIONS.map((companion) => (
                                        <CompanionCard
                                            key={companion.id}
                                            companion={companion}
                                            quantity={quantityOf(companion.id)}
                                            showDropChance
                                            onPreview={() => previewCompanion(companion.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderCompanions = () => (
        <div className="space-y-3">
            <p className="text-xs leading-snug text-[#8B8F98]">{t("g.shop.companionsIntro")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
                {COMPANIONS.map((companion) => {
                    const entry = SHOP_CATALOG.find((item) => item.itemId === companion.id);
                    const price = entry ? priceOf(entry, livePrices.get(companion.id)) : null;
                    const forSale = !!entry && !!price && price.enabled && price.tnj > 0;

                    return (
                        <CompanionCard
                            key={companion.id}
                            companion={companion}
                            quantity={quantityOf(companion.id)}
                            equipped={companions.equipped === companion.id}
                            showDustValue
                            onPreview={() => previewCompanion(companion.id)}
                            footer={
                                forSale && entry ? (
                                    <div className="flex w-full items-center justify-between gap-2">
                                        {priceTag(entry)}
                                        {buyButton(entry, quantityOf(companion.id))}
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-[#6B7280]">{t("g.shop.crateOnly")}</span>
                                )
                            }
                        />
                    );
                })}
            </div>
        </div>
    );

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.shop.title")}
            icon={
                <Image
                    src="/icons/topmenu/shop-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            size="lg"
            tabs={[
                { id: "personalization", label: t("g.shop.tab.personalization"), icon: <Shirt className="h-3.5 w-3.5" /> },
                { id: "lootboxes", label: t("g.shop.tab.lootboxes"), icon: <Boxes className="h-3.5 w-3.5" /> },
                { id: "companions", label: t("g.shop.tab.companions"), icon: <PawPrint className="h-3.5 w-3.5" /> },
                { id: "weapons", label: t("g.shop.tab.weapons"), icon: <Swords className="h-3.5 w-3.5" /> },
                { id: "emotes", label: t("g.shop.tab.emotes"), icon: <Smile className="h-3.5 w-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as ShopTab)}
        >
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#FFD166]/25 bg-[rgba(255,209,102,0.08)] px-3 py-2.5 text-xs">
                <Store className="mt-px h-4 w-4 flex-shrink-0 text-[#FFD166]" />
                <span className="text-[#C9CDD3]">{t("g.shop.tnjOnly")}</span>
            </div>

            {activeTab === "companions" && renderCompanions()}
            {activeTab === "lootboxes" && renderLootboxes()}
            {activeTab === "personalization" && renderPersonalization()}
            {(activeTab === "weapons" || activeTab === "emotes") && renderGenericList(TAB_KINDS[activeTab])}

            <PreviewModal
                isOpen={!!preview}
                title={preview?.title ?? ""}
                subtitle={preview?.subtitle}
                accent={preview?.accent}
                subject={preview?.subject ?? null}
                onClose={() => setPreview(null)}
            />
        </WindowFrame>
    );
}
