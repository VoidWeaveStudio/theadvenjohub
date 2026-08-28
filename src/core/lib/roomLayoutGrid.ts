// src/core/lib/roomLayoutGrid.ts
export const CELL_SIZE = 2;
export const LEVEL_HEIGHT = 3;

export const SPAWN_BEACON_PIECE = "spawn-beacon";
export const STORAGE_CRATE_PIECE = "storage-crate";
export const FACTION_TURRET_PIECE = "faction-turret";
export const FACTION_TURRET_COST_ASH = 4000;
export const FACTION_TURRET_MAX = 12;

const BEACON_STAND_DISTANCE = 1.4;

export interface LayoutPieceLike {
    t: string;
    x: number;
    z: number;
    l: number;
    r: number;
}

export interface WorldPoint {
    x: number;
    y: number;
    z: number;
}

export interface StorageFixture {
    key: string;
    x: number;
    y: number;
    z: number;
}

export interface LayoutFixtures {
    homeSpawn: WorldPoint | null;
    storages: StorageFixture[];
}

export function cellToWorld(cell: number, plotSize: number): number {
    return (cell + 0.5) * CELL_SIZE - plotSize / 2;
}

export function levelBaseY(level: number): number {
    return level * LEVEL_HEIGHT;
}

export function objectPieceKey(piece: LayoutPieceLike): string {
    return `o:${piece.l}:${piece.x}:${piece.z}`;
}

function isLayoutPiece(raw: unknown): raw is LayoutPieceLike {
    if (!raw || typeof raw !== "object") return false;
    const piece = raw as Record<string, unknown>;
    return (
        typeof piece.t === "string" &&
        Number.isInteger(piece.x) &&
        Number.isInteger(piece.z) &&
        Number.isInteger(piece.l) &&
        Number.isInteger(piece.r)
    );
}

export function readLayoutPieces(raw: unknown): { pieces: LayoutPieceLike[]; plotSize: number } {
    if (!raw || typeof raw !== "object") return { pieces: [], plotSize: 100 };

    const data = raw as Record<string, unknown>;
    const plotSize = Number.isFinite(data.plot) ? Number(data.plot) : 100;
    const list = Array.isArray(data.pieces) ? data.pieces : [];

    return { pieces: list.filter(isLayoutPiece), plotSize };
}

export function countPieces(pieces: LayoutPieceLike[], type: string): number {
    return pieces.reduce((total, piece) => (piece.t === type ? total + 1 : total), 0);
}

export function readLayoutFixtures(raw: unknown): LayoutFixtures {
    const { pieces, plotSize } = readLayoutPieces(raw);

    let homeSpawn: WorldPoint | null = null;
    const storages: StorageFixture[] = [];

    for (const piece of pieces) {
        const x = cellToWorld(piece.x, plotSize);
        const z = cellToWorld(piece.z, plotSize);
        const y = levelBaseY(piece.l);

        if (piece.t === SPAWN_BEACON_PIECE && !homeSpawn) {
            const yaw = (piece.r * Math.PI) / 2;
            homeSpawn = {
                x: x + Math.sin(yaw) * BEACON_STAND_DISTANCE,
                y,
                z: z + Math.cos(yaw) * BEACON_STAND_DISTANCE,
            };
            continue;
        }

        if (piece.t === STORAGE_CRATE_PIECE) {
            storages.push({ key: objectPieceKey(piece), x, y, z });
        }
    }

    return { homeSpawn, storages };
}
