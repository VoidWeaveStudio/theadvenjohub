// src/features/game/ui/FactionQuestsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Coins, ExternalLink, Gem, Megaphone, MessageSquare, Users } from "lucide-react";
import { FactionDetail, FactionQuestManageData } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";
import { SubTabs } from "./shell/SubTabs";
import { useLanguage } from "@/core/i18n/LanguageContext";

const X_POST_URL_PREFIX = "https://x.com/";
const MAX_SLOTS = 10_000;
const MAX_REWARD_ASH = 100_000;

interface FactionQuestsPanelProps {
    faction: FactionDetail;
    myWallet: string;
    ash: number;
    manageData: FactionQuestManageData | null;
    onRequestManageList: () => void;
    onCreateQuest: (targetUrl: string, slotsTotal: number, rewardAsh: number) => void;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
}

export function FactionQuestsPanel({
    faction,
    myWallet,
    ash,
    manageData,
    onRequestManageList,
    onCreateQuest,
}: FactionQuestsPanelProps) {
    const { t } = useLanguage();
    const [subTab, setSubTab] = useState<"new" | "created">("new");
    const [draftType, setDraftType] = useState<string | null>(null);
    const [targetUrl, setTargetUrl] = useState("");
    const [slots, setSlots] = useState("100");
    const [reward, setReward] = useState("10");

    const isVerifiedCreator = !!faction.verifiedCreatorWallet && faction.verifiedCreatorWallet === myWallet;
    const data = manageData && manageData.factionId === faction.id ? manageData : null;
    const listingFee = data?.listingFeeAsh ?? 1;
    const questTypes = data?.questTypes ?? [];

    useEffect(() => {
        onRequestManageList();
    }, [faction.id]);

    useEffect(() => {
        setDraftType(null);
        setTargetUrl("");
    }, [faction.id]);

    const slotsValue = Number.parseInt(slots, 10);
    const rewardValue = Number.parseInt(reward, 10);
    const slotsValid = Number.isInteger(slotsValue) && slotsValue >= 1 && slotsValue <= MAX_SLOTS;
    const rewardValid = Number.isInteger(rewardValue) && rewardValue >= 1 && rewardValue <= MAX_REWARD_ASH;
    const urlValid = targetUrl.trim().startsWith(X_POST_URL_PREFIX) && targetUrl.trim().length > X_POST_URL_PREFIX.length;
    const totalCost = slotsValid && rewardValid ? slotsValue * rewardValue + listingFee : 0;
    const affordable = totalCost > 0 && totalCost <= ash;
    const canSubmit = urlValid && slotsValid && rewardValid && affordable;

    if (!isVerifiedCreator) {
        return (
            <div className="space-y-4">
                <FactionHeader faction={faction} />
                <div className="bg-[rgba(192,132,252,0.06)] border border-[rgba(192,132,252,0.2)] rounded-lg p-6 text-center space-y-2">
                    <Megaphone className="w-6 h-6 text-[#C084FC] mx-auto" />
                    <p className="text-[#8B8F98] text-sm">
                        {t("g.fq.onlyVerifiedCreator")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <SubTabs
                tabs={[
                    { id: "new", label: t("g.fq.newQuest") },
                    { id: "created", label: t("g.fq.createdQuests"), badge: data?.quests.length || undefined },
                ]}
                active={subTab}
                onChange={(id) => setSubTab(id as "new" | "created")}
            />

            {subTab === "new" && !draftType && (
                <div className="space-y-2">
                    <p className="text-[#8B8F98] text-xs">
                        {t("g.fq.pickTypeHint")}
                    </p>
                    {questTypes.length === 0 ? (
                        <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.fq.loadingTypes")}</p>
                    ) : (
                        questTypes.map((type) => (
                            <button
                                key={type.key}
                                onClick={() => setDraftType(type.key)}
                                className="w-full flex items-center gap-3 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] rounded-lg p-3 text-left transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-[rgba(79,209,255,0.1)] flex items-center justify-center text-[#4FD1FF] flex-shrink-0">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[#E5E7EB] text-sm font-bold truncate">{type.label}</div>
                                    <div className="text-[#8B8F98] text-xs">{type.description}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            {subTab === "new" && draftType && (
                <div className="space-y-3">
                    <button
                        onClick={() => setDraftType(null)}
                        className="flex items-center gap-1.5 text-[#8B8F98] hover:text-[#E5E7EB] text-xs font-bold transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t("g.fq.backToTypes")}
                    </button>

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.fq.postLink")}</span>
                        <input
                            type="text"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value.slice(0, 512))}
                            placeholder={`${X_POST_URL_PREFIX}yourname/status/123...`}
                            className="mt-1 w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#4FD1FF]/50 outline-none font-mono"
                        />
                        {targetUrl.trim().length > 0 && !urlValid && (
                            <p className="text-red-400 text-xs mt-1">{t("g.fq.linkMustStart", { prefix: X_POST_URL_PREFIX })}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.fq.participants")}</span>
                            <input
                                type="number"
                                min={1}
                                max={MAX_SLOTS}
                                value={slots}
                                onChange={(e) => setSlots(e.target.value)}
                                className="mt-1 w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#4FD1FF]/50 outline-none"
                            />
                        </div>
                        <div>
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.fq.rewardAsh")}</span>
                            <input
                                type="number"
                                min={1}
                                max={MAX_REWARD_ASH}
                                value={reward}
                                onChange={(e) => setReward(e.target.value)}
                                className="mt-1 w-full bg-[rgba(255,255,255,0.04)] text-[#E5E7EB] px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-[#4FD1FF]/50 outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[#8B8F98]">{t("g.fq.rewardPool", { slots: slotsValid ? slotsValue : 0, reward: rewardValid ? rewardValue : 0 })}</span>
                            <span className="text-[#E5E7EB] font-bold">{t("g.ash.amount", { amount: slotsValid && rewardValid ? slotsValue * rewardValue : 0 })}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#8B8F98]">{t("g.fq.listingFee")}</span>
                            <span className="text-[#E5E7EB] font-bold">{t("g.ash.amount", { amount: listingFee })}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                            <span className="text-[#8B8F98]">{t("g.fq.totalToPay")}</span>
                            <span className="text-[#FFD166] font-bold">{t("g.ash.amount", { amount: totalCost })}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#8B8F98]">{t("g.fq.yourBalance")}</span>
                            <span className={affordable || totalCost === 0 ? "text-[#E5E7EB]" : "text-red-400"}>{t("g.ash.amount", { amount: ash })}</span>
                        </div>
                    </div>

                    <p className="text-[#6B7280] text-xs">
                        {t("g.fq.lockedNotice")}
                    </p>

                    <button
                        onClick={() => {
                            onCreateQuest(targetUrl.trim(), slotsValue, rewardValue);
                            setTargetUrl("");
                            setDraftType(null);
                            setSubTab("created");
                        }}
                        disabled={!canSubmit}
                        className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Coins className="w-4 h-4" />
                        {t("g.fq.payAndPublish", { amount: totalCost })}
                    </button>
                </div>
            )}

            {subTab === "created" && (
                <div className="space-y-2">
                    {!data ? (
                        <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.fq.loadingQuests")}</p>
                    ) : data.quests.length === 0 ? (
                        <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.fq.noQuests")}</p>
                    ) : (
                        data.quests.map((quest) => (
                            <div key={quest.id} className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <a
                                        href={quest.targetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[#4FD1FF] hover:text-[#7FDFFF] text-xs font-bold truncate"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">{quest.targetUrl}</span>
                                    </a>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${quest.status === "active"
                                            ? "bg-[rgba(74,222,128,0.15)] text-[#4ADE80]"
                                            : "bg-[rgba(255,255,255,0.08)] text-[#8B8F98]"
                                            }`}
                                    >
                                        {quest.status === "active" ? t("g.fq.active") : t("g.fq.finished")}
                                    </span>
                                </div>

                                <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                                    <div
                                        className="h-full bg-[#4FD1FF] transition-all"
                                        style={{ width: `${Math.min(100, (quest.slotsClaimed / quest.slotsTotal) * 100)}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98] flex items-center gap-1.5">
                                            <Users className="w-3 h-3" />
                                            {t("g.fq.rewarded")}
                                        </span>
                                        <span className="text-[#E5E7EB] font-bold">{quest.slotsClaimed} / {quest.slotsTotal}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98]">{t("g.fq.slotsLeft")}</span>
                                        <span className="text-[#E5E7EB] font-bold">{quest.slotsRemaining}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98] flex items-center gap-1.5">
                                            <Gem className="w-3 h-3" />
                                            {t("g.fq.bank")}
                                        </span>
                                        <span className="text-[#FFD166] font-bold">{t("g.ash.amount", { amount: quest.bankAsh })}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98]">{t("g.fq.paidOut")}</span>
                                        <span className="text-[#E5E7EB] font-bold">{t("g.ash.amount", { amount: quest.paidOutAsh })}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98]">{t("g.fq.bankLeft")}</span>
                                        <span className="text-[#E5E7EB] font-bold">{t("g.ash.amount", { amount: quest.bankRemainingAsh })}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8B8F98]">{t("g.fq.rewardEach")}</span>
                                        <span className="text-[#E5E7EB] font-bold">{t("g.ash.amount", { amount: quest.rewardAsh })}</span>
                                    </div>
                                </div>

                                <div className="text-[#6B7280] text-[11px]">{t("g.fq.published", { date: formatDate(quest.createdAt) })}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
