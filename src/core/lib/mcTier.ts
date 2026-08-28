// src/core/lib/mcTier.ts
export const MC_FRAME_THRESHOLDS = [0, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];

export function mcFrameTier(marketCap: number): number {
    let tier = 0;
    for (let i = 0; i < MC_FRAME_THRESHOLDS.length; i++) {
        if (marketCap >= MC_FRAME_THRESHOLDS[i]) tier = i;
    }
    return tier;
}
