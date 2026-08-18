// src/features/game/world/locations/events/dust2Layout.ts

// Dust 2 blocked out at roughly 1 unit = 1 metre, radar orientation: T spawn
// south-east, CT spawn north, A site north-east, B site north-west, mid down
// the middle. Walls are axis-aligned rectangles [x1, z1, x2, z2] with a height.
//
// WALLS is the solid complement of the walkable areas rather than a hand-placed
// maze, so every route stays connected and no corridor leaks. The routes it
// carves are the real ones: T spawn to outside long to long doors to long A to
// the pit to A site; T spawn to T mid to mid doors to CT mid to catwalk to
// short to A site; T spawn to upper tunnels to the ramp to lower tunnels to B
// site; CT spawn to A cross, and CT spawn to B doors.

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

export const MAP_HALF_X = 48;
export const MAP_HALF_Z = 44;
export const WALL_HEIGHT = 8;
export const PLAYER_LIMIT_RADIUS = 70;

export const T_SPAWN = { x: 30, z: 34 };
export const CT_SPAWN = { x: -3, z: -33 };

export const BOMB_SITE_A = { x: 22, z: -15, radius: 9 };
export const BOMB_SITE_B = { x: -29, z: -16, radius: 9 };

export const T_SPAWN_POINTS: [number, number][] = [
    [30, 34], [27, 34], [30, 31], [30, 37], [33, 34],
];

export const CT_SPAWN_POINTS: [number, number][] = [
    [-3, -33], [-6, -33], [-3, -36], [-3, -30], [0, -33],
];

// Outer shell plus the walls that carve the lanes. Kept as long runs so the
// collision grid stays cheap — the visual detail rides on top of these.
export const WALLS: WallRect[] = [
    { x1: -48, z1: -44, x2: 48, z2: -38, height: WALL_HEIGHT },
    { x1: -48, z1: -38, x2: -16, z2: -32, height: WALL_HEIGHT },
    { x1: 10, z1: -38, x2: 48, z2: -32, height: WALL_HEIGHT },
    { x1: -48, z1: -32, x2: -22, z2: -26, height: WALL_HEIGHT },
    { x1: 20, z1: -32, x2: 48, z2: -26, height: WALL_HEIGHT },
    { x1: -48, z1: -26, x2: -40, z2: 44, height: WALL_HEIGHT },
    { x1: -14, z1: -26, x2: -6, z2: 14, height: WALL_HEIGHT },
    { x1: 6, z1: -26, x2: 8, z2: -22, height: WALL_HEIGHT },
    { x1: 34, z1: -26, x2: 48, z2: -16, height: WALL_HEIGHT },
    { x1: -18, z1: -24, x2: -14, z2: 4, height: WALL_HEIGHT },
    { x1: 8, z1: -24, x2: 12, z2: -22, height: WALL_HEIGHT },
    { x1: 40, z1: -16, x2: 48, z2: 44, height: WALL_HEIGHT },
    { x1: -40, z1: -10, x2: -30, z2: 44, height: WALL_HEIGHT },
    { x1: -20, z1: -10, x2: -18, z2: -6, height: WALL_HEIGHT },
    { x1: 12, z1: -10, x2: 26, z2: 10, height: WALL_HEIGHT },
    { x1: 6, z1: -2, x2: 12, z2: 18, height: WALL_HEIGHT },
    { x1: -16, z1: 4, x2: -14, z2: 14, height: WALL_HEIGHT },
    { x1: -30, z1: 6, x2: -26, z2: 44, height: WALL_HEIGHT },
    { x1: 26, z1: 8, x2: 28, z2: 10, height: WALL_HEIGHT },
    { x1: 34, z1: 8, x2: 40, z2: 10, height: WALL_HEIGHT },
    { x1: 12, z1: 10, x2: 24, z2: 22, height: WALL_HEIGHT },
    { x1: -26, z1: 16, x2: -20, z2: 44, height: WALL_HEIGHT },
    { x1: 10, z1: 18, x2: 12, z2: 22, height: WALL_HEIGHT },
    { x1: -20, z1: 24, x2: -6, z2: 44, height: WALL_HEIGHT },
    { x1: -6, z1: 26, x2: 6, z2: 44, height: WALL_HEIGHT },
    { x1: 6, z1: 40, x2: 40, z2: 44, height: WALL_HEIGHT },
];

