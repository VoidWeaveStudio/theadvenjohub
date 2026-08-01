// src/core/lib/achievements.ts

export type AchievementMetric = "kills" | "shotsFired" | "buildingsPlaced" | "playtimeSeconds" | "deaths" | "factionTasksContributed";

export interface AchievementDefinition {
    key: string;
    label: string;
    description: string;
    metric: AchievementMetric;
    target: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
    { key: "first_blood", label: "First Blood", description: "Get your first kill", metric: "kills", target: 1 },
    { key: "veteran_50", label: "Veteran", description: "Reach 50 kills", metric: "kills", target: 50 },
    { key: "marksman_1000", label: "Marksman", description: "Fire 1,000 shots", metric: "shotsFired", target: 1000 },
    { key: "architect_10", label: "Architect", description: "Place 10 buildings", metric: "buildingsPlaced", target: 10 },
    { key: "dedicated_10h", label: "Dedicated", description: "Play for 10 hours", metric: "playtimeSeconds", target: 36000 },
    { key: "hard_knocks_25", label: "Hard Knocks", description: "Die 25 times and keep playing", metric: "deaths", target: 25 },
    { key: "team_player", label: "Team Player", description: "Contribute to a faction task", metric: "factionTasksContributed", target: 1 },
    { key: "faction_veteran_10", label: "Faction Veteran", description: "Contribute to 10 faction tasks", metric: "factionTasksContributed", target: 10 },
];

export const ACHIEVEMENTS_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));
