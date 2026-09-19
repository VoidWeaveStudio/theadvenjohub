// src/features/game/world/locations/showcase/themedFactions.ts
import type { ShowcaseId } from "./config";

// Real faction IDs that live inside one of the seven showcase sets instead of
// the generic build-your-own faction plot (FactionGateRoom). The set itself
// stays exactly as built — its signage is not swapped for the faction's real
// name/ticker, and it does not get a build plot; the faction's real identity
// still shows up wherever the caller already threads it through (HUD
// notifications, the faction bubble's own label), just not inside the scene.
// Empty until the seven factions exist — add "<factionId>": "show-bazaar"
// (etc., one of each) once each one is created.
export const THEMED_FACTION_LOCATIONS: Record<string, ShowcaseId> = {
};

export function themedShowcaseLocationFor(factionId: string): ShowcaseId | null {
    return THEMED_FACTION_LOCATIONS[factionId] ?? null;
}
