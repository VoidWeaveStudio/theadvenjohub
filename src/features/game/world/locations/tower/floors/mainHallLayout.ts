// src/features/game/world/locations/tower/floors/mainHallLayout.ts
import * as THREE from "three";
import { NpcRoleIcon } from "./mainHallSigns";

export const PLAZA_RADIUS = 16;
export const BUILDING_RING_RADIUS = 58;
export const BUILDING_WIDTH = 26;
export const BUILDING_DEPTH = 18;
export const BUILDING_HEIGHT = 14;
export const NPC_DOOR_OFFSET = BUILDING_DEPTH / 2 + 2;

export type BuildingFacing = "north" | "east" | "south" | "west";

export interface MainHallBuilding {
    id: string;
    npcName: string;
    role: string;
    icon: NpcRoleIcon;
    accent: string;
    accentHex: number;
    facing: BuildingFacing;
}

export const MAIN_HALL_BUILDINGS: MainHallBuilding[] = [
    { id: "token-vendor", npcName: "Tony", role: "Trader", icon: "merchant", accent: "#ffcc66", accentHex: 0xffcc66, facing: "north" },
    { id: "quest-giver-sola", npcName: "Sola", role: "Quests", icon: "quests", accent: "#66ffb3", accentHex: 0x66ffb3, facing: "east" },
    { id: "npc-alfredo", npcName: "Alfredo", role: "Appearance", icon: "style", accent: "#66ccff", accentHex: 0x66ccff, facing: "south" },
    { id: "faction-broker", npcName: "Alaric", role: "Factions", icon: "factions", accent: "#c084fc", accentHex: 0xc084fc, facing: "west" },
];

const FACING_DIRECTION: Record<BuildingFacing, THREE.Vector3> = {
    north: new THREE.Vector3(0, 0, -1),
    east: new THREE.Vector3(1, 0, 0),
    south: new THREE.Vector3(0, 0, 1),
    west: new THREE.Vector3(-1, 0, 0),
};

export const FACING_ROTATION: Record<BuildingFacing, number> = {
    north: 0,
    east: -Math.PI / 2,
    south: Math.PI,
    west: Math.PI / 2,
};

export function buildingPosition(facing: BuildingFacing): THREE.Vector3 {
    return FACING_DIRECTION[facing].clone().multiplyScalar(BUILDING_RING_RADIUS);
}

export function npcDoorPosition(facing: BuildingFacing): THREE.Vector3 {
    return FACING_DIRECTION[facing].clone().multiplyScalar(BUILDING_RING_RADIUS - NPC_DOOR_OFFSET);
}

export function buildingFootprint(facing: BuildingFacing): THREE.Box3 {
    const center = buildingPosition(facing);
    const alongX = facing === "north" || facing === "south";
    const halfX = alongX ? BUILDING_WIDTH / 2 : BUILDING_DEPTH / 2;
    const halfZ = alongX ? BUILDING_DEPTH / 2 : BUILDING_WIDTH / 2;

    return new THREE.Box3(
        new THREE.Vector3(center.x - halfX, 0, center.z - halfZ),
        new THREE.Vector3(center.x + halfX, BUILDING_HEIGHT + 3, center.z + halfZ)
    );
}
