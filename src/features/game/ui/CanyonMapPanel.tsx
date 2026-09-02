// src/features/game/ui/CanyonMapPanel.tsx
"use client";

import { MapPinned, CheckCircle2, Lock, MapPin } from "lucide-react";
import { CanyonMapData, QuestInfoData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { CANYON_BIOMES } from "../world/locations/tower/floors/first-floor/utils/canyonBiomes";
import { NpcQuestSection } from "./NpcQuestCard";
import { NpcPanelFrame } from "./shell/NpcPanelFrame";

const ACCENT = "#4FD1FF";

interface CanyonMapPanelProps {
    isOpen: boolean;
    data: CanyonMapData | null;
    quest: QuestInfoData | null;
    onAcceptQuest: (questId: string) => void;
    onTurnInQuest: (questId: string) => void;
    onClose: () => void;
    onWarp: (segment: number) => void;
}

export function CanyonMapPanel({ isOpen, data, quest, onAcceptQuest, onTurnInQuest, onClose, onWarp }: CanyonMapPanelProps) {
    const { t } = useLanguage();
    const segmentName = (segment: number) =>
        segment <= CANYON_BIOMES.length
            ? t(`g.biome.${CANYON_BIOMES[segment - 1].key}`)
            : t("g.canyon.segmentOf", { name: t(`g.biome.${CANYON_BIOMES[CANYON_BIOMES.length - 1].key}`), segment });

    return (
        <NpcPanelFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.canyon.map")}
            accent={ACCENT}
            background="rgba(12,14,20,0.95)"
            icon={<MapPinned className="w-5 h-5" />}
        >
            <NpcQuestSection
                quest={quest}
                accent={ACCENT}
                onAccept={onAcceptQuest}
                onTurnIn={onTurnInQuest}
            />

            {!data ? (
                <div className="text-[#8B8F98] text-xs text-center py-10">{t("g.common.loading")}</div>
            ) : (
                <div className="space-y-2">
                    {Array.from({ length: data.maxSegmentReached }, (_, i) => i + 1).map((segment) => {
                        const cleared = data.clearedSegments.includes(segment);
                        const isCurrent = segment === data.segment;

                        return (
                            <button
                                key={segment}
                                onClick={() => onWarp(segment)}
                                className={`w-full flex items-center gap-3 p-3 rounded-[10px] border transition-all duration-150 text-left ${isCurrent
                                        ? "bg-[rgba(79,209,255,0.12)] border-[#4FD1FF]/50"
                                        : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(79,209,255,0.08)] hover:border-[#4FD1FF]/30"
                                    }`}
                            >
                                {cleared ? (
                                    <CheckCircle2 className="w-5 h-5 text-[#4ADE80] flex-shrink-0" />
                                ) : (
                                    <MapPin className="w-5 h-5 text-[#4FD1FF] flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-[#E5E7EB] font-bold text-sm truncate">{segmentName(segment)}</div>
                                    <div className="text-[#8B8F98] text-[10px]">
                                        {cleared ? t("g.canyon.clearedNoReward") : t("g.canyon.notCleared")}
                                    </div>
                                </div>
                                {isCurrent && (
                                    <span className="text-[10px] font-bold text-[#4FD1FF] flex-shrink-0">{t("g.canyon.here")}</span>
                                )}
                            </button>
                        );
                    })}

                    <div className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] opacity-50">
                        <Lock className="w-5 h-5 text-[#8B8F98] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[#8B8F98] font-bold text-sm truncate">
                                {segmentName(data.maxSegmentReached + 1)}
                            </div>
                            <div className="text-[#8B8F98] text-[10px]">{t("g.canyon.clearToUnlock")}</div>
                        </div>
                    </div>
                </div>
            )}
        </NpcPanelFrame>
    );
}
