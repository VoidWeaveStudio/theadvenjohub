//src\features\game\world\CollisionGrid.ts
import * as THREE from "three";

export class CollisionGrid {
    private cellSize: number;
    private cells: Map<string, THREE.Box3[]> = new Map();
    private tempBox: THREE.Box3 = new THREE.Box3();

    public static readonly STEP_UP_HEIGHT = 0.6;

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

    checkCollisionHorizontal(position: THREE.Vector3, size: THREE.Vector3): boolean {
        this.tempBox.setFromCenterAndSize(position, size);
        const candidates = this.query(position, size);

        const feetY = position.y - size.y / 2;
        const FEET_TOLERANCE = 0.1;

        for (const box of candidates) {
            const intersectsX = this.tempBox.max.x > box.min.x && this.tempBox.min.x < box.max.x;
            const intersectsZ = this.tempBox.max.z > box.min.z && this.tempBox.min.z < box.max.z;

            if (intersectsX && intersectsZ) {
                if (box.max.y <= feetY + FEET_TOLERANCE) {
                    continue;
                }

                const heightDiff = box.max.y - feetY;
                if (heightDiff > 0 && heightDiff <= CollisionGrid.STEP_UP_HEIGHT) {
                    continue;
                }

                return true;
            }
        }

        return false;
    }

    checkPlatformBelow(
        position: THREE.Vector3,
        playerHeight: number,
        maxFallDistance: number = 2.5
    ): { found: boolean; platformY: number } {
        const feetY = position.y - playerHeight / 2;

        const searchBox = new THREE.Box3(
            new THREE.Vector3(position.x - 0.4, feetY - maxFallDistance, position.z - 0.4),
            new THREE.Vector3(position.x + 0.4, feetY + 0.1, position.z + 0.4)
        );

        const candidates = this.query(position, new THREE.Vector3(1, maxFallDistance + playerHeight + 1, 1));

        let highestPlatform = -Infinity;
        let found = false;

        for (const box of candidates) {
            const intersectsX = searchBox.max.x > box.min.x && searchBox.min.x < box.max.x;
            const intersectsZ = searchBox.max.z > box.min.z && searchBox.min.z < box.max.z;

            if (intersectsX && intersectsZ) {
                if (box.max.y <= feetY + 0.1 && box.max.y >= feetY - maxFallDistance) {
                    if (box.max.y > highestPlatform) {
                        highestPlatform = box.max.y;
                        found = true;
                    }
                }
            }
        }

        return { found, platformY: highestPlatform };
    }

    checkStepUp(position: THREE.Vector3, size: THREE.Vector3): { canStep: boolean; stepHeight: number } {
        this.tempBox.setFromCenterAndSize(position, size);
        const candidates = this.query(position, size);

        const feetY = position.y - size.y / 2;
        let highestStep = -Infinity;
        let found = false;

        for (const box of candidates) {
            const intersectsX = this.tempBox.max.x > box.min.x && this.tempBox.min.x < box.max.x;
            const intersectsZ = this.tempBox.max.z > box.min.z && this.tempBox.min.z < box.max.z;

            if (intersectsX && intersectsZ) {
                const heightDiff = box.max.y - feetY;
                if (heightDiff > 0 && heightDiff <= CollisionGrid.STEP_UP_HEIGHT) {
                    if (box.max.y > highestStep) {
                        highestStep = box.max.y;
                        found = true;
                    }
                }
            }
        }

        return { canStep: found, stepHeight: highestStep };
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