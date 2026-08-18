// src/features/game/world/locations/events/eventLocations.ts
import { Location } from "../../Location";
import { GRINDER_LOCATION_ID, GRINDER_NAME } from "../../../data/eventDoors";
import { EVENT_ROOM_THEMES, EVENT_ROOM_THEMES_BY_LOCATION } from "./roomThemes";
import { CandleArena } from "./rooms/CandleArena";
import { Dust2 } from "./rooms/Dust2";
import { ThemedEventRoom } from "./rooms/ThemedEventRoom";

const ROOM_SEED_BASE = 0x2f6c19;

export interface EventLocationConfig {
    id: string;
    name: string;
    locationClass: () => Location;
}

export function createEventRoom(locationId: string): Location | null {
    if (locationId === GRINDER_LOCATION_ID) return new Dust2(GRINDER_LOCATION_ID, GRINDER_NAME);

    const theme = EVENT_ROOM_THEMES_BY_LOCATION.get(locationId);
    if (!theme) return null;
    if (theme.id === "arena") return new CandleArena();
    if (theme.id === "dust2") return new Dust2();

    const index = EVENT_ROOM_THEMES.findIndex((entry) => entry.locationId === locationId);
    return new ThemedEventRoom(theme, ROOM_SEED_BASE + index * 7919);
}

export const EVENT_LOCATIONS: EventLocationConfig[] = [
    ...EVENT_ROOM_THEMES.map((theme) => ({
        id: theme.locationId,
        name: theme.name,
        locationClass: () => createEventRoom(theme.locationId)!,
    })),
    {
        id: GRINDER_LOCATION_ID,
        name: GRINDER_NAME,
        locationClass: () => createEventRoom(GRINDER_LOCATION_ID)!,
    },
];
