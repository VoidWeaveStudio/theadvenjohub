// src/features/game/world/locations/events/dust2Layout.ts

// Dust 2 blocked out at roughly 1 unit = 1 metre, radar orientation: T spawn
// south-east, CT spawn north, A site north-east, B site north-west, mid down
// the middle. Walls are axis-aligned rectangles [x1, z1, x2, z2] with a height.

export interface WallRect {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    height: number;
    y?: number;
    style?: "wall" | "trim" | "arch";
}

export interface CrateBox {
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    y?: number;
    rotation?: number;
    style?: "crate" | "concrete" | "barrel" | "car";
}

export interface GroundPatch {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    style: "sand" | "tile" | "plaza" | "site";
}

export interface Callout {
    label: string;
    x: number;
    z: number;
}

export const MAP_HALF_X = 46;
export const MAP_HALF_Z = 42;
export const WALL_HEIGHT = 7;
export const PLAYER_LIMIT_RADIUS = 68;

export const T_SPAWN = { x: 24, z: 33 };
export const CT_SPAWN = { x: 8, z: -30 };

export const BOMB_SITE_A = { x: 26, z: -16, radius: 9 };
export const BOMB_SITE_B = { x: -24, z: -15, radius: 9 };

export const T_SPAWN_POINTS: [number, number][] = [
    [21, 34], [24, 35], [27, 34], [22, 31], [26, 31],
];

export const CT_SPAWN_POINTS: [number, number][] = [
    [4, -31], [7, -32], [10, -31], [6, -28], [10, -28],
];

// Outer shell plus the walls that carve the lanes. Kept as long runs so the
// collision grid stays cheap — the visual detail rides on top of these.
export const WALLS: WallRect[] = [
    { x1: -MAP_HALF_X, z1: -MAP_HALF_Z, x2: MAP_HALF_X, z2: -MAP_HALF_Z + 1.5, height: WALL_HEIGHT + 2 },
    { x1: -MAP_HALF_X, z1: MAP_HALF_Z - 1.5, x2: MAP_HALF_X, z2: MAP_HALF_Z, height: WALL_HEIGHT + 2 },
    { x1: -MAP_HALF_X, z1: -MAP_HALF_Z, x2: -MAP_HALF_X + 1.5, z2: MAP_HALF_Z, height: WALL_HEIGHT + 2 },
    { x1: MAP_HALF_X - 1.5, z1: -MAP_HALF_Z, x2: MAP_HALF_X, z2: MAP_HALF_Z, height: WALL_HEIGHT + 2 },

    { x1: 12, z1: 26, x2: 13.5, z2: 40, height: WALL_HEIGHT },
    { x1: 13.5, z1: 26, x2: 34, z2: 27.5, height: WALL_HEIGHT },
    { x1: 34, z1: 14, x2: 35.5, z2: 27.5, height: WALL_HEIGHT },

    { x1: 18, z1: 14, x2: 34, z2: 15.5, height: WALL_HEIGHT },
    { x1: 18, z1: 15.5, x2: 19.5, z2: 24, height: WALL_HEIGHT },

    { x1: 34, z1: -6, x2: 35.5, z2: 14, height: WALL_HEIGHT },
    { x1: 19.5, z1: -4.5, x2: 21, z2: 14, height: WALL_HEIGHT },

    { x1: 12, z1: 6, x2: 13.5, z2: 26, height: WALL_HEIGHT },
    { x1: 5, z1: 20, x2: 12, z2: 21.5, height: WALL_HEIGHT },
    { x1: -2, z1: 20, x2: 2, z2: 21.5, height: WALL_HEIGHT },

    { x1: 5, z1: 6, x2: 6.5, z2: 20, height: WALL_HEIGHT },
    { x1: -6.5, z1: 6, x2: -5, z2: 21.5, height: WALL_HEIGHT },

    { x1: -6.5, z1: -2, x2: -5, z2: 3, height: WALL_HEIGHT },
    { x1: 5, z1: -2, x2: 6.5, z2: 3, height: WALL_HEIGHT },

    { x1: -6.5, z1: -14, x2: -5, z2: -6, height: WALL_HEIGHT },
    { x1: 5, z1: -14, x2: 6.5, z2: -6, height: WALL_HEIGHT },
    { x1: -5, z1: -15.5, x2: 5, z2: -14, height: WALL_HEIGHT },

    { x1: 6.5, z1: -6, x2: 14, z2: -4.5, height: WALL_HEIGHT },
    { x1: 12.5, z1: -20, x2: 14, z2: -4.5, height: WALL_HEIGHT },

    { x1: 14, z1: -21.5, x2: 36, z2: -20, height: WALL_HEIGHT },
    { x1: 34, z1: -21.5, x2: 35.5, z2: -6, height: WALL_HEIGHT },
    { x1: 21, z1: -6, x2: 34, z2: -4.5, height: WALL_HEIGHT },

    { x1: -2, z1: -21.5, x2: 22, z2: -20, height: WALL_HEIGHT },
    { x1: -2, z1: -34, x2: -0.5, z2: -21.5, height: WALL_HEIGHT },
    { x1: 20, z1: -34, x2: 21.5, z2: -21.5, height: WALL_HEIGHT },

    { x1: -14, z1: 26, x2: -12.5, z2: 40, height: WALL_HEIGHT },
    { x1: -32, z1: 26, x2: -12.5, z2: 27.5, height: WALL_HEIGHT },
    { x1: -32, z1: 14, x2: -30.5, z2: 27.5, height: WALL_HEIGHT },
    { x1: -32, z1: 12.5, x2: -14, z2: 14, height: WALL_HEIGHT },
    { x1: -14, z1: 4, x2: -12.5, z2: 14, height: WALL_HEIGHT },

    { x1: -32, z1: -4, x2: -30.5, z2: 12.5, height: WALL_HEIGHT },
    { x1: -20, z1: -4, x2: -18.5, z2: 6, height: WALL_HEIGHT },
    { x1: -18.5, z1: 4.5, x2: -12.5, z2: 6, height: WALL_HEIGHT },

    { x1: -34, z1: -22, x2: -32.5, z2: -4, height: WALL_HEIGHT },
    { x1: -34, z1: -23.5, x2: -12, z2: -22, height: WALL_HEIGHT },
    { x1: -12, z1: -23.5, x2: -10.5, z2: -6, height: WALL_HEIGHT },
    { x1: -18.5, z1: -6, x2: -10.5, z2: -4.5, height: WALL_HEIGHT },

    { x1: -10.5, z1: -12, x2: -6.5, z2: -10.5, height: WALL_HEIGHT },
];

