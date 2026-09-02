// src/features/game/ui/AlaricPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { FactionSummary, QuestInfoData } from "../network/NetworkManager";
import { FactionCreateForm } from "./FactionCreateForm";
import { NpcQuestSection } from "./NpcQuestCard";
import { NpcPanelFrame } from "./shell/NpcPanelFrame";
import { useLanguage } from "@/core/i18n/LanguageContext";

type Stage = "already-founder" | "intro" | "responsibility" | "create" | "success";

const ACCENT = "#a855f7";

interface AlaricPanelProps {
    isOpen: boolean;
    quest: QuestInfoData | null;
    onAcceptQuest: (questId: string) => void;
    onTurnInQuest: (questId: string) => void;
    onClose: () => void;
    myFactions: FactionSummary[];
    skipIntro: boolean;
    gameSlug: string;
    onCreated: () => void;
}

export function AlaricPanel({ isOpen, quest, onAcceptQuest, onTurnInQuest, onClose, myFactions, skipIntro, gameSlug, onCreated }: AlaricPanelProps) {
    const { t } = useLanguage();
    const [stage, setStage] = useState<Stage>("intro");
    const [createdFactionName, setCreatedFactionName] = useState<string | null>(null);

    const existingFounded = myFactions.find((f) => f.role === "founder") ?? null;

    useEffect(() => {
        if (!isOpen) {
            setCreatedFactionName(null);
            return;
        }
        if (existingFounded) {
            setStage("already-founder");
        } else if (skipIntro) {
            setStage("create");
        } else {
            setStage("intro");
        }
    }, [isOpen]);

    return (
        <NpcPanelFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.npc.alaric")}
            accent={ACCENT}
            background="rgba(18,10,24,0.95)"
            icon={<Flag className="w-5 h-5" />}
        >
            <NpcQuestSection
                quest={quest}
                accent={ACCENT}
                onAccept={onAcceptQuest}
                onTurnIn={onTurnInQuest}
            />

            {stage === "already-founder" && (
                <div className="space-y-5">
                    <p className="text-[#8B8F98] text-sm">
                        {t("g.alaric.alreadyLead").split("{name}")[0]}
                        <span className="text-[#E5E7EB] font-bold">{existingFounded?.name}</span>
                        {t("g.alaric.alreadyLead").split("{name}")[1]}
                    </p>
                    <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm w-full game-tap">
                        {t("g.alaric.understood")}
                    </button>
                </div>
            )}

            {stage === "intro" && (
                <div className="space-y-5">
                    <p className="text-[#6B7280] text-sm">{t("g.alaric.thatLook")}</p>
                    <p className="text-[#E5E7EB] text-base font-bold">{t("g.alaric.wantToFound")}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setStage("responsibility")} className="btn-primary px-4 py-2 text-sm flex-1 game-tap">
                            {t("g.alaric.yes")}
                        </button>
                        <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1 game-tap">
                            {t("g.alaric.no")}
                        </button>
                    </div>
                </div>
            )}

            {stage === "responsibility" && (
                <div className="space-y-5">
                    <p className="text-[#8B8F98] text-sm">
                        {t("g.alaric.responsibility")}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={() => setStage("create")} className="btn-primary px-4 py-2 text-sm flex-1 game-tap">
                            {t("g.alaric.iUnderstand")}
                        </button>
                        <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm flex-1 game-tap">
                            {t("g.alaric.notNow")}
                        </button>
                    </div>
                </div>
            )}

            {stage === "create" && (
                <div className="space-y-3">
                    <FactionCreateForm
                        gameSlug={gameSlug}
                        onCreated={(name) => {
                            setCreatedFactionName(name);
                            onCreated();
                            setStage("success");
                        }}
                    />

                    <div className="mt-2 pt-3 border-t border-[rgba(255,255,255,0.08)] flex gap-2">
                        <span className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold bg-[#a855f7]/15 text-[#a855f7]">
                            <Flag className="w-3.5 h-3.5" />
                            {t("g.alaric.createFaction")}
                        </span>
                    </div>
                </div>
            )}

            {stage === "success" && (
                <div className="space-y-5">
                    <p className="text-[#8B8F98] text-sm">
                        {t("g.alaric.created").split("{name}")[0]}
                        <span className="text-[#E5E7EB] font-bold">{createdFactionName}</span>
                        {t("g.alaric.created").split("{name}")[1]}
                    </p>
                    <button onClick={onClose} className="btn-primary px-4 py-2 text-sm w-full game-tap">
                        {t("g.alaric.close")}
                    </button>
                </div>
            )}
        </NpcPanelFrame>
    );
}
