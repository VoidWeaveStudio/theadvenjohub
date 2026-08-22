// src/features/game/ui/SolaPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, ScrollText, Swords, Coins, Check, Circle, RotateCcw } from "lucide-react";
import { QuestInfoData, ProgressionStateData } from "../network/NetworkManager";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { NPC_DIALOGUES_BY_ID, type NpcId } from "../data/npcDialogues";

type SolaTab = "quests" | "tokenInfo" | "respec";

interface SolaPanelProps {
    isOpen: boolean;
    quest: QuestInfoData | null;
    progression?: ProgressionStateData | null;
    ash?: number;
    onClose: () => void;
    onAccept: (questId: string) => void;
    onTurnIn: (questId: string) => void;
    onRequestTokenInfo: (ca: string) => void;
    onRespec?: () => void;
}

export function SolaPanel({ isOpen, quest, progression = null, ash = 0, onClose, onAccept, onTurnIn, onRequestTokenInfo, onRespec }: SolaPanelProps) {
    const { t } = useLanguage();

    // The server sends English name/role for the orientation targets, but the
    // ids match our own catalogue, so prefer the translated entry.
    const npcLabel = (id: string, field: "name" | "role", fallback: string) => {
        const entry = NPC_DIALOGUES_BY_ID.get(id as NpcId);
        return entry ? t(entry[field]) : fallback;
    };
    const [tab, setTab] = useState<SolaTab>("quests");
    const [tokenCa, setTokenCa] = useState("");
    const [justSentCa, setJustSentCa] = useState(false);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRequestTokenInfo = () => {
        if (!tokenCa.trim()) return;
        onRequestTokenInfo(tokenCa.trim());
        setTokenCa("");
        setJustSentCa(true);
        setTimeout(() => setJustSentCa(false), 4000);
    };

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4">
            <div className="w-full max-w-md bg-[rgba(12,16,14,0.95)] border-2 border-[#4ADE80]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(74,222,128,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-[#4ADE80]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.npc.sola")}</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="min-h-[140px]">
                    {tab === "quests" ? (
                        !quest ? (
                            <div className="text-[#8B8F98] text-xs text-center py-10">{t("g.sola.loading")}</div>
                        ) : quest.status === "completed" ? (
                            <div className="text-[#8B8F98] text-sm text-center py-10">
                                {t("g.sola.noQuests")}
                            </div>
                        ) : (
                            <>
                                <h3 className="text-[#4ADE80] text-sm font-bold tracking-wide mb-2">{quest.title}</h3>
                                <p className="text-[#8B8F98] text-sm mb-4">{quest.description}</p>

                                <div className="flex items-center gap-1.5 text-[#FFD166] font-bold text-sm mb-5">
                                    <Sparkles className="w-4 h-4" />
                                    {t("g.sola.reward", { amount: quest.rewardAsh })}
                                    {quest.rewardXp ? <span className="text-[#7FE6CF]">+ {quest.rewardXp} XP</span> : null}
                                </div>

                                {quest.status === "not_started" && (
                                    <button
                                        onClick={() => onAccept(quest.questId)}
                                        className="w-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                                    >
                                        {t("g.sola.acceptQuest")}
                                    </button>
                                )}

                                {quest.status === "active" && quest.questType === "visit_npcs" && quest.targets && (
                                    <div className="space-y-1.5">
                                        {quest.targets.map((target) => {
                                            const done = (quest.visited ?? []).includes(target.id);
                                            return (
                                                <div
                                                    key={target.id}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border ${done
                                                        ? "border-[#4ADE80]/40 bg-[#4ADE80]/10"
                                                        : "border-white/10 bg-black/20"
                                                        }`}
                                                >
                                                    {done ? (
                                                        <Check className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />
                                                    ) : (
                                                        <Circle className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                                                    )}
                                                    <span className={`text-sm font-bold ${done ? "text-[#4ADE80]" : "text-[#E5E7EB]"}`}>
                                                        {npcLabel(target.id, "name", target.name)}
                                                    </span>
                                                    <span className="text-[#6B7280] text-[11px] ml-auto">{npcLabel(target.id, "role", target.role)}</span>
                                                </div>
                                            );
                                        })}
                                        <p className="text-[#8B8F98] text-xs pt-1">
                                            {t("g.sola.stewardsMet", { done: quest.progress, total: quest.targetCount })}
                                        </p>
                                    </div>
                                )}

                                {quest.status === "active" && quest.questType !== "visit_npcs" && (
                                    <div>
                                        <div className="flex items-center gap-2 text-[#E5E7EB] text-sm font-bold mb-2">
                                            <Swords className="w-4 h-4 text-[#4ADE80]" />
                                            {t("g.acct.progress", { done: quest.progress, total: quest.targetCount })}
                                        </div>
                                        <div className="w-full h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-3">
                                            <div
                                                className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                                                style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[#8B8F98] text-xs">{t("g.sola.comeBackCleared")}</p>
                                    </div>
                                )}

                                {quest.status === "ready_to_turn_in" && (
                                    <button
                                        onClick={() => onTurnIn(quest.questId)}
                                        className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                                    >
                                        {t("g.sola.claimAsh", { amount: quest.rewardAsh })}
                                    </button>
                                )}
                            </>
                        )
                    ) : tab === "respec" ? (
                        <div>
                            {!progression || progression.branch === null ? (
                                <p className="text-[#8B8F98] text-sm text-center py-10">
                                    {t("g.sola.noSpecialisation")}
                                </p>
                            ) : (
                                <>
                                    <p className="text-[#8B8F98] text-sm mb-4">
                                        {t("g.sola.respecIntro")}
                                    </p>
                                    <div className="flex items-center justify-between text-sm mb-4">
                                        <span className="text-[#8B8F98]">{t("g.sola.cost")}</span>
                                        <span className="text-[#FFD166] font-bold">
                                            {progression.respecCostAsh === 0 ? t("g.sola.free") : t("g.ash.amount", { amount: progression.respecCostAsh })}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onRespec?.()}
                                        disabled={ash < progression.respecCostAsh}
                                        className="w-full bg-gradient-to-r from-[#C79AE0] to-[#9F6FD0] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t("g.sola.resetSpecialisation")}
                                    </button>
                                    {ash < progression.respecCostAsh && (
                                        <p className="text-[#FF5757] text-xs mt-3 text-center">
                                            {t("g.sola.needMoreAsh", { amount: progression.respecCostAsh - ash })}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div>
                            <p className="text-[#8B8F98] text-sm mb-4">
                                {t("g.sola.tokenIntro")}
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={tokenCa}
                                    onChange={(e) => setTokenCa(e.target.value)}
                                    placeholder={t("g.gate.ca.placeholder")}
                                    className="flex-1 bg-black/40 text-white px-3 py-2 rounded text-sm border border-[#4ADE80]/30 focus:border-[#4ADE80] outline-none min-w-0"
                                />
                                <button
                                    onClick={handleRequestTokenInfo}
                                    disabled={!tokenCa.trim()}
                                    className="bg-gradient-to-r from-[#4ADE80] to-[#22c55e] text-[rgba(12,12,14,0.9)] font-bold px-4 py-2 rounded-[8px] text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {t("g.sola.send")}
                                </button>
                            </div>
                            {justSentCa && (
                                <p className="text-[#4ADE80] text-xs mt-3">
                                    {t("g.sola.gotIt")}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.08)] flex gap-2">
                    <button
                        onClick={() => setTab("quests")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${tab === "quests" ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "text-[#8B8F98] hover:text-[#E5E7EB]"
                            }`}
                    >
                        <ScrollText className="w-3.5 h-3.5" />
                        {t("g.sola.tabQuests")}
                    </button>
                    <button
                        onClick={() => setTab("tokenInfo")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${tab === "tokenInfo" ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "text-[#8B8F98] hover:text-[#E5E7EB]"
                            }`}
                    >
                        <Coins className="w-3.5 h-3.5" />
                        {t("g.sola.tabTokenInfo")}
                    </button>
                    <button
                        onClick={() => setTab("respec")}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${tab === "respec" ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "text-[#8B8F98] hover:text-[#E5E7EB]"
                            }`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t("g.sola.tabRespec")}
                    </button>
                </div>
            </div>
        </div>
    );
}
