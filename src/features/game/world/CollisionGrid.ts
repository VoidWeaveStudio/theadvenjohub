// src/features/game/world/CollisionGrid.ts
import * as THREE from "three";

type Cylinder = {
    center: THREE.Vector3;
    radius: number;
    halfHeight: number;
};

type OrientedBox = {
    x: number;
    z: number;
    halfWidth: number;
    halfDepth: number;
    cos: number;
    sin: number;
    minY: number;
    maxY: number;
};

type RingWall = {
    radius: number;
    thickness: number;
    minY: number;
    maxY: number;
    gaps: { angle: number; halfAngle: number }[];
};

type Platform = {
    innerRadius: number;
    outerRadius: number;
    minY: number;
    maxY: number;
};

const FEET_TOLERANCE = 0.1;

function normalizeAngle(value: number): number {
    let result = value;
    while (result > Math.PI) result -= Math.PI * 2;
    while (result < -Math.PI) result += Math.PI * 2;
    return result;
}

export class CollisionGrid {
    private cellSize: number;
    private cells: Map<number, THREE.Box3[]> = new Map();
    private tempBox: THREE.Box3 = new THREE.Box3();

    private seenPool: Set<THREE.Box3>[] = [];
    private seenPoolIndex: number = 0;

    private cylinders: Cylinder[] = [];
    private orientedBoxes: OrientedBox[] = [];
    private ringWalls: RingWall[] = [];
    private platforms: Platform[] = [];

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
        this.orientedBoxes = [];
        this.ringWalls = [];
        this.platforms = [];
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

    insertOrientedBox(
        centerX: number,
        centerZ: number,
        width: number,
        depth: number,
        rotation: number,
        minY: number,
        maxY: number
    ) {
        this.orientedBoxes.push({
            x: centerX,
            z: centerZ,
            halfWidth: width / 2,
            halfDepth: depth / 2,
            cos: Math.cos(rotation),
            sin: Math.sin(rotation),
            minY,
            maxY,
        });
    }

    insertRingWall(
        radius: number,
        thickness: number,
        minY: number,
        maxY: number,
        gaps: { angle: number; halfAngle: number }[] = []
    ) {
        this.ringWalls.push({ radius, thickness, minY, maxY, gaps });
    }

    insertPlatform(innerRadius: number, outerRadius: number, minY: number, maxY: number) {
        this.platforms.push({ innerRadius, outerRadius, minY, maxY });
    }

    private overlapsOrientedBox(box: OrientedBox, x: number, z: number, radius: number): boolean {
        const dx = x - box.x;
        const dz = z - box.z;

        const localX = dx * box.cos - dz * box.sin;
        const localZ = dx * box.sin + dz * box.cos;

        const clampedX = Math.max(-box.halfWidth, Math.min(box.halfWidth, localX));
        const clampedZ = Math.max(-box.halfDepth, Math.min(box.halfDepth, localZ));

        const offsetX = localX - clampedX;
        const offsetZ = localZ - clampedZ;

        return offsetX * offsetX + offsetZ * offsetZ < radius * radius;
    }

    private overlapsRingWall(wall: RingWall, x: number, z: number, radius: number): boolean {
        const distance = Math.hypot(x, z);
        if (Math.abs(distance - wall.radius) > wall.thickness + radius) return false;

        if (wall.gaps.length > 0) {
            const angle = Math.atan2(x, -z);
            for (const gap of wall.gaps) {
                if (Math.abs(normalizeAngle(angle - gap.angle)) < gap.halfAngle) return false;
            }
        }

        return true;
    }

    private overlapsPlatform(platform: Platform, x: number, z: number, radius: number): boolean {
        const distance = Math.hypot(x, z);
        return distance >= platform.innerRadius - radius && distance <= platform.outerRadius + radius;
    }

    private blocksHorizontally(minY: number, maxY: number, feetY: number, headY: number, stepUp: number): boolean {
        if (minY >= headY) return false;
        if (maxY <= feetY + FEET_TOLERANCE) return false;

        const heightDiff = maxY - feetY;
        if (heightDiff > 0 && heightDiff <= stepUp) return false;

        return true;
    }

