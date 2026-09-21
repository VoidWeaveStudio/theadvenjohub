// src/features/game/world/locations/showcase/scene/directedScene.ts
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { SceneTimeline } from "./SceneTimeline";

export interface DirectedActor {
    id: string;
    actor: ShowcaseActor;
}

// What a room hands to the scene director: the scripted timeline, and every actor in
// the room (cast first, then the extras) so any of them can be posed by hand.
export interface DirectedScene {
    timeline: SceneTimeline;
    actors(): DirectedActor[];
}

export function asDirectedScene(location: unknown): DirectedScene | null {
    const candidate = location as { getDirectedScene?: () => DirectedScene | null } | null;
    if (!candidate || typeof candidate.getDirectedScene !== "function") return null;
    return candidate.getDirectedScene();
}
