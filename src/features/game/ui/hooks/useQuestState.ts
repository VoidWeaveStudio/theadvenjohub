// src/features/game/ui/hooks/useQuestState.ts
import { useCallback, useState } from "react";
import { QuestInfoData, QuestUpdateData } from "../../network/NetworkManager";

export const SOLA_QUEST_ID = "sola_kill_10";

export function useQuestState() {
  const [questInfo, setQuestInfo] = useState<QuestInfoData | null>(null);
  const [questTracker, setQuestTracker] = useState<(QuestUpdateData & { title: string }) | null>(null);

  const handleQuestInfo = useCallback((data: QuestInfoData) => {
    setQuestInfo(data);
    if (data.status === "active" || data.status === "ready_to_turn_in") {
      setQuestTracker({
        questId: data.questId,
        status: data.status,
        progress: data.progress,
        targetCount: data.targetCount,
        title: data.title,
      });
    }
  }, []);

  const handleQuestUpdate = useCallback((data: QuestUpdateData) => {
    setQuestInfo((prev) =>
      prev && prev.questId === data.questId
        ? { ...prev, status: data.status, progress: data.progress }
        : prev
    );
    setQuestTracker((prev) => {
      if (data.status === "active" || data.status === "ready_to_turn_in") {
        return {
          questId: data.questId,
          status: data.status,
          progress: data.progress,
          targetCount: data.targetCount,
          title: prev && prev.questId === data.questId ? prev.title : "Sola's Task",
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
