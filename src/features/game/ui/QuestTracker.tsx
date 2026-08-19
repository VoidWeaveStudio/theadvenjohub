// src/features/game/ui/QuestTracker.tsx
import { Swords } from "lucide-react";
import { QuestUpdateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface QuestTrackerProps {
    quest: (QuestUpdateData & { title: string; npc?: string }) | null;
}

const QUEST_GIVERS: Record<string, string> = {
    sola: "g.quest.solaWhere",
};

export function QuestTracker({ quest }: QuestTrackerProps) {
    const { t } = useLanguage();
    if (!quest) return null;

    if (quest.status === "not_started") {
        const giverKey = QUEST_GIVERS[quest.npc ?? ""] ?? "g.quest.someGiver";
        return (
            <div className="pointer-events-none select-none font-oxanium">
                <div className="bg-[rgba(12,16,14,0.72)] backdrop-blur-md border border-[#FFD166]/40 rounded-[10px] p-3 min-w-[220px]">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Swords className="w-3.5 h-3.5 text-[#FFD166]" />
                        <span className="text-[#FFD166] text-xs font-bold tracking-wide">{quest.title}</span>
                    </div>
                    <div className="text-[#E5E7EB] text-[11px]">{t("g.quest.talkTo", { giver: t(giverKey) })}</div>
                </div>
            </div>
        );
    }

    if (quest.status !== "active" && quest.status !== "ready_to_turn_in") return null;

    const ready = quest.status === "ready_to_turn_in";

    return (
        <div className="pointer-events-none select-none font-oxanium">
            <div className="bg-[rgba(12,16,14,0.72)] backdrop-blur-md border border-[#4ADE80]/30 rounded-[10px] p-3 min-w-[220px]">
                <div className="flex items-center gap-2 mb-1.5">
                    <Swords className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span className="text-[#4ADE80] text-xs font-bold tracking-wide">{quest.title}</span>
                </div>
                {ready ? (
                    <div className="text-[#FFD166] text-xs font-bold">{t("g.quest.returnToSola")}</div>
                ) : (
                    <>
                        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-1">
                            <div
                                className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                                style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                            />
                        </div>
                        <div className="text-[#8B8F98] text-[11px]">
                            {quest.progress}/{quest.targetCount} {quest.visited ? t("g.quest.stewardsMet") : t("g.quest.enemies")}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
