// src/features/game/ui/QuestTracker.tsx
import { Swords } from "lucide-react";
import { QuestInfoData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { questGiverName, questTitle, questUnitLabel } from "./questText";

interface QuestTrackerProps {
    quests: QuestInfoData[];
}

export function QuestTracker({ quests }: QuestTrackerProps) {
    const { t } = useLanguage();
    if (quests.length === 0) return null;

    return (
        <div className="pointer-events-none select-none font-oxanium space-y-2">
            {quests.map((quest) => {
                const ready = quest.status === "ready_to_turn_in";
                const accent = ready ? "#FFD166" : "#4ADE80";

                return (
                    <div
                        key={quest.questId}
                        className="bg-[rgba(12,16,14,0.72)] backdrop-blur-md border rounded-[10px] p-3 min-w-[220px]"
                        style={{ borderColor: `${accent}4d` }}
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <Swords className="w-3.5 h-3.5" style={{ color: accent }} />
                            <span className="text-xs font-bold tracking-wide" style={{ color: accent }}>
                                {questTitle(quest, t)}
                            </span>
                        </div>
                        {ready ? (
                            <div className="text-[#FFD166] text-xs font-bold">
                                {t("g.quest.returnTo", { giver: questGiverName(quest.npc, t) })}
                            </div>
                        ) : (
                            <>
                                <div className="w-full h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-1">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                                        style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-[#8B8F98] text-[11px]">
                                    {quest.progress}/{quest.targetCount} {questUnitLabel(quest.questType, t)}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
