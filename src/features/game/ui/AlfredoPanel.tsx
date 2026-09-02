// src/features/game/ui/AlfredoPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Shirt, Gem, ArrowLeft, Boxes, Puzzle } from "lucide-react";
import { COSMETICS, COSMETIC_FRAGMENTS_PER_CRATE, CosmeticId } from "../data/cosmetics";
import { CosmeticCrateStateData, CosmeticStateData, QuestInfoData } from "../network/NetworkManager";
import { CosmeticCard } from "./CosmeticCard";
import { PreviewModal } from "./preview/PreviewModal";
import type { PreviewSubject } from "./preview/PreviewScene";
import { useShopPrices } from "./hooks/useShopPrices";
import { NpcQuestSection } from "./NpcQuestCard";
import { NpcPanelFrame } from "./shell/NpcPanelFrame";
import { useLanguage } from "@/core/i18n/LanguageContext";

const ACCENT = "#4FC3FF";

interface AlfredoPanelProps {
    isOpen: boolean;
    quest: QuestInfoData | null;
    onAcceptQuest: (questId: string) => void;
    onTurnInQuest: (questId: string) => void;
    onClose: () => void;
    onOpenPersonalization: () => void;
    gameSlug: string;
    ash: number;
    cosmetics: CosmeticStateData;
    onRequestCosmetics: () => void;
    onBuyCosmetic: (itemId: CosmeticId) => void;
    crateWallet: CosmeticCrateStateData;
    onRequestCrates: () => void;
    onCombineFragments: () => void;
    onOpenCrate: () => void;
}

