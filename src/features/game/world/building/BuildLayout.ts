// src/features/game/world/building/BuildLayout.ts
import { getBuildEntry, CELL_SIZE, LEVEL_HEIGHT, type BuildLayer } from "./BuildCatalog";

const TILE_LAYERS: BuildLayer[] = ["stairs", "floor", "ground", "ceiling", "roof"];

export const MAX_LEVELS = 6;
export const PERSONAL_PLOT_SIZE = 100;

export const FACTION_PLOT_SIZE = 500;

const FACTION_EXTENT_BY_LEVEL: Array<{ level: number; extent: number }> = [
    { level: 20, extent: 2000 },
    { level: 15, extent: 1500 },
    { level: 10, extent: 1000 },
];

export const FACTION_MAX_EXTENT = 2000;

export function factionPlotExtent(level: number): number {
    for (const step of FACTION_EXTENT_BY_LEVEL) {
        if (level >= step.level) return step.extent;
    }
    return FACTION_PLOT_SIZE;
}

export interface CellBounds {
    min: number;
    max: number;
}

export function cellBounds(plotSize: number, extent: number = plotSize): CellBounds {
    const grow = Math.max(0, Math.floor((extent - plotSize) / 2 / CELL_SIZE));
    return { min: grow === 0 ? 0 : -grow, max: cellsAcross(plotSize) - 1 + grow };
}

export interface BuildPiece {
    t: string;
    x: number;
    z: number;
    l: number;
    r: number;
    d?: string;
}

const MAX_PAINT_URL = 300;

export interface BuildEnvironment {
    sky: string;
    light: string;
}

export interface BuildLayoutData {
    v: number;
    plot: number;
    env: BuildEnvironment;
    pieces: BuildPiece[];
}

export const DEFAULT_ENVIRONMENT: BuildEnvironment = { sky: "day", light: "noon" };

export function plotSizeFor(isFactionRoom: boolean): number {
    return isFactionRoom ? FACTION_PLOT_SIZE : PERSONAL_PLOT_SIZE;
}

export function cellsAcross(plotSize: number): number {
    return Math.floor(plotSize / CELL_SIZE);
}

export function cellToWorld(cell: number, plotSize: number): number {
    return (cell + 0.5) * CELL_SIZE - plotSize / 2;
}

export function worldToCell(world: number, plotSize: number): number {
    return Math.floor((world + plotSize / 2) / CELL_SIZE);
}

export function levelBaseY(level: number): number {
    return level * LEVEL_HEIGHT;
}

export function tileKey(layer: BuildLayer, level: number, x: number, z: number): string {
    return `t:${layer}:${level}:${x}:${z}`;
}

export function pieceKey(piece: BuildPiece): string {
    const entry = getBuildEntry(piece.t);
    if (!entry) return `x:${piece.t}:${piece.l}:${piece.x}:${piece.z}:${piece.r}`;

    if (entry.attachesToWall) return `a:${piece.l}:${piece.x}:${piece.z}:${piece.r}`;
    if (entry.slot === "edge") return `e:${piece.l}:${piece.x}:${piece.z}:${piece.r}`;
    if (entry.slot === "object") return `o:${piece.l}:${piece.x}:${piece.z}`;
    return `t:${entry.layer}:${piece.l}:${piece.x}:${piece.z}`;
}

export function isPieceInBounds(piece: BuildPiece, plotSize: number, extent: number = plotSize): boolean {
    const bounds = cellBounds(plotSize, extent);
    return (
        Number.isInteger(piece.x) && Number.isInteger(piece.z) && Number.isInteger(piece.l) &&
        piece.x >= bounds.min && piece.x <= bounds.max &&
        piece.z >= bounds.min && piece.z <= bounds.max &&
        piece.l >= 0 && piece.l < MAX_LEVELS
    );
}

export function sanitizePiece(raw: unknown, plotSize: number, extent: number = plotSize): BuildPiece | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;

    const t = typeof source.t === "string" ? source.t : null;
    if (!t || !getBuildEntry(t)) return null;

    const piece: BuildPiece = {
        t,
        x: Math.floor(Number(source.x)),
        z: Math.floor(Number(source.z)),
        l: Math.floor(Number(source.l)),
        r: ((Math.floor(Number(source.r)) % 4) + 4) % 4,
    };

    if (!Number.isFinite(piece.x) || !Number.isFinite(piece.z) || !Number.isFinite(piece.l)) return null;
    if (!isPieceInBounds(piece, plotSize, extent)) return null;

    if (typeof source.d === "string" && source.d.length <= MAX_PAINT_URL && /^https?:\/\//.test(source.d)) {
        piece.d = source.d;
    }

    return piece;
}

export class BuildLayout {
    public environment: BuildEnvironment = { ...DEFAULT_ENVIRONMENT };
    public extent: number;

    private pieces = new Map<string, BuildPiece>();

    constructor(public readonly plotSize: number) {
        this.extent = plotSize;
    }

    public get bounds(): CellBounds {
        return cellBounds(this.plotSize, this.extent);
    }

    public get size(): number {
        return this.pieces.size;
    }

    public list(): BuildPiece[] {
        return Array.from(this.pieces.values());
    }

    public at(key: string): BuildPiece | undefined {
        return this.pieces.get(key);
    }

    public findAt(level: number, x: number, z: number, rotation: number): { key: string; piece: BuildPiece } | null {
        const probes = [
            `a:${level}:${x}:${z}:${rotation}`,
            `e:${level}:${x}:${z}:${rotation}`,
            `o:${level}:${x}:${z}`,
        ];
        for (let r = 0; r < 4; r++) probes.push(`a:${level}:${x}:${z}:${r}`);
        for (let r = 0; r < 4; r++) probes.push(`e:${level}:${x}:${z}:${r}`);
        for (const layer of TILE_LAYERS) probes.push(`t:${layer}:${level}:${x}:${z}`);

        for (const key of probes) {
            const piece = this.pieces.get(key);
            if (piece) return { key, piece };
        }
        return null;
    }

    public place(piece: BuildPiece): { changed: boolean; key: string; replaced: BuildPiece | null } {
        const key = pieceKey(piece);
        const replaced = this.pieces.get(key) ?? null;

        if (replaced && replaced.t === piece.t && replaced.r === piece.r && replaced.d === piece.d) {
            return { changed: false, key, replaced };
        }

        this.pieces.set(key, piece);
        return { changed: true, key, replaced };
    }

    public removeAt(key: string): BuildPiece | null {
        const existing = this.pieces.get(key);
        if (!existing) return null;
        this.pieces.delete(key);
        return existing;
    }

    public clear() {
        this.pieces.clear();
    }

    public serialize(): BuildLayoutData {
        return {
            v: 1,
            plot: this.plotSize,
            env: { ...this.environment },
            pieces: this.list(),
        };
    }

    public load(data: unknown) {
        this.pieces.clear();
        this.environment = { ...DEFAULT_ENVIRONMENT };

        if (!data || typeof data !== "object") return;
        const source = data as Record<string, unknown>;

        const env = source.env as Record<string, unknown> | undefined;
        if (env) {
            if (typeof env.sky === "string") this.environment.sky = env.sky;
            if (typeof env.light === "string") this.environment.light = env.light;
        }

        const rawPieces = Array.isArray(source.pieces) ? source.pieces : [];
        for (const raw of rawPieces) {
            const piece = sanitizePiece(raw, this.plotSize);
            if (!piece) continue;
            this.pieces.set(pieceKey(piece), piece);
        }
    }
}