    private checkVolumeCollision(
        position: THREE.Vector3,
        size: THREE.Vector3,
        stepUp: number
    ): boolean {
        const halfHeight = size.y / 2;
        const feetY = position.y - halfHeight;
        const headY = position.y + halfHeight;
        const radius = Math.max(size.x, size.z) / 2;

        for (const cyl of this.cylinders) {
            const bottom = cyl.center.y - cyl.halfHeight;
            const top = cyl.center.y + cyl.halfHeight;
            if (stepUp > 0) {
                if (!this.blocksHorizontally(bottom, top, feetY, headY, stepUp)) continue;
            } else if (headY < bottom || feetY > top) {
                continue;
            }

            const dx = position.x - cyl.center.x;
            const dz = position.z - cyl.center.z;
            const r = cyl.radius + radius;
            if (dx * dx + dz * dz < r * r) return true;
        }

        for (const box of this.orientedBoxes) {
            if (stepUp > 0) {
                if (!this.blocksHorizontally(box.minY, box.maxY, feetY, headY, stepUp)) continue;
            } else if (headY < box.minY || feetY > box.maxY) {
                continue;
            }
            if (this.overlapsOrientedBox(box, position.x, position.z, radius)) return true;
        }

        for (const wall of this.ringWalls) {
            if (stepUp > 0) {
                if (!this.blocksHorizontally(wall.minY, wall.maxY, feetY, headY, stepUp)) continue;
            } else if (headY < wall.minY || feetY > wall.maxY) {
                continue;
            }
            if (this.overlapsRingWall(wall, position.x, position.z, radius)) return true;
        }

        for (const platform of this.platforms) {
            if (stepUp > 0) {
                if (!this.blocksHorizontally(platform.minY, platform.maxY, feetY, headY, stepUp)) continue;
            } else if (headY < platform.minY || feetY > platform.maxY) {
                continue;
            }
            if (this.overlapsPlatform(platform, position.x, position.z, radius)) return true;
        }

        return false;
    }

    private highestVolumeSurface(
        x: number,
        z: number,
        floor: number,
        ceiling: number,
        probeRadius: number
    ): number {
        let highest = -Infinity;

        for (const box of this.orientedBoxes) {
            if (box.maxY > ceiling || box.maxY < floor || box.maxY <= highest) continue;
            if (this.overlapsOrientedBox(box, x, z, probeRadius)) highest = box.maxY;
        }

        for (const platform of this.platforms) {
            if (platform.maxY > ceiling || platform.maxY < floor || platform.maxY <= highest) continue;
            if (this.overlapsPlatform(platform, x, z, probeRadius)) highest = platform.maxY;
        }

        return highest;
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
        maxFallDistance: number = 2.5,
        maxStepUp: number = 0
    ): { found: boolean; platformY: number } {
        const feetY = position.y - playerHeight / 2;
        const ceiling = feetY + Math.max(0.1, maxStepUp);

        const searchBox = new THREE.Box3(
            new THREE.Vector3(position.x - 0.4, feetY - maxFallDistance, position.z - 0.4),
            new THREE.Vector3(position.x + 0.4, ceiling, position.z + 0.4)
        );

        const candidates = this.query(position, new THREE.Vector3(1, maxFallDistance + playerHeight + 1, 1));

        let highestPlatform = -Infinity;
        let found = false;

        for (const box of candidates) {
            const intersectsX = searchBox.max.x > box.min.x && searchBox.min.x < box.max.x;
            const intersectsZ = searchBox.max.z > box.min.z && searchBox.min.z < box.max.z;

            if (intersectsX && intersectsZ) {
                if (box.max.y <= ceiling && box.max.y >= feetY - maxFallDistance) {
                    if (box.max.y > highestPlatform) {
                        highestPlatform = box.max.y;
                        found = true;
                    }
                }
            }
        }

        const volumeSurface = this.highestVolumeSurface(
            position.x,
            position.z,
            feetY - maxFallDistance,
            ceiling,
            0.4
        );

        if (volumeSurface > highestPlatform) {
            highestPlatform = volumeSurface;
            found = true;
        }

        return { found, platformY: highestPlatform };
    }

    checkCollisionHorizontal(position: THREE.Vector3, size: THREE.Vector3): boolean {
        this.tempBox.setFromCenterAndSize(position, size);

        if (this.checkVolumeCollision(position, size, CollisionGrid.STEP_UP_HEIGHT)) {
            return true;
        }

        const candidates = this.query(position, size);

        const feetY = position.y - size.y / 2;
        const headY = position.y + size.y / 2;

        for (const box of candidates) {
            const intersectsX = this.tempBox.max.x > box.min.x && this.tempBox.min.x < box.max.x;
            const intersectsZ = this.tempBox.max.z > box.min.z && this.tempBox.min.z < box.max.z;

            if (intersectsX && intersectsZ) {
                if (box.min.y >= headY) {
                    continue;
                }

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

        if (this.checkVolumeCollision(position, size, 0)) {
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