export const CRATES: CrateBox[] = [
    { x: 24, z: -14, width: 4, depth: 4, height: 2.4, style: "crate" },
    { x: 28.5, z: -13.5, width: 4, depth: 4, height: 2.4, style: "crate" },
    { x: 26.2, z: -17.6, width: 4, depth: 4, height: 4.6, style: "crate" },
    { x: 31, z: -17.5, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 22, z: -18.4, width: 3.4, depth: 3.4, height: 2.4, style: "concrete" },
    { x: 17.5, z: -12, width: 5, depth: 3, height: 1.6, style: "car" },
    { x: 32.5, z: -8.5, width: 3, depth: 3, height: 2.4, style: "crate" },

    { x: -26, z: -13, width: 4, depth: 4, height: 2.4, style: "crate" },
    { x: -21.5, z: -13.5, width: 4, depth: 4, height: 2.4, style: "crate" },
    { x: -23.8, z: -17.2, width: 4, depth: 4, height: 4.6, style: "crate" },
    { x: -29, z: -17, width: 3.4, depth: 3.4, height: 2.4, style: "concrete" },
    { x: -16, z: -16, width: 3, depth: 3, height: 2.4, style: "crate" },
    { x: -27.5, z: -8, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },

    { x: 2.4, z: 0.5, width: 3.2, depth: 3.2, height: 2.4, style: "crate" },
    { x: -2.5, z: -8, width: 3, depth: 3, height: 2.4, style: "concrete" },
    { x: 0.5, z: 14, width: 3, depth: 3, height: 2.4, style: "crate" },

    { x: 27, z: 6, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 30.5, z: -1, width: 3, depth: 3, height: 2.4, style: "concrete" },
    { x: 24, z: 20, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 30, z: 21.5, width: 3, depth: 3, height: 2.4, style: "barrel" },

    { x: 16, z: 32, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 31, z: 33, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -22, z: 20, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -27, z: 8, width: 3, depth: 3, height: 2.4, style: "barrel" },
    { x: -16, z: -30, width: 3, depth: 3, height: 2.4, style: "concrete" },

    { x: 14, z: -28, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 2, z: -26, width: 3, depth: 3, height: 2.4, style: "barrel" },
];

export const GROUND_PATCHES: GroundPatch[] = [
    { x1: 13.5, z1: 27.5, x2: 34, z2: 40, style: "plaza" },
    { x1: 19.5, z1: -4.5, x2: 34, z2: 27.5, style: "sand" },
    { x1: 14, z1: -20, x2: 34, z2: -6, style: "site" },
    { x1: -30.5, z1: -22, x2: -12, z2: -6, style: "site" },
    { x1: -5, z1: -14, x2: 5, z2: 20, style: "tile" },
    { x1: -0.5, z1: -34, x2: 20, z2: -21.5, style: "plaza" },
    { x1: -30.5, z1: 14, x2: -14, z2: 26, style: "sand" },
    { x1: -12.5, z1: 27.5, x2: 12, z2: 40, style: "plaza" },
];

export const CALLOUTS: Callout[] = [
    { label: "T SPAWN", x: 24, z: 34 },
    { label: "CT SPAWN", x: 8, z: -29 },
    { label: "LONG A", x: 27, z: 4 },
    { label: "LONG DOORS", x: 27, z: 15 },
    { label: "PIT", x: 32, z: -9 },
    { label: "A SITE", x: 26, z: -14 },
    { label: "GOOSE", x: 17, z: -18 },
    { label: "SHORT", x: 9, z: -6 },
    { label: "CATWALK", x: 10, z: 2 },
    { label: "MID", x: 0, z: 6 },
    { label: "MID DOORS", x: 0, z: 20 },
    { label: "XBOX", x: 2.4, z: 0.5 },
    { label: "B SITE", x: -24, z: -14 },
    { label: "B DOORS", x: -16, z: -5 },
    { label: "UPPER TUNNEL", x: -22, z: 8 },
    { label: "LOWER TUNNEL", x: -22, z: 20 },
    { label: "B PLAT", x: -13, z: -18 },
];
