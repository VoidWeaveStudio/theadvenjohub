// src/core/lib/factionLeveling.ts
const MAX_LEVEL = 20;

export function xpForLevel(level: number): number {
    return 500 + (level - 1) * 500;
}

export function applyFactionXp(currentLevel: number, currentProgress: number, xpGained: number): { level: number; progress: number } {
    let level = currentLevel;
    let progress = currentProgress + xpGained;

    while (level < MAX_LEVEL && progress >= xpForLevel(level)) {
        progress -= xpForLevel(level);
        level++;
    }

    return { level, progress };
}

export function taskRewardBonusMultiplier(level: number): number {
    return 1 + (level - 1) * 0.02;
}
