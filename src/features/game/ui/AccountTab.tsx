// src/features/game/ui/AccountTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ScrollText, Trophy } from "lucide-react";
import { SubTabs } from "./shell/SubTabs";
import { PlayerTag } from "./shell/PlayerTag";
import { PlayerProfileData, QuestInfoData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { Translate } from "@/core/i18n/types";

type AccountSubTab = "about" | "quests" | "achievements";

interface AccountTabProps {
    nickname: string;
    wallet: string;
    selfProfile: PlayerProfileData | null;
    onRequestSelfProfile: () => void;
    onNicknameChange: (nickname: string) => void;
    quest: QuestInfoData | null;
}

function formatPlaytime(seconds: number, t: Translate): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return t("g.time.hm", { hours, minutes });
    return t("g.time.m", { minutes });
}

export function AccountTab({ nickname, wallet, selfProfile, onRequestSelfProfile, onNicknameChange, quest }: AccountTabProps) {
    const { t } = useLanguage();
    const displayedFaction = selfProfile?.factions?.find((f) => f.isDisplayed) ?? selfProfile?.factions?.[0] ?? null;
    const isFactionCreator = !!selfProfile && selfProfile.factions.some((f) => f.verifiedCreatorWallet === wallet);
    const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>("about");
    const [editingNickname, setEditingNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState(nickname);
    const [walletCopied, setWalletCopied] = useState(false);

    useEffect(() => {
        if (accountSubTab === "about" || accountSubTab === "achievements") onRequestSelfProfile();
    }, [accountSubTab]);

    const handleSaveNickname = () => {
        if (tempNickname.trim().length > 0) {
            onNicknameChange(tempNickname.trim());
        }
        setEditingNickname(false);
    };

    const handleCopyWallet = () => {
        navigator.clipboard.writeText(wallet).then(() => {
            setWalletCopied(true);
            setTimeout(() => setWalletCopied(false), 1500);
        });
    };

    return (
        <div>
            <SubTabs
                tabs={[
                    { id: "about", label: t("g.acct.about") },
                    { id: "quests", label: t("g.acct.quests") },
                    { id: "achievements", label: t("g.acct.achievements") },
                ]}
                active={accountSubTab}
                onChange={(id) => setAccountSubTab(id as AccountSubTab)}
            />

            {accountSubTab === "about" && (
                <div className="space-y-6">
                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.acct.nickname")}</span>
                        <div className="mt-2 flex items-center gap-2">
                            {editingNickname ? (
                                <>
                                    <input
                                        type="text"
                                        value={tempNickname}
                                        onChange={(e) => setTempNickname(e.target.value.slice(0, 30))}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                                        autoFocus
                                        className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                                    />
                                    <button onClick={handleSaveNickname} className="btn-primary px-4 py-2 text-sm">
                                        {t("g.acct.save")}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <PlayerTag
                                        nickname={nickname}
                                        faction={displayedFaction}
                                        badge={
                                            displayedFaction?.verifiedCreatorWallet === wallet
                                                ? "creator"
                                                : displayedFaction?.founderWallet === wallet
                                                    ? "founder"
                                                    : null
                                        }
                                        isAdmin={selfProfile?.isAdmin}
                                        isFactionCreator={isFactionCreator}
                                    />
                                    <button
                                        onClick={() => {
                                            setTempNickname(nickname);
                                            setEditingNickname(true);
                                        }}
                                        className="text-[#4FD1FF] text-xs font-bold hover:underline"
                                    >
                                        {t("g.acct.edit")}
                                    </button>
                                </>
                            )}
                        </div>
                        {selfProfile?.factions && selfProfile.factions.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                {selfProfile.factions.map((f) => (
                                    <p key={f.id} className="text-[#4FD1FF] text-xs">
                                        {f.name} #{f.number}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.acct.wallet")}</span>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="text-[#E5E7EB] text-sm font-mono break-all">{wallet}</p>
                            <button
                                onClick={handleCopyWallet}
                                className="text-[#8B8F98] hover:text-[#4FD1FF] transition-colors flex-shrink-0"
                                title={t("g.acct.copyAddress")}
                            >
                                {walletCopied ? <Check className="w-4 h-4 text-[#4ADE80]" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.acct.stats")}</span>
                        {selfProfile ? (
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">{t("g.stat.kills")}</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{selfProfile.kills}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">{t("g.stat.deaths")}</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{selfProfile.deaths}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">{t("g.stat.ash")}</div>
                                    <div className="text-[#FFD166] text-lg font-bold">{selfProfile.ash}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">{t("g.stat.playtime")}</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{formatPlaytime(selfProfile.playtimeSeconds, t)}</div>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-2 text-[#8B8F98] text-sm">{t("g.acct.loading")}</p>
                        )}
                    </div>
                </div>
            )}

            {accountSubTab === "quests" && (
                <div className="space-y-3">
                    {!quest ? (
                        <div className="text-center py-10">
                            <ScrollText className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                            <p className="text-[#8B8F98] text-sm">{t("g.acct.noQuests")}</p>
                        </div>
                    ) : (
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[#E5E7EB] font-bold">{quest.title}</h3>
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${quest.status === "completed"
                                        ? "bg-[rgba(74,222,128,0.15)] text-[#4ADE80]"
                                        : quest.status === "ready_to_turn_in"
                                            ? "bg-[rgba(255,209,102,0.15)] text-[#FFD166]"
                                            : "bg-[rgba(79,209,255,0.15)] text-[#4FD1FF]"
                                        }`}
                                >
                                    {quest.status === "completed" ? t("g.acct.questCompleted") : quest.status === "ready_to_turn_in" ? t("g.acct.questReady") : t("g.acct.questActive")}
                                </span>
                            </div>
                            <p className="text-[#8B8F98] text-sm mb-3">{quest.description}</p>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[#E5E7EB]">
                                    {t("g.acct.progress", { done: quest.progress, total: quest.targetCount })}
                                </span>
                                <span className="text-[#FFD166] font-bold">{t("g.acct.rewardAsh", { amount: quest.rewardAsh })}</span>
                            </div>
                        </div>
                    )}
                    <p className="text-[#6B7280] text-xs text-center pt-2">{t("g.acct.factionQuestsSoon")}</p>
                </div>
            )}

            {accountSubTab === "achievements" && (
                <div className="space-y-2">
                    {!selfProfile ? (
                        <p className="text-[#8B8F98] text-sm text-center py-10">{t("g.acct.loading")}</p>
                    ) : selfProfile.achievements.length === 0 ? (
                        <div className="text-center py-10">
                            <Trophy className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                            <p className="text-[#8B8F98] text-sm">{t("g.acct.noAchievements")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {selfProfile.achievements.map((a) => (
                                <div
                                    key={a.key}
                                    title={a.description}
                                    className="bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.2)] rounded-lg px-3 py-2"
                                >
                                    <div className="flex items-center gap-1.5 text-[#FFD166] text-sm font-bold">
                                        <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                                        {a.label}
                                    </div>
                                    <div className="text-[#8B8F98] text-xs mt-0.5">{a.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
