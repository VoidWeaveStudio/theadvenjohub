// src/features/game/ui/NpcQuestCard.tsx
"use client";

import { Check, Circle, ScrollText, Sparkles, Swords } from "lucide-react";
import { QuestInfoData } from "../network/NetworkManager";
import { NPC_DIALOGUES_BY_ID, type NpcId } from "../data/npcDialogues";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { questDescription, questGiverName, questRewardLabel, questTitle, questUnitLabel } from "./questText";

interface NpcQuestCardProps {
    quest: QuestInfoData | null;
    accent: string;
    onAccept: (questId: string) => void;
    onTurnIn: (questId: string) => void;
    emptyLabel?: string;
}

export function NpcQuestCard({ quest, accent, onAccept, onTurnIn, emptyLabel }: NpcQuestCardProps) {
    const { t } = useLanguage();

    // The server sends English name/role for the orientation targets, but the
    // ids match our own catalogue, so prefer the translated entry.
    const npcLabel = (id: string, field: "name" | "role", fallback: string) => {
        const entry = NPC_DIALOGUES_BY_ID.get(id as NpcId);
        return entry ? t(entry[field]) : fallback;
    };

    if (!quest || quest.status === "completed") {
        if (!emptyLabel) return null;
        return <div className="text-[#8B8F98] text-sm text-center py-6">{emptyLabel}</div>;
    }

    const rewardLabel = questRewardLabel(quest, t);

    return (
        <div>
            <h3 className="text-sm font-bold tracking-wide mb-2" style={{ color: accent }}>
                {questTitle(quest, t)}
            </h3>
            <p className="text-[#8B8F98] text-sm mb-4">{questDescription(quest, t)}</p>

            {(rewardLabel || quest.rewardXp) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[#FFD166] font-bold text-sm mb-5">
                    <Sparkles className="w-4 h-4" />
                    {rewardLabel ?? t("g.quest.rewardNone")}
                    {quest.rewardXp ? <span className="text-[#7FE6CF]">+ {quest.rewardXp} XP</span> : null}
                </div>
            )}

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
                        <Swords className="w-4 h-4" style={{ color: accent }} />
                        {t("g.acct.progress", { done: quest.progress, total: quest.targetCount })}
                        <span className="text-[#8B8F98] font-normal text-xs">{questUnitLabel(quest.questType, t)}</span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                        />
                    </div>
                    <p className="text-[#8B8F98] text-xs">
                        {t("g.quest.comeBackWhenDone", { giver: questGiverName(quest.npc, t) })}
                    </p>
                </div>
            )}

            {quest.status === "ready_to_turn_in" && (
                <button
                    onClick={() => onTurnIn(quest.questId)}
                    className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                >
                    {quest.rewardAsh > 0
                        ? t("g.sola.claimAsh", { amount: quest.rewardAsh })
                        : t("g.quest.claimReward")}
                </button>
            )}
        </div>
    );
}

interface NpcQuestSectionProps {
    quest: QuestInfoData | null;
    accent: string;
    onAccept: (questId: string) => void;
    onTurnIn: (questId: string) => void;
}

// Quest block for the NPCs whose panel is built around something else (a shop,
// a map, a wardrobe). Collapses to nothing when that NPC has nothing to offer.
export function NpcQuestSection({ quest, accent, onAccept, onTurnIn }: NpcQuestSectionProps) {
    const { t } = useLanguage();
    if (!quest || quest.status === "completed") return null;

    return (
        <div
            className="mb-4 flex-shrink-0 rounded-xl border p-4"
            style={{ borderColor: `${accent}40`, background: `${accent}0f` }}
        >
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color: accent }}>
                <ScrollText className="h-3.5 w-3.5" />
                {t("g.quest.sectionTitle")}
            </div>
            <NpcQuestCard quest={quest} accent={accent} onAccept={onAccept} onTurnIn={onTurnIn} />
        </div>
    );
}
