// src/features/game/ui/hooks/useFactionQuestState.ts
import { useCallback, useState } from "react";
import { FactionQuestEntry, FactionQuestManageData, FactionQuestManaged } from "../../network/NetworkManager";

export function useFactionQuestState() {
    const [questBoard, setQuestBoard] = useState<FactionQuestEntry[]>([]);
    const [manageData, setManageData] = useState<FactionQuestManageData | null>(null);

    const handleFactionQuestListResult = useCallback((quests: FactionQuestEntry[]) => {
        setQuestBoard(quests);
    }, []);

    const handleFactionQuestManageListResult = useCallback((data: FactionQuestManageData) => {
        setManageData(data);
    }, []);

    const handleFactionQuestCreated = useCallback((data: { quest: FactionQuestManaged & { factionId: string } }) => {
        setManageData((prev) => {
            if (!prev || prev.factionId !== data.quest.factionId) return prev;
            return { ...prev, quests: [data.quest, ...prev.quests] };
        });
    }, []);

    const handleFactionQuestClaimed = useCallback((data: { questId: string; slotsClaimed: number; status: string }) => {
        setQuestBoard((prev) =>
            prev.flatMap((q) => {
                if (q.id !== data.questId) return [q];
                if (data.status !== "active") return [];
                return [{
                    ...q,
                    completedByMe: true,
                    slotsClaimed: data.slotsClaimed,
                    slotsRemaining: Math.max(0, q.slotsTotal - data.slotsClaimed),
                }];
            })
        );
    }, []);

    return {
        questBoard,
        manageData,
        handleFactionQuestListResult,
        handleFactionQuestManageListResult,
        handleFactionQuestCreated,
        handleFactionQuestClaimed,
    };
}
