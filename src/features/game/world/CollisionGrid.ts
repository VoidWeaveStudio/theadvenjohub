//src\features\game\world\CollisionGrid.ts
import * as THREE from "three";

export class CollisionGrid {
    private cellSize: number;
    private cells: Map<string, THREE.Box3[]> = new Map();
    private tempBox: THREE.Box3 = new THREE.Box3();

    constructor(cellSize: number = 20) {
        this.cellSize = cellSize;
    }

    private getCellKey(x: number, z: number): string {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cz}`;
    }

    clear() {
        this.cells.clear();
    }

    insert(box: THREE.Box3) {
        const min = box.min;
        const max = box.max;

        const minCX = Math.floor(min.x / this.cellSize);
        const maxCX = Math.floor(max.x / this.cellSize);
        const minCZ = Math.floor(min.z / this.cellSize);
        const maxCZ = Math.floor(max.z / this.cellSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const key = `${cx},${cz}`;
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                this.cells.get(key)!.push(box);
            }
        }
    }

    query(position: THREE.Vector3, size: THREE.Vector3): THREE.Box3[] {
        const halfX = size.x / 2;
        const halfZ = size.z / 2;

        const minCX = Math.floor((position.x - halfX) / this.cellSize);
        const maxCX = Math.floor((position.x + halfX) / this.cellSize);
        const minCZ = Math.floor((position.z - halfZ) / this.cellSize);
        const maxCZ = Math.floor((position.z + halfZ) / this.cellSize);

        const result: THREE.Box3[] = [];
        const seen = new Set<THREE.Box3>();

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const key = `${cx},${cz}`;
                const cell = this.cells.get(key);
                if (!cell) continue;

                for (const box of cell) {
                    if (!seen.has(box)) {
                        seen.add(box);
                        result.push(box);
                    }
                }
            }
        }

        return result;
    }

    checkCollision(position: THREE.Vector3, size: THREE.Vector3): boolean {
        this.tempBox.setFromCenterAndSize(position, size);
        const candidates = this.query(position, size);

        for (const box of candidates) {
            if (box.intersectsBox(this.tempBox)) {
                return true;
            }
        }

        return false;
    }
}