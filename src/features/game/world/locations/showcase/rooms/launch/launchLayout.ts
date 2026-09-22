// src/features/game/world/locations/showcase/rooms/launch/launchLayout.ts
import * as THREE from "three";

export const PAD_DECK_Y = 2.4;
export const PAD_RADIUS = 26;
export const APRON_RADIUS = 62;
export const FENCE_RADIUS = 82;
export const SITE_RADIUS = 86;
export const YARD_RADIUS = 104;

export const RAMP_WIDTH = 11;
export const RAMP_START_Z = -42;
export const RAMP_END_Z = -PAD_RADIUS;

export const ROCKET_BASE = new THREE.Vector3(0, PAD_DECK_Y, 0);

export const TOWER_X = -11.5;
export const TOWER_Z = 0;
export const TOWER_HEIGHT = 42;

export const CAGE_LOW_Y = PAD_DECK_Y;
export const CAGE_HIGH_Y = PAD_DECK_Y + 23;

export const ARM_Y = PAD_DECK_Y + 23;

export const CABIN_FLOOR_Y = 23;
export const CABIN_RADIUS = 2.45;
export const HATCH_Y = CABIN_FLOOR_Y;


export const BUNKER = new THREE.Vector3(-44, 0, -38);
export const TANK_FARM = new THREE.Vector3(43, 0, 26);
export const WATER_TOWER = new THREE.Vector3(33, 0, -18);
export const STAND_Z = -62;
export const BOARD_SPOT = new THREE.Vector3(24, 0, -34);

export const SPAWN_X = 0;
export const SPAWN_Z = -72;
export const EXIT_X = -26;
export const EXIT_Z = -74;

export const MOON_DIRECTION = new THREE.Vector3(0.18, 0.46, 0.87).normalize();

export interface CrewSeat {
    x: number;
    z: number;
    facing: number;
}

export const CREW_SEATS: Record<"commander" | "walter", CrewSeat> = {
    commander: { x: -0.82, z: 0.1, facing: Math.PI },
    walter: { x: 0.82, z: 0.1, facing: Math.PI },
};

export function seatPoint(id: keyof typeof CREW_SEATS): THREE.Vector3 {
    const seat = CREW_SEATS[id];
    return new THREE.Vector3(seat.x, CABIN_FLOOR_Y, seat.z);
}



export const CAGE_SPOTS: Record<"commander" | "walter", THREE.Vector3> = {
    commander: new THREE.Vector3(-0.55, 0, 0.1),
    walter: new THREE.Vector3(0.55, 0, 0.1),
};

export function towerFoot(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, PAD_DECK_Y, TOWER_Z - 4.6);
}

export function cageDoor(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, PAD_DECK_Y, TOWER_Z - 2.8);
}

export function armSpot(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X + 5.2, ARM_Y, TOWER_Z);
}

export function hatchSpot(): THREE.Vector3 {
    return new THREE.Vector3(-2.5, ARM_Y, 0);
}

export function padRampSpot(): THREE.Vector3 {
    return new THREE.Vector3(0, PAD_DECK_Y, RAMP_END_Z + 3);
}

export function groundHeightAt(x: number, z: number): number {
    const radial = Math.hypot(x, z);

    if (radial <= PAD_RADIUS) return PAD_DECK_Y;

    if (Math.abs(x) <= RAMP_WIDTH / 2 && z >= RAMP_START_Z && z <= RAMP_END_Z) {
        const t = (z - RAMP_START_Z) / (RAMP_END_Z - RAMP_START_Z);
        return PAD_DECK_Y * t * t * (3 - 2 * t);
    }

    if (radial <= PAD_RADIUS + 2.6) {
        const skirt = 1 - (radial - PAD_RADIUS) / 2.6;
        return PAD_DECK_Y * skirt * 0.18;
    }

    const dunes = Math.sin(x * 0.041 + 1.3) * Math.cos(z * 0.037 - 0.7) * 0.6
        + Math.sin(x * 0.11 - 0.4) * 0.22;
    const open = THREE.MathUtils.smoothstep(radial, APRON_RADIUS - 6, APRON_RADIUS + 14);
    const yards = 1 - THREE.MathUtils.smoothstep(radial, 86, 104);

    return dunes * open * yards;
}

