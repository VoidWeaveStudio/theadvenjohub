// src/features/game/world/locations/showcase/registry.ts
import type { Location } from "../../Location";
import { LAUNCH_INFO, SHOWCASE_INFO, ShowcaseId, ShowcaseInfo } from "./config";
import { ChurchRoom } from "./rooms/ChurchRoom";
import { WarRoom } from "./rooms/WarRoom";
import { GardenRoom } from "./rooms/GardenRoom";
import { GraveyardRoom } from "./rooms/GraveyardRoom";
import { CasinoRoom } from "./rooms/CasinoRoom";
import { MoonRoom } from "./rooms/MoonRoom";
import { LaunchRoom } from "./rooms/LaunchRoom";
import { BazaarRoom } from "./rooms/BazaarRoom";

type RoomFactory = (info: ShowcaseInfo) => Location;

const ROOM_FACTORIES: Record<ShowcaseId, RoomFactory> = {
    "show-church": (info) => new ChurchRoom(info),
    "show-war": (info) => new WarRoom(info),
    "show-garden": (info) => new GardenRoom(info),
    "show-graveyard": (info) => new GraveyardRoom(info),
    "show-casino": (info) => new CasinoRoom(info),
    "show-moon": (info) => new MoonRoom(info),
    "show-launch": (info) => new LaunchRoom(info),
    "show-bazaar": (info) => new BazaarRoom(info),
};

export interface ShowcaseLocationConfig {
    id: string;
    name: string;
    description: string;
    locationClass: () => Location;
}

export const SHOWCASE_LOCATIONS: ShowcaseLocationConfig[] = [...SHOWCASE_INFO, LAUNCH_INFO].map((info) => ({
    id: info.id,
    name: info.nameKey,
    description: info.taglineKey,
    locationClass: () => ROOM_FACTORIES[info.id](info),
}));
