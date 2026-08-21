// src/features/game/ui/CompanionsTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Boxes, PawPrint, Puzzle } from "lucide-react";
import {
    COMPANIONS,
    FRAGMENTS_PER_CRATE,
    dustValueOf,
    type CompanionId,
} from "../data/companions";
import { CompanionStateData } from "../network/NetworkManager";
import { CompanionCard } from "./CompanionCard";
import { COMPANIONS_BY_ID, RARITY_META } from "../data/companions";
import { PreviewModal } from "./preview/PreviewModal";
import type { PreviewSubject } from "./preview/PreviewScene";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface CompanionsTabProps {
    companions: CompanionStateData;
    onRequestCompanions: () => void;
    onEquip: (companionId: CompanionId | null) => void;
    onDust: (itemId: CompanionId) => void;
    onCombine: () => void;
    onOpenCrate: () => void;
}

export function CompanionsTab({
    companions,
    onRequestCompanions,
    onEquip,
    onDust,
    onCombine,
    onOpenCrate,
}: CompanionsTabProps) {
    const { t } = useLanguage();
    const [preview, setPreview] = useState<
        { subject: PreviewSubject; title: string; subtitle: string; accent: string } | null
    >(null);

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

    useEffect(() => {
        onRequestCompanions();
    }, []);

    const quantities = new Map(companions.owned.map((entry) => [entry.itemId, entry.quantity]));
    const ownedCount = companions.owned.length;
    const canCombine = companions.fragments >= FRAGMENTS_PER_CRATE;
    const progress = Math.min(100, (companions.fragments / FRAGMENTS_PER_CRATE) * 100);

    return (
        <div className="space-y-5">
            <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-[#C084FC]/25 bg-[rgba(192,132,252,0.07)] p-3.5">
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#C084FC]">
                            <Puzzle className="h-3.5 w-3.5" />
                            {t("g.fragments.title")}
                        </span>
                        <span className="text-sm font-black text-[#E5E7EB]">
                            {companions.fragments} / {FRAGMENTS_PER_CRATE}
                        </span>
                    </div>

                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#C084FC] transition-[width] duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <p className="mb-2.5 text-[11px] leading-snug text-[#8B8F98]">
                        {t("g.fragments.hint", { count: FRAGMENTS_PER_CRATE })}
                    </p>

                    {canCombine ? (
                        <button onClick={onCombine} className="btn-primary w-full px-3 py-1.5 text-xs">
                            {t("g.fragments.combine")}
                        </button>
                    ) : (
                        <p className="text-[11px] text-[#6B7280]">
                            {t("g.fragments.needMore", { count: FRAGMENTS_PER_CRATE - companions.fragments })}
                        </p>
                    )}
                </div>

                <div className="rounded-xl border border-[#FFD166]/25 bg-[rgba(255,209,102,0.07)] p-3.5">
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#FFD166]">
                            <Boxes className="h-3.5 w-3.5" />
                            {t("g.crate.title")}
                        </span>
                        <span className="text-sm font-black text-[#E5E7EB]">{companions.crates}</span>
                    </div>

                    <p className="mb-2.5 text-[11px] leading-snug text-[#8B8F98]">{t("g.crate.hint")}</p>

                    <button
                        onClick={onOpenCrate}
                        disabled={companions.crates <= 0}
                        className="btn-primary w-full px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t("g.crate.open")}
                    </button>
                </div>
            </div>

            <div>
                <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#8B8F98]">
                        <PawPrint className="h-3.5 w-3.5" />
                        {t("g.companions.collection", { owned: ownedCount, total: COMPANIONS.length })}
                    </span>
                    {companions.equipped && (
                        <button
                            onClick={() => onEquip(null)}
                            className="text-xs font-bold text-[#8B8F98] transition-colors hover:text-[#E5E7EB]"
                        >
                            {t("g.companions.dismiss")}
                        </button>
                    )}
                </div>

                <p className="mb-3 text-[11px] leading-snug text-[#6B7280]">{t("g.companions.intro")}</p>

                <div className="grid gap-2 sm:grid-cols-2">
                    {COMPANIONS.map((companion) => {
                        const quantity = quantities.get(companion.id) ?? 0;
                        const equipped = companions.equipped === companion.id;
                        const canDust = quantity > 1;

                        return (
                            <CompanionCard
                                key={companion.id}
                                companion={companion}
                                quantity={quantity}
                                equipped={equipped}
                                showDustValue
                                onPreview={() => previewCompanion(companion.id)}
                                footer={
                                    quantity <= 0 ? (
                                        <span className="text-[11px] text-[#6B7280]">{t("g.companions.locked")}</span>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => onEquip(equipped ? null : companion.id)}
                                                className="btn-secondary px-3 py-1 text-[11px]"
                                            >
                                                {equipped ? t("g.companions.unequip") : t("g.companions.equip")}
                                            </button>
                                            {canDust && (
                                                <button
                                                    onClick={() => onDust(companion.id)}
                                                    className="btn-secondary px-3 py-1 text-[11px] text-[#C084FC]"
                                                >
                                                    {t("g.companions.dust", { amount: dustValueOf(companion.id) })}
                                                </button>
                                            )}
                                        </>
                                    )
                                }
                            />
                        );
                    })}
                </div>
            </div>

            <PreviewModal
                isOpen={!!preview}
                title={preview?.title ?? ""}
                subtitle={preview?.subtitle}
                accent={preview?.accent}
                subject={preview?.subject ?? null}
                onClose={() => setPreview(null)}
            />
        </div>
    );
}
