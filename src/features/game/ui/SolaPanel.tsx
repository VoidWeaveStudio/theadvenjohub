// src/features/game/ui/SolaPanel.tsx
"use client";

import { X, Sparkles, ScrollText, Swords, CheckCircle2 } from "lucide-react";
import { QuestInfoData } from "../network/NetworkManager";

interface SolaPanelProps {
    isOpen: boolean;
    quest: QuestInfoData | null;
    onClose: () => void;
    onAccept: (questId: string) => void;
    onTurnIn: (questId: string) => void;
}

export function SolaPanel({ isOpen, quest, onClose, onAccept, onTurnIn }: SolaPanelProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-md bg-[rgba(12,16,14,0.95)] border-2 border-[#4ADE80]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(74,222,128,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-[#4ADE80]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Sola</h2>
                    </div>
                    <button onClick={onClose} className="text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!quest ? (
                    <div className="text-[#8B8F98] text-xs text-center py-10">Loading...</div>
                ) : (
                    <>
                        <h3 className="text-[#4ADE80] text-sm font-bold tracking-wide mb-2">{quest.title}</h3>
                        <p className="text-[#8B8F98] text-sm mb-4">{quest.description}</p>

                        <div className="flex items-center gap-1.5 text-[#FFD166] font-bold text-sm mb-5">
                            <Sparkles className="w-4 h-4" />
                            Reward: {quest.rewardAsh} Ash
                        </div>

                        {quest.status === "not_started" && (
                            <button
                                onClick={() => onAccept(quest.questId)}
                                className="w-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                            >
                                Accept Quest
                            </button>
                        )}

                        {quest.status === "active" && (
                            <div>
                                <div className="flex items-center gap-2 text-[#E5E7EB] text-sm font-bold mb-2">
                                    <Swords className="w-4 h-4 text-[#4ADE80]" />
                                    Progress: {quest.progress}/{quest.targetCount}
                                </div>
                                <div className="w-full h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden mb-3">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#4ADE80] to-[#22c55e] transition-all duration-300 ease-out"
                                        style={{ width: `${Math.min(100, (quest.progress / quest.targetCount) * 100)}%` }}
                                    />
                                </div>
                                <p className="text-[#8B8F98] text-xs">Come back once you've cleared them out in the Main World.</p>
                            </div>
                        )}

                        {quest.status === "ready_to_turn_in" && (
                            <button
                                onClick={() => onTurnIn(quest.questId)}
                                className="w-full bg-gradient-to-r from-[#FFD166] to-[#FFB347] text-[rgba(12,12,14,0.9)] font-bold px-6 py-2.5 rounded-[8px] transition-all"
                            >
                                Claim {quest.rewardAsh} Ash
                            </button>
                        )}

                        {quest.status === "completed" && (
                            <div className="flex items-center gap-2 text-[#4ADE80] text-sm font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Quest complete. Thanks for your help!
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
