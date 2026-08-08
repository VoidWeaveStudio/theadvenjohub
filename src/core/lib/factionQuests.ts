// src/core/lib/factionQuests.ts
export const X_POST_URL_PREFIX = "https://x.com/";
export const QUEST_LISTING_FEE_ASH = 1;
export const QUEST_MIN_SLOTS = 1;
export const QUEST_MAX_SLOTS = 10_000;
export const QUEST_MIN_REWARD_ASH = 1;
export const QUEST_MAX_REWARD_ASH = 100_000;

export const FACTION_QUEST_TYPES = [
    {
        key: "x_post_view",
        label: "View a post on X",
        description: "Players open your post on X and confirm the view to earn the reward.",
    },
] as const;

export type FactionQuestTypeKey = (typeof FACTION_QUEST_TYPES)[number]["key"];

export function isValidXPostUrl(url: string): boolean {
    if (typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith(X_POST_URL_PREFIX)) return false;
    if (trimmed.length <= X_POST_URL_PREFIX.length) return false;
    if (trimmed.length > 512) return false;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" && parsed.hostname === "x.com";
    } catch {
        return false;
    }
}

export function questTotalCostAsh(slotsTotal: number, rewardAsh: number): number {
    return slotsTotal * rewardAsh + QUEST_LISTING_FEE_ASH;
}
