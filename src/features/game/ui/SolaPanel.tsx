// src/features/game/ui/SolaPanel.tsx
"use client";

import { useState } from "react";
import { ScrollText, Coins, RotateCcw } from "lucide-react";
import { QuestInfoData, ProgressionStateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { NpcQuestCard } from "./NpcQuestCard";
import { NpcPanelFrame } from "./shell/NpcPanelFrame";

type SolaTab = "quests" | "tokenInfo" | "respec";

const ACCENT = "#4ADE80";

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
    const [tab, setTab] = useState<SolaTab>("quests");
    const [tokenCa, setTokenCa] = useState("");
    const [justSentCa, setJustSentCa] = useState(false);

    const handleRequestTokenInfo = () => {
        if (!tokenCa.trim()) return;
        onRequestTokenInfo(tokenCa.trim());
        setTokenCa("");
        setJustSentCa(true);
        setTimeout(() => setJustSentCa(false), 4000);
    };

    const tabButton = (id: SolaTab, label: string, icon: React.ReactNode, grow: boolean) => (
        <button
            onClick={() => setTab(id)}
            className={`${grow ? "flex-1" : ""} flex items-center justify-center gap-1.5 game-tap px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${tab === id ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "text-[#8B8F98] hover:text-[#E5E7EB]"
                }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <NpcPanelFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.npc.sola")}
            accent={ACCENT}
            background="rgba(12,16,14,0.95)"
            icon={<ScrollText className="w-5 h-5" />}
            footer={
                <div className="flex gap-2">
                    {tabButton("quests", t("g.sola.tabQuests"), <ScrollText className="w-3.5 h-3.5" />, true)}
                    {tabButton("tokenInfo", t("g.sola.tabTokenInfo"), <Coins className="w-3.5 h-3.5" />, true)}
                    {tabButton("respec", t("g.sola.tabRespec"), <RotateCcw className="w-3.5 h-3.5" />, false)}
                </div>
            }
        >
            {tab === "quests" ? (
                !quest ? (
                    <div className="text-[#8B8F98] text-xs text-center py-10">{t("g.sola.loading")}</div>
                ) : (
                    <NpcQuestCard
                        quest={quest}
                        accent={ACCENT}
                        onAccept={onAccept}
                        onTurnIn={onTurnIn}
                        emptyLabel={t("g.sola.noQuests")}
                    />
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
                                className="w-full bg-gradient-to-r from-[#C79AE0] to-[#9F6FD0] text-[rgba(12,12,14,0.9)] font-bold game-tap px-6 py-2.5 rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </NpcPanelFrame>
    );
}
