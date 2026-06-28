//src\features\game\map\SpatialGrid.ts
import { CollisionBox } from '../types';

export class SpatialGrid {
    private cells = new Map<string, CollisionBox[]>();
    private cellSize: number;

    constructor(cellSize: number = 10) {
        this.cellSize = cellSize;
    }

    clear() {
        this.cells.clear();
    }

    private getKey(x: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cz}`;
    }

    insert(box: CollisionBox) {
        const minCX = Math.floor(box.minX / this.cellSize);
        const maxCX = Math.floor(box.maxX / this.cellSize);
        const minCZ = Math.floor(box.minZ / this.cellSize);
        const maxCZ = Math.floor(box.maxZ / this.cellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const key = `${cx},${cz}`;
                if (!this.cells.has(key)) this.cells.set(key, []);
                this.cells.get(key)!.push(box);
            }
        }
    }

    query(x: number, z: number, radius: number): CollisionBox[] {
        const nearby: CollisionBox[] = [];
        const seen = new Set<CollisionBox>();

        const minCX = Math.floor((x - radius) / this.cellSize);
        const maxCX = Math.floor((x + radius) / this.cellSize);
        const minCZ = Math.floor((z - radius) / this.cellSize);
        const maxCZ = Math.floor((z + radius) / this.cellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const cell = this.cells.get(`${cx},${cz}`);
                if (!cell) continue;
                for (const box of cell) {
                    if (!seen.has(box)) {
                        seen.add(box);
                        nearby.push(box);
                    }
                }
            }
        }

        return nearby;
    }

    size(): number {
        return this.cells.size;
    }
}