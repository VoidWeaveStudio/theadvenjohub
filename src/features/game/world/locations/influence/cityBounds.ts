// src/features/game/world/locations/influence/cityBounds.ts
import { CITY_BOUNDARY, CITY_BUILDINGS, CITY_EDGE_RUINS, CityBuilding } from "./cityLayout";

const RADII = CITY_BOUNDARY.map((point) => Math.hypot(point.x, point.z));
const STEP = (Math.PI * 2) / RADII.length;

export const CITY_OUTER_RADIUS = Math.ceil(Math.max(...RADII));
export const CITY_EDGE_MARGIN = 1.6;

export function cityBoundaryRadius(angle: number): number {
    let a = angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;

    const slot = a / STEP;
    const base = Math.floor(slot);
    const i0 = base % RADII.length;
    const i1 = (i0 + 1) % RADII.length;

    return RADII[i0] * (1 - (slot - base)) + RADII[i1] * (slot - base);
}

export function insideCity(x: number, z: number, margin = 0): boolean {
    return Math.hypot(x, z) <= cityBoundaryRadius(Math.atan2(z, x)) - margin;
}

export function outsideCity(x: number, z: number): boolean {
    return !insideCity(x, z, CITY_EDGE_MARGIN);
}

const BY_ID = new Map<string, CityBuilding>(
    [...CITY_BUILDINGS, ...CITY_EDGE_RUINS].map((building) => [building.id, building])
);

export function cityBuilding(id: string): CityBuilding | undefined {
    return BY_ID.get(id);
}
