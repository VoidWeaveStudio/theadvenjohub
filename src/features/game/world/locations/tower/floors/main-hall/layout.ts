// src/features/game/world/locations/tower/floors/main-hall/layout.ts
import * as THREE from "three";

export const HALL_RADIUS = 68;
export const WALL_HEIGHT = 26;
export const ARCADE_TOP = 24;
export const VAULT_HEIGHT = 42;

export const COLONNADE_RADIUS = 60;
export const COLUMN_COUNT = 20;

export const MEZZANINE_Y = 13;
export const MEZZANINE_INNER = 48;
export const MEZZANINE_OUTER = 64;

export const RING_STEPS: { radius: number; top: number }[] = [
    { radius: 16, top: 0.5 },
    { radius: 12.5, top: 1 },
    { radius: 9, top: 1.5 },
];
export const RING_TOP_RADIUS = 9;
export const RING_TOP_Y = 1.5;

export const POST_RADIUS = 40;
export const BOARD_RADIUS = 32;
export const BOARD_WIDTH_UNITS = 32;
export const BOARD_HEIGHT_UNITS = 11;
export const BOARD_BOTTOM = 8;
export const NOTICE_RADIUS = 36;
export const BANNER_RADIUS = 56;
export const PEDESTAL_RADIUS = 24;

export const SPAWN_POINT = new THREE.Vector3(0, 2, 19);

export const NORTH = 0;
export const SOUTH = Math.PI;
export const WEST = -Math.PI / 2;

export interface HallNpc {
    id: string;
    npcName: string;
    role: string;
    accent: string;
    accentHex: number;
    bodyTint: number;
    angle: number;
}

export const HALL_NPCS: HallNpc[] = [
    {
        id: "token-vendor",
        npcName: "Tony",
        role: "Exchange",
        accent: "#f0b95c",
        accentHex: 0xf0b95c,
        bodyTint: 0x7a2f3a,
        angle: Math.PI * 0.25,
    },
    {
        id: "quest-giver-sola",
        npcName: "Sola",
        role: "Contracts",
        accent: "#7fd6a2",
        accentHex: 0x7fd6a2,
        bodyTint: 0x2f6b4a,
        angle: Math.PI * 0.75,
    },
    {
        id: "npc-alfredo",
        npcName: "Alfredo",
        role: "Appearance",
        accent: "#7cc4e8",
        accentHex: 0x7cc4e8,
        bodyTint: 0x1e6091,
        angle: Math.PI * 1.25,
    },
    {
        id: "faction-broker",
        npcName: "Alaric",
        role: "Factions",
        accent: "#c79ae0",
        accentHex: 0xc79ae0,
        bodyTint: 0x8b2fc9,
        angle: Math.PI * 1.75,
    },
];

export function inwardRotation(angle: number): number {
    return -angle;
}

export function localToWorld(
    angle: number,
    radius: number,
    localX: number,
    localY: number,
    localZ: number
): [number, number, number] {
    const rotation = inwardRotation(angle);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const centerX = Math.sin(angle) * radius;
    const centerZ = -Math.cos(angle) * radius;

    return [
        centerX + localX * cos + localZ * sin,
        localY,
        centerZ - localX * sin + localZ * cos,
    ];
}

export function factionColor(seed: number): number {
    const hue = ((seed * 47) % 360) / 360;
    return new THREE.Color().setHSL(hue, 0.55, 0.58).getHex();
}

export function isLowEndDevice(): boolean {
    return typeof navigator !== "undefined" && navigator.hardwareConcurrency != null
        ? navigator.hardwareConcurrency <= 4
        : false;
}
