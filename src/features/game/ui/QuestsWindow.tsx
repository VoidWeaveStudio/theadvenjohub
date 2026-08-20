// src/features/game/ui/QuestsWindow.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Gem, Loader2, ScrollText, Users } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FactionQuestEntry } from "../network/NetworkManager";
import { useMarketCaps } from "./useMarketCaps";
import { formatMC } from "../utils/formatMC";
import { useLanguage } from "@/core/i18n/LanguageContext";

const VIEW_CONFIRM_SECONDS = 15;

interface QuestsWindowProps {
    isOpen: boolean;
    onClose: () => void;
    quests: FactionQuestEntry[];
    ash: number;
    onRequestQuests: () => void;
    onClaimQuest: (questId: string) => void;
}

function formatPrice(price?: string): string | null {
    if (!price) return null;
    const value = Number.parseFloat(price);
    if (!Number.isFinite(value)) return null;
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value >= 0.0001) return `$${value.toFixed(6)}`;
    return `$${value.toExponential(2)}`;
}

export function QuestsWindow({ isOpen, onClose, quests, ash, onRequestQuests, onClaimQuest }: QuestsWindowProps) {
    const { t } = useLanguage();
    const [openedAt, setOpenedAt] = useState<Record<string, number>>({});
    const [now, setNow] = useState(() => Date.now());

    const tokenAddresses = useMemo(
        () => quests.map((q) => q.factionTokenCa).filter((ca): ca is string => !!ca),
        [quests]
    );
    const tokenInfo = useMarketCaps(tokenAddresses, isOpen);

    useEffect(() => {
        if (!isOpen) return;
        onRequestQuests();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || Object.keys(openedAt).length === 0) return;
        const interval = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(interval);
    }, [isOpen, openedAt]);

    const openPost = (quest: FactionQuestEntry) => {
        window.open(quest.targetUrl, "_blank", "noopener,noreferrer");
        setOpenedAt((prev) => ({ ...prev, [quest.id]: Date.now() }));
        setNow(Date.now());
    };

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.menu.quests")}
            icon={<ScrollText className="w-7 h-7" />}
        >
            <div className="flex items-center justify-between mb-4">
                <p className="text-[#8B8F98] text-xs">
                    Paid quests published by factions. Complete one and the reward is paid straight from that faction&apos;s
                    quest bank.
                </p>
                <div className="flex items-center gap-1.5 text-[#FFD166] text-sm font-bold flex-shrink-0 ml-4">
                    <Gem className="w-4 h-4" />
                    {ash} Ash
                </div>
            </div>

            {quests.length === 0 ? (
                <p className="text-[#8B8F98] text-sm text-center py-10">{t("g.quest.noneLive")}</p>
            ) : (
                <div className="space-y-2">
                    {quests.map((quest) => {
                        const info = quest.factionTokenCa ? tokenInfo[quest.factionTokenCa] : undefined;
                        const price = formatPrice(info?.price);
                        const opened = openedAt[quest.id];
                        const elapsed = opened ? Math.floor((now - opened) / 1000) : 0;
                        const remainingSeconds = opened ? Math.max(0, VIEW_CONFIRM_SECONDS - elapsed) : VIEW_CONFIRM_SECONDS;
                        const soldOut = quest.slotsRemaining <= 0;

                        return (
                            <div key={quest.id} className="bg-[rgba(255,255,255,0.04)] border border-white/10 rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    {quest.factionImage ? (
                                        <img src={quest.factionImage} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0">
                                            <Users className="w-5 h-5 text-[#8B8F98]" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#E5E7EB] font-bold text-sm truncate">{quest.factionName}</span>
                                            {quest.factionSymbol && (
                                                <span className="text-[#8B8F98] text-xs flex-shrink-0">${quest.factionSymbol}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs mt-0.5">
                                            <span className="text-[#4FD1FF] font-bold">{price ?? "—"}</span>
                                            {info?.mc ? <span className="text-[#8B8F98]">MC {formatMC(info.mc)}</span> : null}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-[#FFD166] text-lg font-bold leading-none">+{quest.rewardAsh}</div>
                                        <div className="text-[#8B8F98] text-[11px]">{t("g.quest.ashReward")}</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-[#E5E7EB] font-bold">{t("g.quest.viewPost")}</span>
                                    <span className="text-[#8B8F98]">
                                        {quest.slotsClaimed} / {quest.slotsTotal} rewarded
                                    </span>
                                </div>

                                <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                                    <div
                                        className="h-full bg-[#4FD1FF] transition-all"
                                        style={{ width: `${Math.min(100, (quest.slotsClaimed / quest.slotsTotal) * 100)}%` }}
                                    />
                                </div>

                                {quest.completedByMe ? (
                                    <div className="flex items-center justify-center gap-2 text-[#4ADE80] text-xs font-bold py-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t("g.quests.rewardClaimed")}
                                    </div>
                                ) : quest.isOwnQuest ? (
                                    <div className="text-center text-[#8B8F98] text-xs py-2">
                                        {t("g.quests.ownQuest")}
                                    </div>
                                ) : soldOut ? (
                                    <div className="text-center text-[#8B8F98] text-xs py-2">{t("g.quest.slotsTaken")}</div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openPost(quest)}
                                            className="btn-secondary flex-1 px-3 py-2 text-xs flex items-center justify-center gap-1.5"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            {opened ? t("g.quest.openAgain") : t("g.quest.openPost")}
                                        </button>
                                        <button
                                            onClick={() => onClaimQuest(quest.id)}
                                            disabled={!opened || remainingSeconds > 0}
                                            className="btn-primary flex-1 px-3 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                        >
                                            {opened && remainingSeconds > 0 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            {!opened
                                                ? t("g.quest.openFirst")
                                                : remainingSeconds > 0
                                                    ? `Confirming... ${remainingSeconds}s`
                                                    : `Claim +${quest.rewardAsh} Ash`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </WindowFrame>
    );
}