export function AlfredoPanel({
    isOpen,
    quest,
    onAcceptQuest,
    onTurnInQuest,
    onClose,
    onOpenPersonalization,
    gameSlug,
    ash,
    cosmetics,
    onRequestCosmetics,
    onBuyCosmetic,
    crateWallet,
    onRequestCrates,
    onCombineFragments,
    onOpenCrate,
}: AlfredoPanelProps) {
    const { t } = useLanguage();
    const [preview, setPreview] = useState<
        { subject: PreviewSubject; title: string; accent: string } | null
    >(null);
    const [view, setView] = useState<"menu" | "wardrobe">("menu");
    const { prices: livePrices } = useShopPrices(gameSlug, isOpen);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) setView("menu");
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (view === "wardrobe") {
            onRequestCosmetics();
            onRequestCrates();
        }
    }, [view]);

    const owned = new Set(cosmetics.owned);
    const canCombine = crateWallet.fragments >= COSMETIC_FRAGMENTS_PER_CRATE;
    const collectionComplete = owned.size >= COSMETICS.length;

    const crateBlock = (
        <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#4FC3FF]/25 bg-[rgba(79,195,255,0.07)] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#4FC3FF]">
                        <Puzzle className="h-3.5 w-3.5" />
                        {t("g.skinCrate.fragments")}
                    </span>
                    <span className="text-sm font-black text-[#E5E7EB]">{crateWallet.fragments}</span>
                </div>

                {canCombine ? (
                    <button onClick={onCombineFragments} className="btn-primary w-full px-3 py-1.5 text-[11px]">
                        {t("g.skinCrate.combine")}
                    </button>
                ) : (
                    <p className="text-[10px] leading-snug text-[#6B7280]">
                        {t("g.skinCrate.needMore", { count: COSMETIC_FRAGMENTS_PER_CRATE - crateWallet.fragments })}
                    </p>
                )}
            </div>

            <div className="rounded-xl border border-[#FFD166]/25 bg-[rgba(255,209,102,0.07)] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#FFD166]">
                        <Boxes className="h-3.5 w-3.5" />
                        {t("g.skinCrate.title")}
                    </span>
                    <span className="text-sm font-black text-[#E5E7EB]">{crateWallet.crates}</span>
                </div>

                <button
                    onClick={onOpenCrate}
                    disabled={crateWallet.crates <= 0 || collectionComplete}
                    className="btn-primary w-full px-3 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {collectionComplete ? t("g.skinCrate.complete") : t("g.skinCrate.open")}
                </button>
            </div>
        </div>
    );

    return (
        <>
            <NpcPanelFrame
                isOpen={isOpen}
                onClose={onClose}
                title={t("g.npc.alfredo")}
                accent={ACCENT}
                background="rgba(10,16,20,0.95)"
                size="lg"
                icon={<Palette className="w-5 h-5" />}
                headerExtra={
                    <span className="flex items-center gap-1.5 text-[#FFD166] text-sm font-bold">
                        <Gem className="w-4 h-4" />
                        {ash}
                    </span>
                }
            >
                {view === "menu" && (
                    <>
                        <p className="text-[#8B8F98] text-sm mb-5">{t("g.alfredo.greeting")}</p>

                        <NpcQuestSection
                            quest={quest}
                            accent={ACCENT}
                            onAccept={onAcceptQuest}
                            onTurnIn={onTurnInQuest}
                        />

                        <div className="space-y-3">
                            <button
                                onClick={onOpenPersonalization}
                                className="w-full flex items-center gap-3 bg-[rgba(79,195,255,0.08)] hover:bg-[rgba(79,195,255,0.16)] border border-[#4FC3FF]/30 rounded-[10px] px-4 py-3.5 text-left transition-all"
                            >
                                <Palette className="w-6 h-6 text-[#4FC3FF] flex-shrink-0" />
                                <div>
                                    <div className="text-[#E5E7EB] font-bold text-sm">{t("g.alfredo.personalization")}</div>
                                    <div className="text-[#8B8F98] text-xs">{t("g.alfredo.personalizationHint")}</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setView("wardrobe")}
                                className="w-full flex items-center gap-3 bg-[rgba(79,195,255,0.08)] hover:bg-[rgba(79,195,255,0.16)] border border-[#4FC3FF]/30 rounded-[10px] px-4 py-3.5 text-left transition-all"
                            >
                                <Shirt className="w-6 h-6 text-[#4FC3FF] flex-shrink-0" />
                                <div>
                                    <div className="text-[#E5E7EB] font-bold text-sm">{t("g.alfredo.wardrobe")}</div>
                                    <div className="text-[#8B8F98] text-xs">{t("g.alfredo.wardrobeHint")}</div>
                                </div>
                            </button>
                        </div>
                    </>
                )}

                {view === "wardrobe" && (
                    <>
                        <button
                            onClick={() => setView("menu")}
                            className="flex items-center gap-1.5 text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold mb-3 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {t("g.alfredo.back")}
                        </button>

                        <p className="text-[#8B8F98] text-xs mb-3">
                            {t("g.alfredo.ownedForever")}
                        </p>

                        {crateBlock}

                        <div className="space-y-2">
                            {COSMETICS.map((definition) => {
                                const live = livePrices.get(definition.id);
                                if (live && live.enabled === false) return null;
                                const tnjOnly = !!live && live.currency !== "ash";
                                const cosmetic = {
                                    ...definition,
                                    priceAsh: live && live.currency === "ash" ? live.priceAsh : definition.priceAsh,
                                };
                                const isOwned = owned.has(cosmetic.id);
                                const tooPoor = !isOwned && !tnjOnly && ash < cosmetic.priceAsh;
                                return (
                                    <CosmeticCard
                                        key={cosmetic.id}
                                        cosmetic={cosmetic}
                                        owned={isOwned}
                                        equipped={false}
                                        blocked={!isOwned && (tnjOnly || tooPoor)}
                                        blockedReason={tooPoor ? t("g.alfredo.notEnoughAsh") : undefined}
                                        priceLabel={
                                            !isOwned && tnjOnly
                                                ? <span className="text-[11px] text-[#6B7280]">{t("g.alfredo.tnjOnly")}</span>
                                                : undefined
                                        }
                                        actionLabel={isOwned ? t("g.alfredo.owned") : t("g.alfredo.buy")}
                                        onPreview={() =>
                                            setPreview({
                                                subject: {
                                                    kind: "character",
                                                    skinId: cosmetic.slot === "skin" ? cosmetic.id : null,
                                                    accessoryId: cosmetic.slot === "accessory" ? cosmetic.id : null,
                                                },
                                                title: t(cosmetic.name),
                                                accent: cosmetic.accent,
                                            })
                                        }
                                        onAction={() => {
                                            if (!isOwned && !tnjOnly) onBuyCosmetic(cosmetic.id);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </NpcPanelFrame>

            <PreviewModal
                isOpen={!!preview}
                title={preview?.title ?? ""}
                accent={preview?.accent}
                subject={preview?.subject ?? null}
                onClose={() => setPreview(null)}
            />
        </>
    );
}
