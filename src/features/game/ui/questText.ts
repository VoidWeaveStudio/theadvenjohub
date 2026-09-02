// src/features/game/ui/questText.ts
import { QuestInfoData, QuestType } from "../network/NetworkManager";
import { NPC_DIALOGUES_BY_ID, type NpcId } from "../data/npcDialogues";
import { QUEST_INTERACTION_BY_NPC } from "./hooks/useQuestState";
import type { Translate } from "@/core/i18n/types";

const UNIT_KEY_BY_TYPE: Record<QuestType, string> = {
  visit_npcs: "g.quest.stewardsMet",
  kill_enemies: "g.quest.enemies",
  sell_tokens: "g.quest.coinsSold",
  canyon_segments: "g.quest.segmentsCleared",
  paint_skin: "g.quest.skinsPainted",
  found_faction: "g.quest.factionsFounded",
};

export function questTitle(quest: { title: string; titleKey?: string | null }, t: Translate): string {
  return quest.titleKey ? t(quest.titleKey) : quest.title;
}

export function questDescription(
  quest: { description: string; descriptionKey?: string | null },
  t: Translate
): string {
  return quest.descriptionKey ? t(quest.descriptionKey) : quest.description;
}

export function questUnitLabel(questType: QuestType | undefined, t: Translate): string {
  return t(UNIT_KEY_BY_TYPE[questType ?? "kill_enemies"] ?? "g.quest.enemies");
}

export function questGiverName(npc: string, t: Translate): string {
  const interactionId = QUEST_INTERACTION_BY_NPC[npc];
  const entry = interactionId ? NPC_DIALOGUES_BY_ID.get(interactionId as NpcId) : undefined;
  return entry ? t(entry.name) : t("g.quest.someGiver");
}

// A one-line description of what turning the quest in actually pays out, used
// wherever the plain Ash figure would be misleading or zero.
export function questRewardLabel(quest: QuestInfoData, t: Translate): string | null {
  const reward = quest.reward;
  if (!reward) return quest.rewardAsh > 0 ? t("g.sola.reward", { amount: quest.rewardAsh }) : null;

  if (reward.kind === "cosmetic") {
    return t("g.quest.rewardCosmetic", { name: t(`g.cosmetic.${reward.itemId}.name`) });
  }
  if (reward.kind === "companionFragments") {
    return t("g.quest.rewardPetFragments", { amount: reward.amount });
  }
  if (reward.kind === "cosmeticFragments") {
    return t("g.quest.rewardSkinFragments", { amount: reward.amount });
  }
  if (reward.kind === "factionTreasuryAsh") {
    return t("g.quest.rewardTreasuryAsh", { amount: reward.amount });
  }
  return null;
}
