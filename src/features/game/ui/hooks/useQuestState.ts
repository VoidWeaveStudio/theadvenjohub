// src/features/game/ui/hooks/useQuestState.ts
import { useCallback, useMemo, useState } from "react";
import { QuestInfoData, QuestUpdateData } from "../../network/NetworkManager";

export const SOLA_NPC_ID = "sola";

const MAX_TRACKED_QUESTS = 3;

// The server addresses quests by short npc key; the world addresses the same
// characters by interaction id. Panels look their quest up by the npc key.
export const QUEST_NPC_BY_INTERACTION: Record<string, string> = {
  "quest-giver-sola": SOLA_NPC_ID,
  "token-vendor": "tony",
  "npc-alfredo": "alfredo",
  "faction-broker": "alaric",
  "canyon-dispatcher": "dispatcher",
};

export const QUEST_INTERACTION_BY_NPC: Record<string, string> = Object.fromEntries(
  Object.entries(QUEST_NPC_BY_INTERACTION).map(([interactionId, npc]) => [npc, interactionId])
);

export function useQuestState() {
  const [questsByNpc, setQuestsByNpc] = useState<Record<string, QuestInfoData>>({});

  const handleQuestInfo = useCallback((data: QuestInfoData) => {
    if (!data.npc) return;

    setQuestsByNpc((prev) => {
      if (!data.questId || data.status === "none") {
        if (!prev[data.npc]) return prev;
        const next = { ...prev };
        delete next[data.npc];
        return next;
      }
      return { ...prev, [data.npc]: data };
    });
  }, []);

  const handleQuestUpdate = useCallback((data: QuestUpdateData) => {
    setQuestsByNpc((prev) => {
      const npc = Object.keys(prev).find((key) => prev[key].questId === data.questId);
      if (!npc) return prev;

      return {
        ...prev,
        [npc]: {
          ...prev[npc],
          status: data.status,
          progress: data.progress,
          visited: data.visited ?? prev[npc].visited,
        },
      };
    });
  }, []);

  const resetQuests = useCallback(() => {
    setQuestsByNpc({});
  }, []);

  const questForNpc = useCallback((npc: string) => questsByNpc[npc] ?? null, [questsByNpc]);

  // Only quests the player actually took are tracked on the HUD — an offered
  // quest is advertised by the marker over its giver, not by a card. Ones that
  // are ready to hand in come first, and the rail is capped so a full board
  // cannot bury a phone screen under cards.
  const trackedQuests = useMemo(
    () =>
      Object.values(questsByNpc)
        .filter((quest) => quest.status === "active" || quest.status === "ready_to_turn_in")
        .sort((a, b) => {
          const byStatus = Number(b.status === "ready_to_turn_in") - Number(a.status === "ready_to_turn_in");
          return byStatus !== 0 ? byStatus : a.questId.localeCompare(b.questId);
        })
        .slice(0, MAX_TRACKED_QUESTS),
    [questsByNpc]
  );

  return { questsByNpc, trackedQuests, questForNpc, handleQuestInfo, handleQuestUpdate, resetQuests };
}
