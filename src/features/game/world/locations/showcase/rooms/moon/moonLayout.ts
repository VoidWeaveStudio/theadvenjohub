// src/features/game/world/locations/showcase/rooms/moon/moonLayout.ts
import * as THREE from "three";
import { CABIN_FLOOR_Y, CAGE_FLOOR, CAGE_SPOTS, TOWER_SPAN, seatPoint } from "../launch/launchLayout";

export const LANDING_PAD = new THREE.Vector3(16, 0, 26);
export const PAD_RADIUS = 13;
export const ROCKET_Y = 2;

export const TOWER_X = LANDING_PAD.x - 11.5;
export const TOWER_Z = LANDING_PAD.z;
export const TOWER_HEIGHT = 34;

export const ARM_Y = ROCKET_Y + CABIN_FLOOR_Y;
export const CAGE_LOW_Y = 0.6;
export const CAGE_HIGH_Y = ARM_Y;
export const CAGE_X = TOWER_X - TOWER_SPAN - 0.55;

export const BASE_CENTER = new THREE.Vector3(-26, 0, 8);
export const CONTROL_CENTER = new THREE.Vector3(34, 0, 10);
export const SOLAR_CENTER = new THREE.Vector3(46, 0, 36);
export const FLAG_FIELD = new THREE.Vector3(-10, 0, 19);
export const FLAG_POSITION = new THREE.Vector3(-7, 0, 1);

export interface FieldPad {
    id: string;
    ticker: string;
    x: number;
    z: number;
    facing: number;
    tint: number;
    ready: number;
}

export const FIELD_PADS: FieldPad[] = [
    { id: "pepe", ticker: "PEPE", x: -22, z: 48, facing: -0.5, tint: 0x3ddc84, ready: 1 },
    { id: "doge", ticker: "DOGE", x: 52, z: -14, facing: 1.9, tint: 0xffc43d, ready: 0.8 },
    { id: "wif", ticker: "WIF", x: -56, z: -2, facing: 1.4, tint: 0xff8fb1, ready: 0.5 },
    { id: "bonk", ticker: "BONK", x: 40, z: -40, facing: 2.3, tint: 0xffa845, ready: 0.35 },
    { id: "pump", ticker: "PUMP", x: -24, z: -52, facing: 3.1, tint: 0xff6f61, ready: 0.2 },
];

export const NEIGHBOUR_PAD = FIELD_PADS[0];

export const MEET_SPOT = new THREE.Vector3(-4, 0, 40);
export const MEET_SPOT_B = new THREE.Vector3(-1.4, 0, 38.4);
export const NEIGHBOUR_SPOT = new THREE.Vector3(-9.4, 0, 41.8);
export const NEIGHBOUR_MATE = new THREE.Vector3(-13.6, 0, 45.6);
export const CREW_LOOK_UP = new THREE.Vector3(-4, 90, 60);
export const TEAM_SPOT_A = new THREE.Vector3(6, 0, 34);
export const TEAM_SPOT_B = new THREE.Vector3(9.4, 0, 31.4);

export const SPAWN = new THREE.Vector3(0, 0, -32);
export const EXIT_SPOT = new THREE.Vector3(0, 0, -40);

export function padFoot(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, 0, TOWER_Z - 4.6);
}

export function cageDoor(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, CAGE_LOW_Y, TOWER_Z - 2.8);
}

export function cageStand(id: "commander" | "walter"): THREE.Vector3 {
    const spot = CAGE_SPOTS[id];
    return new THREE.Vector3(spot.x, CAGE_FLOOR, spot.z);
}

export function cageStandWorld(id: "commander" | "walter", high: boolean): THREE.Vector3 {
    const spot = CAGE_SPOTS[id];
    return new THREE.Vector3(CAGE_X + spot.x, (high ? CAGE_HIGH_Y : CAGE_LOW_Y) + CAGE_FLOOR, TOWER_Z + spot.z);
}

export function cageEntry(): THREE.Vector3 {
    const door = cageDoor();
    return new THREE.Vector3(door.x - CAGE_X, CAGE_FLOOR, door.z - TOWER_Z);
}

export function towerDeck(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X, ARM_Y, TOWER_Z);
}

export function armSpot(): THREE.Vector3 {
    return new THREE.Vector3(TOWER_X + 5.2, ARM_Y, TOWER_Z);
}

export function hatchSpot(): THREE.Vector3 {
    return new THREE.Vector3(LANDING_PAD.x - 2.5, ARM_Y, LANDING_PAD.z);
}

export function cabinDoorSpot(): THREE.Vector3 {
    return new THREE.Vector3(-2.5, CABIN_FLOOR_Y, 0);
}

export function crewSeat(id: "commander" | "walter"): THREE.Vector3 {
    return seatPoint(id);
}
