//src\features\game\world\CollisionGrid.ts
import * as THREE from "three";

type Cylinder = {
    center: THREE.Vector3;
    radius: number;
    halfHeight: number;
};

export class CollisionGrid {
    private cellSize: number;
    private cells: Map<number, THREE.Box3[]> = new Map();
    private tempBox: THREE.Box3 = new THREE.Box3();

    private seenPool: Set<THREE.Box3>[] = [];
    private seenPoolIndex: number = 0;

    private cylinders: Cylinder[] = [];

    public static readonly STEP_UP_HEIGHT = 0.6;

    constructor(cellSize: number = 20) {
        this.cellSize = cellSize;

        for (let i = 0; i < 10; i++) {
            this.seenPool.push(new Set<THREE.Box3>());
        }
    }

    private getCellKey(cx: number, cz: number): number {
        return (cx << 16) | (cz & 0xFFFF);
    }

    clear() {
        this.cells.clear();
        this.cylinders = [];
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
                const key = this.getCellKey(cx, cz);
                let cell = this.cells.get(key);
                if (!cell) {
                    cell = [];
                    this.cells.set(key, cell);
                }
                cell.push(box);
            }
        }
    }

    insertCylinder(center: THREE.Vector3, radius: number, height: number) {
        this.cylinders.push({
            center: center.clone(),
            radius,
            halfHeight: height / 2
        });
    }

    checkCylinderCollision(position: THREE.Vector3, size: THREE.Vector3): boolean {
        const halfHeight = size.y / 2;
        const playerBottom = position.y - halfHeight;
        const playerTop = position.y + halfHeight;

        const playerRadius = Math.max(size.x, size.z) / 2;

        for (const cyl of this.cylinders) {
            const cylBottom = cyl.center.y - cyl.halfHeight;
            const cylTop = cyl.center.y + cyl.halfHeight;

            if (playerTop < cylBottom || playerBottom > cylTop) continue;

            const dx = position.x - cyl.center.x;
            const dz = position.z - cyl.center.z;

            const distSq = dx * dx + dz * dz;
            const r = cyl.radius + playerRadius;

            if (distSq < r * r) {
                return true; 
            }
        }

        return false;
    }

    query(position: THREE.Vector3, size: THREE.Vector3): THREE.Box3[] {
        const halfX = size.x / 2;
        const halfZ = size.z / 2;

        const minCX = Math.floor((position.x - halfX) / this.cellSize);
        const maxCX = Math.floor((position.x + halfX) / this.cellSize);
        const minCZ = Math.floor((position.z - halfZ) / this.cellSize);
        const maxCZ = Math.floor((position.z + halfZ) / this.cellSize);

        const result: THREE.Box3[] = [];

        const seen = this.seenPool[this.seenPoolIndex];
        this.seenPoolIndex = (this.seenPoolIndex + 1) % this.seenPool.length;
        seen.clear();

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cz = minCZ; cz <= maxCZ; cz++) {
                const key = this.getCellKey(cx, cz);
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

    checkCollisionHorizontal(position: THREE.Vector3, size: THREE.Vector3): boolean {
        this.tempBox.setFromCenterAndSize(position, size);
        
        if (this.checkCylinderCollision(position, size)) {
            return true;
        }

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

    checkCollision(position: THREE.Vector3, size: THREE.Vector3): boolean {
        this.tempBox.setFromCenterAndSize(position, size);

        if (this.checkCylinderCollision(position, size)) {
            return true;
        }

        const candidates = this.query(position, size);

        for (const box of candidates) {
            if (box.intersectsBox(this.tempBox)) {
                return true;
            }
        }

        return false;
    }
}