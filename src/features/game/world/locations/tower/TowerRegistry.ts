// src/features/game/world/locations/tower/TowerRegistry.ts
import { Location } from "../../Location";
import { MainHall } from "./floors/main-hall/MainHall";
import { Basement } from "./floors/basement/Basement";
import { FirstFloor } from "./floors/first-floor/FirstFloor";
import { TokenGatesFloor } from "./floors/TokenGatesFloor";
import { EventsHall } from "./floors/EventsHall";
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
    { id: 'tower-main-hall', name: 'Main hall', locationClass: () => new MainHall(), description: 'Main Hall', icon: 'building' },
    { id: 'tower-first-floor', name: 'Canyon', locationClass: () => new FirstFloor(), description: 'Slime Valley', icon: 'building' },
    { id: 'tower-token-gates', name: 'Token Gates', locationClass: () => new TokenGatesFloor(), description: 'Desert Cave Hub', icon: 'building' },
    { id: 'tower-basement', name: 'Crypto Universe', locationClass: () => new Basement(), description: 'MemeTower', icon: 'arrow-down' },
    { id: 'main-world', name: 'Open World', locationClass: () => new MainWorld(), description: 'Open World', icon: 'arrow-up' },
    { id: 'tower-events', name: 'Events', locationClass: () => new EventsHall(), description: 'Faction Events Hall', icon: 'building' },
];

export const ALL_LOCATIONS: TowerFloorConfig[] = [
    ...TOWER_FLOORS,
    {
        id: 'open-world-canyon',
        name: 'Open World Canyon',
        locationClass: () => new TokenCanyon(),
        description: 'The vast desert expanse',
        icon: 'arrow-up' as const
    }
];