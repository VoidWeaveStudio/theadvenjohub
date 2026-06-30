// src/features/game/map/SpatialGrid3D.ts
import { CollisionBox3D } from './types';


export class SpatialGrid3D {
    private cells = new Map<number, CollisionBox3D[]>();
    private readonly cellSize: number;
    private readonly inverseCellSize: number;

    constructor(cellSize: number = 10) {
        this.cellSize = cellSize;
        this.inverseCellSize = 1 / cellSize;
    }

    insert(box: CollisionBox3D): void {
        const minCX = Math.floor(box.minX * this.inverseCellSize);
        const maxCX = Math.floor(box.maxX * this.inverseCellSize);
        const minCY = Math.floor(box.minY * this.inverseCellSize);
        const maxCY = Math.floor(box.maxY * this.inverseCellSize);
        const minCZ = Math.floor(box.minZ * this.inverseCellSize);
        const maxCZ = Math.floor(box.maxZ * this.inverseCellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const key = this.packKey(cx, cy, cz);
                    let cell = this.cells.get(key);
                    if (!cell) {
                        cell = [];
                        this.cells.set(key, cell);
                    }
                    cell.push(box);
                }
            }
        }
    }

    remove(box: CollisionBox3D): void {
        const minCX = Math.floor(box.minX * this.inverseCellSize);
        const maxCX = Math.floor(box.maxX * this.inverseCellSize);
        const minCY = Math.floor(box.minY * this.inverseCellSize);
        const maxCY = Math.floor(box.maxY * this.inverseCellSize);
        const minCZ = Math.floor(box.minZ * this.inverseCellSize);
        const maxCZ = Math.floor(box.maxZ * this.inverseCellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const key = this.packKey(cx, cy, cz);
                    const cell = this.cells.get(key);
                    if (cell) {
                        const idx = cell.indexOf(box);
                        if (idx >= 0) cell.splice(idx, 1);
                        if (cell.length === 0) this.cells.delete(key);
                    }
                }
            }
        }
    }

    query(x: number, y: number, z: number, radius: number): CollisionBox3D[] {
        const nearby: CollisionBox3D[] = [];
        const seen = new Set<CollisionBox3D>();

        const minCX = Math.floor((x - radius) * this.inverseCellSize);
        const maxCX = Math.floor((x + radius) * this.inverseCellSize);
        const minCY = Math.floor((y - radius) * this.inverseCellSize);
        const maxCY = Math.floor((y + radius) * this.inverseCellSize);
        const minCZ = Math.floor((z - radius) * this.inverseCellSize);
        const maxCZ = Math.floor((z + radius) * this.inverseCellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const cell = this.cells.get(this.packKey(cx, cy, cz));
                    if (!cell) continue;
                    for (const box of cell) {
                        if (!seen.has(box)) {
                            seen.add(box);
                            nearby.push(box);
                        }
                    }
                }
            }
        }

        return nearby;
    }

    clear(): void {
        this.cells.clear();
    }

    size(): number {
        return this.cells.size;
    }

    private packKey(cx: number, cy: number, cz: number): number {
        return ((cx + 2048) << 22) | ((cz + 2048) << 12) | (cy + 2048);
    }
}