// src/features/game/world/locations/tower/floors/main-hall/layout.ts
import * as THREE from "three";

export const HALL_RADIUS = 92;
export const WALL_HEIGHT = 34;
export const ARCADE_TOP = 30;
export const VAULT_HEIGHT = 58;

export const COLONNADE_RADIUS = 82;
export const COLUMN_COUNT = 24;
export const COLUMN_COLLIDER_RADIUS = 2.5;

export const WALL_SOLID_TOP = 2.6;

export const MEZZANINE_Y = 16;
export const MEZZANINE_INNER = 74;
export const MEZZANINE_OUTER = 90;
export const MEZZANINE_SLAB = 0.7;
export const RAIL_HEIGHT = 1.75;

export const STAIR_BOTTOM_RADIUS = 46;
export const STAIR_TOP_RADIUS = 70;
export const STAIR_LANDING_OUTER = MEZZANINE_INNER;
export const STAIR_STEPS = 32;
export const STAIR_WIDTH = 8.4;
export const STAIR_RISE = MEZZANINE_Y / STAIR_STEPS;
export const STAIR_RUN = (STAIR_TOP_RADIUS - STAIR_BOTTOM_RADIUS) / STAIR_STEPS;

export const RING_STEPS: { radius: number; top: number }[] = [
    { radius: 21, top: 0.5 },
    { radius: 17.5, top: 1 },
    { radius: 14, top: 1.5 },
];
export const RING_TOP_RADIUS = 14;
export const RING_TOP_Y = 1.5;

export const POST_RADIUS = 56;
export const POST_PLINTH_TOP = 0.38;
export const BOARD_RADIUS = 46;
export const BOARD_WIDTH_UNITS = 38;
export const BOARD_HEIGHT_UNITS = 13;
export const BOARD_BOTTOM = 8.5;
export const NOTICE_RADIUS = 66;
export const BANNER_RADIUS = 48;
export const BANNER_BOTTOM = 23;
export const PEDESTAL_RADIUS = 33;

export const SPAWN_POINT = new THREE.Vector3(0, 2, 26);

export const NORTH = 0;
export const EAST = Math.PI / 2;
export const SOUTH = Math.PI;
export const WEST = -Math.PI / 2;

export const STAIR_ANGLES = [EAST, WEST];
export const NOTICE_ANGLES = [Math.PI * 0.375, -Math.PI * 0.375];

export type PostStyle = "exchange" | "contracts" | "atelier" | "heraldry";

export interface HallNpc {
    id: string;
    npcName: string;
    role: string;
    tagline: string;
    style: PostStyle;
    accent: string;
    accentHex: number;
    bodyTint: number;
    angle: number;
}

export const HALL_NPCS: HallNpc[] = [
    {
        id: "token-vendor",
        npcName: "g.npc.tony",
        role: "g.npc.token-vendor.role",
        tagline: "g.hall.token-vendor.tagline",
        style: "exchange",
        accent: "#f0b95c",
        accentHex: 0xf0b95c,
        bodyTint: 0x7a2f3a,
        angle: Math.PI * 0.25,
    },
    {
        id: "quest-giver-sola",
        npcName: "g.npc.sola",
        role: "g.hall.quest-giver-sola.role",
        tagline: "g.hall.quest-giver-sola.tagline",
        style: "contracts",
        accent: "#7fd6a2",
        accentHex: 0x7fd6a2,
        bodyTint: 0x2f6b4a,
        angle: Math.PI * 0.75,
    },
    {
        id: "npc-alfredo",
        npcName: "g.npc.alfredo",
        role: "g.npc.npc-alfredo.role",
        tagline: "g.hall.npc-alfredo.tagline",
        style: "atelier",
        accent: "#7cc4e8",
        accentHex: 0x7cc4e8,
        bodyTint: 0x1e6091,
        angle: Math.PI * 1.25,
    },
    {
        id: "faction-broker",
        npcName: "g.npc.alaric",
        role: "g.npc.faction-broker.role",
        tagline: "g.hall.faction-broker.tagline",
        style: "heraldry",
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