export const CRATES: CrateBox[] = [
    { x: 22, z: -19, width: 4.4, depth: 4.4, height: 2.4, style: "crate" },
    { x: 26.6, z: -18.6, width: 4.4, depth: 4.4, height: 2.4, style: "crate" },
    { x: 24.2, z: -23.2, width: 4.4, depth: 4.4, height: 4.8, style: "crate" },
    { x: 30.4, z: -22.6, width: 3.6, depth: 3.6, height: 2.4, style: "concrete" },
    { x: 17.6, z: -22.4, width: 3.6, depth: 3.6, height: 2.4, style: "crate" },
    { x: 15.4, z: -14.6, width: 5.2, depth: 3, height: 1.7, style: "car" },
    { x: 31.6, z: -12.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 36.4, z: -13.6, width: 3.2, depth: 3.2, height: 2.4, style: "concrete" },

    { x: -32.6, z: -19.4, width: 4.4, depth: 4.4, height: 2.4, style: "crate" },
    { x: -27.8, z: -19.8, width: 4.4, depth: 4.4, height: 2.4, style: "crate" },
    { x: -30.2, z: -23.4, width: 4.4, depth: 4.4, height: 4.8, style: "crate" },
    { x: -36.2, z: -22.6, width: 3.6, depth: 3.6, height: 2.4, style: "concrete" },
    { x: -36.4, z: -14.6, width: 5.2, depth: 3, height: 1.7, style: "car" },
    { x: -22.6, z: -14.2, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -24.6, z: -22.6, width: 3, depth: 3, height: 2.4, style: "barrel" },

    { x: 0, z: 3.6, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -3.4, z: -6.4, width: 3, depth: 3, height: 2.4, style: "concrete" },
    { x: 3.2, z: -11.6, width: 3.2, depth: 3.2, height: 2.4, style: "crate" },
    { x: -2.6, z: 15.4, width: 3, depth: 3, height: 2.4, style: "barrel" },

    { x: 9.4, z: -6.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 8.6, z: -19.4, width: 3, depth: 3, height: 2.4, style: "concrete" },

    { x: 37.2, z: 4.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 28.4, z: -3.6, width: 3.2, depth: 3.2, height: 2.4, style: "crate" },
    { x: 37, z: -6.6, width: 3, depth: 3, height: 2.4, style: "barrel" },
    { x: 30.6, z: 14.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 36.6, z: 20.6, width: 3.2, depth: 3.2, height: 2.4, style: "concrete" },

    { x: -22.4, z: 19.6, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -28.4, z: 1.4, width: 3, depth: 3, height: 2.4, style: "barrel" },
    { x: -23.4, z: -8.6, width: 3.2, depth: 3.2, height: 2.4, style: "crate" },

    { x: -19.6, z: -29.4, width: 3, depth: 3, height: 2.4, style: "concrete" },
    { x: 15.6, z: -28.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: -12.6, z: -35.4, width: 3, depth: 3, height: 2.4, style: "barrel" },
    { x: 6.4, z: -35.6, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },

    { x: 14.6, z: 33.6, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 36.4, z: 36.4, width: 3.4, depth: 3.4, height: 2.4, style: "crate" },
    { x: 22.6, z: 26.4, width: 3, depth: 3, height: 2.4, style: "barrel" },
];

export const GROUND_PATCHES: GroundPatch[] = [
    { x1: 6, z1: 22, x2: 40, z2: 40, style: "plaza" },
    { x1: 24, z1: 10, x2: 40, z2: 24, style: "sand" },
    { x1: 26, z1: -12, x2: 40, z2: 8, style: "sand" },
    { x1: 12, z1: -26, x2: 34, z2: -10, style: "site" },
    { x1: -40, z1: -26, x2: -18, z2: -10, style: "site" },
    { x1: -6, z1: -14, x2: 6, z2: 20, style: "tile" },
    { x1: -16, z1: -38, x2: 10, z2: -26, style: "plaza" },
    { x1: -30, z1: -6, x2: -18, z2: 6, style: "sand" },
    { x1: -26, z1: 4, x2: -16, z2: 16, style: "sand" },
    { x1: -20, z1: 14, x2: -4, z2: 24, style: "plaza" },
];

export const CALLOUTS: Callout[] = [
    { label: "T SPAWN", x: 30, z: 34 },
    { label: "OUTSIDE LONG", x: 32, z: 18 },
    { label: "LONG DOORS", x: 31, z: 9 },
    { label: "LONG A", x: 33, z: 0 },
    { label: "PIT", x: 35, z: -13 },
    { label: "A SITE", x: 22, z: -16 },
    { label: "GOOSE", x: 15, z: -23 },
    { label: "A SHORT", x: 10, z: -17 },
    { label: "CATWALK", x: 8, z: -7 },
    { label: "CT MID", x: 0, z: -8 },
    { label: "MID DOORS", x: 0, z: 4 },
    { label: "T MID", x: 0, z: 14 },
    { label: "XBOX", x: 0, z: 3.6 },
    { label: "UPPER TUNNEL", x: -12, z: 19 },
    { label: "TUNNEL RAMP", x: -21, z: 10 },
    { label: "LOWER TUNNEL", x: -24, z: 0 },
    { label: "B TUNNEL", x: -25, z: -8 },
    { label: "B SITE", x: -30, z: -16 },
    { label: "B PLAT", x: -36, z: -20 },
    { label: "B DOORS", x: -18, z: -28 },
    { label: "CT SPAWN", x: -3, z: -33 },
    { label: "A CROSS", x: 14, z: -28 },
];
