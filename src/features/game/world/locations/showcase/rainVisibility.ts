// src/features/game/world/locations/showcase/rainVisibility.ts
let enabled = false;

export function setRainEnabled(value: boolean): void {
    enabled = value;
}

export function isRainEnabled(): boolean {
    return enabled;
}
