// src/features/game/ui/hooks/useQuestState.ts
import { useCallback, useState } from "react";
import { QuestInfoData, QuestUpdateData } from "../../network/NetworkManager";

export const SOLA_NPC_ID = "sola";

export function useQuestState() {
  const [questInfo, setQuestInfo] = useState<QuestInfoData | null>(null);
  const [questTracker, setQuestTracker] = useState<(QuestUpdateData & { title: string; npc?: string }) | null>(null);

  const handleQuestInfo = useCallback((data: QuestInfoData) => {
    if (!data.questId || data.status === "none") {
      setQuestInfo(null);
      return;
    }

    setQuestInfo(data);
    if (data.status === "active" || data.status === "ready_to_turn_in" || data.status === "not_started") {
      setQuestTracker({
        questId: data.questId,
        status: data.status,
        progress: data.progress,
        targetCount: data.targetCount,
        visited: data.visited,
        title: data.title,
        npc: data.npc,
      });
    }
  }, []);

  const handleQuestUpdate = useCallback((data: QuestUpdateData) => {
    setQuestInfo((prev) =>
      prev && prev.questId === data.questId
        ? { ...prev, status: data.status, progress: data.progress, visited: data.visited ?? prev.visited }
        : prev
    );
    setQuestTracker((prev) => {
      if (data.status === "active" || data.status === "ready_to_turn_in") {
        return {
          questId: data.questId,
          status: data.status,
          progress: data.progress,
          targetCount: data.targetCount,
          visited: data.visited,
          title: prev && prev.questId === data.questId ? prev.title : "Sola's Task",
          npc: prev?.npc,
        };
      }
      return prev && prev.questId === data.questId ? null : prev;
    });
  }, []);

  const resetQuestInfo = useCallback(() => {
    setQuestInfo(null);
  }, []);

  return { questInfo, questTracker, handleQuestInfo, handleQuestUpdate, resetQuestInfo };
}
