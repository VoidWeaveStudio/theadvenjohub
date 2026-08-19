// src/features/game/world/locations/tower/TowerRegistry.ts
import { Location } from "../../Location";
import { MainHall } from "./floors/main-hall/MainHall";
import { Basement } from "./floors/basement/Basement";
import { FirstFloor } from "./floors/first-floor/FirstFloor";
import { TokenGatesFloor } from "./floors/TokenGatesFloor";
import { EventsLobby } from "../events/EventsLobby";
import { EVENT_LOCATIONS } from "../events/eventLocations";
import { MainWorld } from "../main-world/MainWorld";
import { TokenCanyon } from "../token-gates/TokenCanyon";

export interface TowerFloorConfig {
    id: string;
    name: string;
    locationClass: () => Location;
    description: string;
    icon: 'building' | 'arrow-down' | 'arrow-up';
}

export const TOWER_FLOORS: TowerFloorConfig[] = [
    { id: 'tower-main-hall', name: 'g.floorReg.tower-main-hall.name', locationClass: () => new MainHall(), description: 'g.floorReg.tower-main-hall.description', icon: 'building' },
    { id: 'tower-first-floor', name: 'g.floorReg.tower-first-floor.name', locationClass: () => new FirstFloor(), description: 'g.floorReg.tower-first-floor.description', icon: 'building' },
    { id: 'tower-token-gates', name: 'g.floorReg.tower-token-gates.name', locationClass: () => new TokenGatesFloor(), description: 'g.floorReg.tower-token-gates.description', icon: 'building' },
    { id: 'tower-basement', name: 'g.floorReg.tower-basement.name', locationClass: () => new Basement(), description: 'g.floorReg.tower-basement.description', icon: 'arrow-down' },
    { id: 'main-world', name: 'g.floorReg.main-world.name', locationClass: () => new MainWorld(), description: 'g.floorReg.main-world.description', icon: 'arrow-up' },
    { id: 'tower-events', name: 'g.floorReg.tower-events.name', locationClass: () => new EventsLobby(), description: 'g.floorReg.tower-events.description', icon: 'building' },
];

export const ALL_LOCATIONS: TowerFloorConfig[] = [
    ...TOWER_FLOORS,
    {
        id: 'open-world-canyon',
        name: 'Open World Canyon',
        locationClass: () => new TokenCanyon(),
        description: 'The vast desert expanse',
        icon: 'arrow-up' as const
    },
    ...EVENT_LOCATIONS.map((event) => ({
        id: event.id,
        name: event.name,
        locationClass: event.locationClass,
        description: event.name,
        icon: 'building' as const,
    })),
];
