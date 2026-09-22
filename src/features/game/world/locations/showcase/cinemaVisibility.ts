// src/features/game/world/locations/showcase/cinemaVisibility.ts
let active = false;

export function setCinemaActive(value: boolean): void {
    active = value;
}

export function isCinemaActive(): boolean {
    return active;
}
