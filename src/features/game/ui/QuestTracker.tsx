// src/features/game/ui/QuestTracker.tsx
import { Swords } from "lucide-react";
import { QuestUpdateData } from "../network/NetworkManager";

interface QuestTrackerProps {
    quest: (QuestUpdateData & { title: string }) | null;
}

export function QuestTracker({ quest }: QuestTrackerProps) {
    if (!quest || (quest.status !== "active" && quest.status !== "ready_to_turn_in")) return null;

    const ready = quest.status === "ready_to_turn_in";

    return (
        <div className="absolute top-24 right-6 pointer-events-none select-none font-oxanium">
            <div className="bg-[rgba(12,16,14,0.72)] backdrop-blur-md border border-[#4ADE80]/30 rounded-[10px] p-3 min-w-[220px]">
                <div className="flex items-center gap-2 mb-1.5">
                    <Swords className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span className="text-[#4ADE80] text-xs font-bold tracking-wide">{quest.title}</span>
                </div>
                {ready ? (
                    <div className="text-[#FFD166] text-xs font-bold">Return to Sola for your reward!</div>
                ) : (
                    <>
                        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-1">
                            <div
                                className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                                style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                            />
                        </div>
                        <div className="text-[#8B8F98] text-[11px]">{quest.progress}/{quest.targetCount} enemies</div>
                    </>
                )}
            </div>
        </div>
    );
}
