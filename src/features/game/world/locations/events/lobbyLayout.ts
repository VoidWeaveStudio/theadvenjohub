// src/features/game/world/locations/events/lobbyLayout.ts
import * as THREE from "three";

export const BAY_COUNT = 10;

export const HALL_RADIUS = 58;
export const WALL_THICKNESS = 2.4;
export const WALL_HEIGHT = 21;
export const CORNICE_HEIGHT = 1.6;
export const CLERESTORY_HEIGHT = 8;
export const DOME_BASE_Y = WALL_HEIGHT + CORNICE_HEIGHT + CLERESTORY_HEIGHT;
export const DOME_HEIGHT = 22;

export const PLAYER_LIMIT_RADIUS = HALL_RADIUS - 3.6;

export const COLUMN_RING_RADIUS = 50.5;
export const COLUMN_HEIGHT = 18.5;
export const COLUMN_SHAFT_RADIUS = 1.5;

export const DOOR_PORTICO_RADIUS = HALL_RADIUS - 3.2;
export const DOOR_CLEAR_WIDTH = 8.4;
export const DOOR_CLEAR_HEIGHT = 12.6;
export const DOOR_PORTICO_DEPTH = 3.2;
export const DOOR_PORTICO_WIDTH = 13.6;
export const DOOR_INTERACT_RADIUS = 6.5;

export const ROTUNDA_RADIUS = 16;
export const RUG_RADIUS = 22;
export const FOUNTAIN_RADIUS = 6.4;

export const CHANDELIER_RING_RADIUS = 30;
export const CHANDELIER_COUNT = 5;
export const CHANDELIER_Y = 19;

export const BENCH_RING_RADIUS = 27;
export const PLANTER_RING_RADIUS = 44;

export const SPAWN_POINT = new THREE.Vector3(0, 2, 30);

export function bayAngle(index: number): number {
    return (index / BAY_COUNT) * Math.PI * 2;
}

export function inwardRotation(angle: number): number {
    return -angle;
}

export function ringPoint(angle: number, radius: number): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(angle) * radius, 0, -Math.cos(angle) * radius);
}

export function placeOnRing(object: THREE.Object3D, angle: number, radius: number, y = 0) {
    object.position.set(Math.sin(angle) * radius, y, -Math.cos(angle) * radius);
    object.rotation.y = inwardRotation(angle);
}

export function isLowEndDevice(): boolean {
    return typeof navigator !== "undefined" && navigator.hardwareConcurrency != null
        ? navigator.hardwareConcurrency <= 4
        : false;
}
