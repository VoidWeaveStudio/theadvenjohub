//src\features\game\utils\dayNightCycle.ts

export interface DayNightConfig {
    epoch: number;
    dayDurationMs: number;
    nightDurationMs: number;
}

export function computeDayTime(nowMs: number, config: DayNightConfig): number {
    const totalMs = config.dayDurationMs + config.nightDurationMs;
    const elapsed = nowMs - config.epoch;
    const t = ((elapsed % totalMs) + totalMs) % totalMs;
    const phase = t < config.dayDurationMs
        ? (t / config.dayDurationMs) * 0.5
        : 0.5 + ((t - config.dayDurationMs) / config.nightDurationMs) * 0.5;
    return (0.25 + phase * 0.5) % 1;
}
