// src/features/game/world/locations/showcase/captionVisibility.ts
let hidden = false;

export function setCaptionsHidden(value: boolean): void {
    hidden = value;
}

export function areCaptionsHidden(): boolean {
    return hidden;
}
