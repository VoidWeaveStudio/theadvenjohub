// src/features/game/world/locations/tower/TowerRegistry.ts
import { Location } from "../../Location";
import { MainHall } from "./floors/MainHall";
import { Basement } from "./floors/Basement";
import { FirstFloor } from "./floors/FirstFloor";
import { MainWorld } from "../main-world/MainWorld";
import { TokenCanyon } from "../token-gates/TokenCanyon";
import { GATE_REGISTRY } from "../token-gates/GateRegistry";

export interface TowerFloorConfig {
    id: string;
    name: string;
    locationClass: () => Location;
    description: string;
    icon: 'building' | 'arrow-down' | 'arrow-up';
}

export const TOWER_FLOORS: TowerFloorConfig[] = [
    { id: 'tower-main-hall', name: 'Main Hall', locationClass: () => new MainHall(), description: 'Main Hall', icon: 'building' },
    { id: 'tower-first-floor', name: 'First Floor', locationClass: () => new FirstFloor(), description: 'Desert Cave Hub', icon: 'building' },
    { id: 'tower-basement', name: 'Basement', locationClass: () => new Basement(), description: 'MemeTower', icon: 'arrow-down' },
    { id: 'main-world', name: 'Main World', locationClass: () => new MainWorld(), description: 'Open World', icon: 'arrow-up' },
];

export function createTokenCanyonLocation(locationId: string, gateId: string): Location {
    return new TokenCanyon(locationId, gateId);
}

export const ALL_LOCATIONS: TowerFloorConfig[] = [
    ...TOWER_FLOORS,
    ...GATE_REGISTRY.map(gate => ({
        id: gate.targetLocationId,
        name: gate.name,
        locationClass: () => createTokenCanyonLocation(gate.targetLocationId, gate.id),
        description: gate.description,
        icon: 'arrow-up' as const
    })),
    {
        id: 'open-world-canyon',
        name: 'Open World Canyon',
        locationClass: () => createTokenCanyonLocation('open-world-canyon', 'open-world-canyon'),
        description: 'The vast desert expanse',
        icon: 'arrow-up' as const
    }
];