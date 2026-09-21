// src/features/game/world/locations/showcase/scene/subtitles.ts
import type { SceneSubtitle } from "./SceneTimeline";

// Scene dialogue is long enough that speech bubbles would shred it, so it plays as a
// caption strip instead. The scene writes here and the HUD subscribes, the same way
// captionVisibility is shared between the rooms and the cinema camera.

let current: SceneSubtitle | null = null;
const listeners = new Set<(subtitle: SceneSubtitle | null) => void>();

export function setSceneSubtitle(next: SceneSubtitle | null): void {
    const same = current === next
        || (current !== null && next !== null && current.speaker === next.speaker && current.text === next.text);
    if (same) return;

    current = next;
    for (const listener of listeners) listener(current);
}

export function getSceneSubtitle(): SceneSubtitle | null {
    return current;
}

export function onSceneSubtitle(listener: (subtitle: SceneSubtitle | null) => void): () => void {
    listeners.add(listener);
    listener(current);
    return () => {
        listeners.delete(listener);
    };
}

export function clearSceneSubtitle(): void {
    setSceneSubtitle(null);
}
