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
    locationClass: new () => Location;
    description: string;
    icon: 'building' | 'arrow-down' | 'arrow-up';
}

export const TOWER_FLOORS: TowerFloorConfig[] = [
    { id: 'tower-main-hall', name: 'Main Hall', locationClass: MainHall, description: 'Main Hall', icon: 'building' },
    { id: 'tower-first-floor', name: 'First Floor', locationClass: FirstFloor, description: 'Desert Cave Hub', icon: 'building' },
    { id: 'tower-basement', name: 'Basement', locationClass: Basement, description: 'MemeTower', icon: 'arrow-down' },
    { id: 'main-world', name: 'Main World', locationClass: MainWorld, description: 'Open World', icon: 'arrow-up' },
];

export function createTokenCanyonLocation(gateId: string): Location {
    return new TokenCanyon(gateId);
}

export const ALL_LOCATIONS = [
    ...TOWER_FLOORS,
    ...GATE_REGISTRY.map(gate => ({
        id: gate.targetLocationId,
        name: gate.name,
        locationClass: (() => createTokenCanyonLocation(gate.id)) as any,
        description: gate.description,
        icon: 'arrow-up' as const
    })),
    {
        id: 'open-world-canyon',
        name: 'Open World Canyon',
        locationClass: (() => createTokenCanyonLocation('open-world-canyon')) as any,
        description: 'The vast desert expanse',
        icon: 'arrow-up' as const
    }
];