export const TOWER_SPAN = 2.6;
export const CAGE_X = TOWER_X - TOWER_SPAN - 0.55;
export const CAGE_FLOOR = 0.07;

export const CREW_IDLE_A = new THREE.Vector3(-4.2, PAD_DECK_Y, -9.4);
export const CREW_IDLE_B = new THREE.Vector3(-1.4, PAD_DECK_Y, -10.2);
export const ENGINEER_SPOT = new THREE.Vector3(-7.4, PAD_DECK_Y, -6.2);
export const ENGINEER_CLEAR = new THREE.Vector3(-18, groundHeightAt(-18, -46), -46);
export const CONTROL_SPOT = new THREE.Vector3(-20, groundHeightAt(-20, -40), -40);
export const GUEST_A = new THREE.Vector3(-5.5, groundHeightAt(-5.5, STAND_Z + 3.4), STAND_Z + 3.4);
export const GUEST_B = new THREE.Vector3(5.5, groundHeightAt(5.5, STAND_Z + 3.4), STAND_Z + 3.4);

export function cageStand(id: "commander" | "walter"): THREE.Vector3 {
    const spot = CAGE_SPOTS[id];
    return new THREE.Vector3(spot.x, CAGE_FLOOR, spot.z);
}

export function cageStandWorld(id: "commander" | "walter"): THREE.Vector3 {
    const spot = CAGE_SPOTS[id];
    return new THREE.Vector3(CAGE_X + spot.x, CAGE_HIGH_Y + CAGE_FLOOR, spot.z);
}

export function cageEntry(): THREE.Vector3 {
    const door = cageDoor();
    return new THREE.Vector3(door.x - CAGE_X, CAGE_FLOOR, door.z);
}

export function towerDeck(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, ARM_Y, 0);
}

export function cabinDoorSpot(): THREE.Vector3 {
    const hatch = hatchSpot();
    return new THREE.Vector3(hatch.x, HATCH_Y, hatch.z);
}

export const SPAWN = new THREE.Vector3(SPAWN_X, groundHeightAt(SPAWN_X, SPAWN_Z), SPAWN_Z);
export const EXIT_SPOT = new THREE.Vector3(EXIT_X, groundHeightAt(EXIT_X, EXIT_Z), EXIT_Z);

export interface SiteBuilding {
    id: string;
    x: number;
    z: number;
    facing: number;
    width: number;
    depth: number;
    height: number;
    ticker?: string;
    tint?: number;
}

export const ASSEMBLY_BUILDING: SiteBuilding = {
    id: "assembly", x: 18, z: 124, facing: -0.16, width: 46, depth: 40, height: 58,
};

export const HANGARS: SiteBuilding[] = [
    { id: "hangarPepe", x: -74, z: 78, facing: 0.86, width: 34, depth: 20, height: 12, ticker: "$PEPE", tint: 0x3ddc84 },
    { id: "hangarDoge", x: 92, z: 66, facing: -0.72, width: 34, depth: 20, height: 12, ticker: "$DOGE", tint: 0xffc43d },
    { id: "hangarWif", x: -106, z: -14, facing: 1.48, width: 30, depth: 18, height: 11, ticker: "$WIF", tint: 0xff8fb1 },
];

export const WAREHOUSES: SiteBuilding[] = [
    { id: "storeA", x: -58, z: -96, facing: 0.5, width: 22, depth: 12, height: 9 },
    { id: "storeB", x: -86, z: -82, facing: 0.9, width: 22, depth: 12, height: 9 },
    { id: "storeC", x: -28, z: -114, facing: 0.2, width: 22, depth: 12, height: 9 },
    { id: "plant", x: 118, z: -8, facing: 1.6, width: 26, depth: 16, height: 14 },
];

export const OFFICE: SiteBuilding = {
    id: "office", x: 60, z: -86, facing: 0.34, width: 26, depth: 14, height: 15,
};

export const GATEHOUSE: SiteBuilding = {
    id: "gatehouse", x: 11, z: -81, facing: 0.1, width: 5.8, depth: 4.8, height: 4,
};

export const COMMS_MASTS: Array<[number, number]> = [
    [-40, 104],
    [100, -34],
    [-112, 30],
];

export const PERIMETER_BUILDINGS: SiteBuilding[] = [ASSEMBLY_BUILDING, ...HANGARS, ...WAREHOUSES, OFFICE];
