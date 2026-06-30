// src/features/game/map/CollisionSystem.ts
import { CollisionBox3D, TriggerBox } from './types';
import { SpatialGrid3D } from './SpatialGrid3D';

export interface CollisionResult {
    collides: boolean;
    boxes: CollisionBox3D[];
    pushVector?: { x: number; y: number; z: number };
}

export interface TriggerEvent {
    triggerId: string;
    type: 'enter' | 'exit';
    entityId?: string;
}

export class CollisionSystem {
    private solidBoxes: CollisionBox3D[] = [];
    private waterBoxes: CollisionBox3D[] = [];
    private hazardBoxes: CollisionBox3D[] = [];
    private triggerBoxes: TriggerBox[] = [];
    private boundaryBoxes: CollisionBox3D[] = [];

    private solidGrid: SpatialGrid3D;
    private waterGrid: SpatialGrid3D;
    private triggerGrid: SpatialGrid3D;

    private activeTriggers = new Set<string>();
    private triggerListeners = new Set<(event: TriggerEvent) => void>();

    constructor(cellSize: number = 10) {
        this.solidGrid = new SpatialGrid3D(cellSize);
        this.waterGrid = new SpatialGrid3D(cellSize);
        this.triggerGrid = new SpatialGrid3D(cellSize);
    }

    addSolid(box: CollisionBox3D): void {
        this.solidBoxes.push(box);
        this.solidGrid.insert(box);
    }

    addWater(box: CollisionBox3D): void {
        this.waterBoxes.push(box);
        this.waterGrid.insert(box);
    }

    addHazard(box: CollisionBox3D): void {
        this.hazardBoxes.push(box);
    }

    addTrigger(box: TriggerBox): void {
        this.triggerBoxes.push(box);
        this.triggerGrid.insert(box);
    }

    addBoundary(box: CollisionBox3D): void {
        this.boundaryBoxes.push(box);
    }

    getSolidBoxes(): CollisionBox3D[] {
        return [...this.solidBoxes];
    }

    getWaterBoxes(): CollisionBox3D[] {
        return [...this.waterBoxes];
    }

    getHazardBoxes(): CollisionBox3D[] {
        return [...this.hazardBoxes];
    }

    getBoundaryBoxes(): CollisionBox3D[] {
        return [...this.boundaryBoxes];
    }

    removeSolid(box: CollisionBox3D): void {
        const idx = this.solidBoxes.indexOf(box);
        if (idx >= 0) {
            this.solidBoxes.splice(idx, 1);
            this.solidGrid.remove(box);
        }
    }

    checkCollision3D(
        x: number,
        y: number,
        z: number,
        radius: number,
        layer: 'solid' | 'all' = 'solid',
    ): boolean {
        const nearby = this.solidGrid.query(x, y, z, radius + 2);

        for (const box of nearby) {
            if (this.sphereAABB(x, y, z, radius, box)) {
                return true;
            }
        }

        if (layer === 'all') {
            for (const box of this.boundaryBoxes) {
                if (this.sphereAABB(x, y, z, radius, box)) return true;
            }
        }

        return false;
    }

    isInWater(x: number, y: number, z: number): boolean {
        const nearby = this.waterGrid.query(x, y, z, 1);
        for (const box of nearby) {
            if (this.pointInAABB(x, y, z, box)) return true;
        }
        return false;
    }

    isInHazard(x: number, y: number, z: number): CollisionBox3D | null {
        for (const box of this.hazardBoxes) {
            if (this.pointInAABB(x, y, z, box)) return box;
        }
        return null;
    }

    updateTriggers(x: number, y: number, z: number, entityId?: string): void {
        const nearby = this.triggerGrid.query(x, y, z, 2);
        const currentTriggers = new Set<string>();

        for (const box of nearby) {
            const trigger = box as TriggerBox;

            if (this.pointInAABB(x, y, z, trigger)) {
                currentTriggers.add(trigger.triggerId);

                if (!this.activeTriggers.has(trigger.triggerId)) {
                    this.activeTriggers.add(trigger.triggerId);
                    this.emitTriggerEvent({
                        triggerId: trigger.triggerId,
                        type: 'enter',
                        entityId,
                    });
                }
            }
        }

        for (const triggerId of this.activeTriggers) {
            if (!currentTriggers.has(triggerId)) {
                this.activeTriggers.delete(triggerId);
                this.emitTriggerEvent({
                    triggerId,
                    type: 'exit',
                    entityId,
                });
            }
        }
    }

    pushOutOfCollision(
        x: number,
        y: number,
        z: number,
        radius: number,
    ): { x: number; y: number; z: number } {
        const nearby = this.solidGrid.query(x, y, z, radius + 2);

        const result = { x, y, z };
        let iterations = 0;
        const maxIterations = 5;

        while (iterations < maxIterations) {
            let pushed = false;

            for (const box of nearby) {
                const push = this.computeMTD(result.x, result.y, result.z, radius, box);
                if (push) {
                    result.x += push.x;
                    result.y += push.y;
                    result.z += push.z;
                    pushed = true;
                }
            }

            if (!pushed) break;
            iterations++;
        }

        return result;
    }

    onTrigger(listener: (event: TriggerEvent) => void): () => void {
        this.triggerListeners.add(listener);
        return () => {
            this.triggerListeners.delete(listener);
        };
    }

    clear(): void {
        this.solidBoxes = [];
        this.waterBoxes = [];
        this.hazardBoxes = [];
        this.triggerBoxes = [];
        this.boundaryBoxes = [];
        this.solidGrid.clear();
        this.waterGrid.clear();
        this.triggerGrid.clear();
        this.activeTriggers.clear();
    }

    stats(): string {
        return `solid=${this.solidBoxes.length}, water=${this.waterBoxes.length}, ` +
            `hazard=${this.hazardBoxes.length}, trigger=${this.triggerBoxes.length}, ` +
            `boundary=${this.boundaryBoxes.length}`;
    }

    private sphereAABB(
        sx: number,
        sy: number,
        sz: number,
        radius: number,
        box: CollisionBox3D,
    ): boolean {
        const closestX = Math.max(box.minX, Math.min(sx, box.maxX));
        const closestY = Math.max(box.minY, Math.min(sy, box.maxY));
        const closestZ = Math.max(box.minZ, Math.min(sz, box.maxZ));

        const dx = sx - closestX;
        const dy = sy - closestY;
        const dz = sz - closestZ;

        return (dx * dx + dy * dy + dz * dz) < (radius * radius);
    }

    private pointInAABB(x: number, y: number, z: number, box: CollisionBox3D): boolean {
        return x >= box.minX && x <= box.maxX &&
            y >= box.minY && y <= box.maxY &&
            z >= box.minZ && z <= box.maxZ;
    }

    private computeMTD(
        sx: number,
        sy: number,
        sz: number,
        radius: number,
        box: CollisionBox3D,
    ): { x: number; y: number; z: number } | null {
        const closestX = Math.max(box.minX, Math.min(sx, box.maxX));
        const closestY = Math.max(box.minY, Math.min(sy, box.maxY));
        const closestZ = Math.max(box.minZ, Math.min(sz, box.maxZ));

        const dx = sx - closestX;
        const dy = sy - closestY;
        const dz = sz - closestZ;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq >= radius * radius) return null;

        const dist = Math.sqrt(distSq);

        if (dist < 0.001) {
            const dxMin = Math.min(Math.abs(sx - box.minX), Math.abs(sx - box.maxX));
            const dyMin = Math.min(Math.abs(sy - box.minY), Math.abs(sy - box.maxY));
            const dzMin = Math.min(Math.abs(sz - box.minZ), Math.abs(sz - box.maxZ));

            if (dxMin <= dyMin && dxMin <= dzMin) {
                return {
                    x: sx < (box.minX + box.maxX) / 2 ? -(dxMin + radius) : (dxMin + radius),
                    y: 0,
                    z: 0,
                };
            } else if (dyMin <= dxMin && dyMin <= dzMin) {
                return {
                    x: 0,
                    y: sy < (box.minY + box.maxY) / 2 ? -(dyMin + radius) : (dyMin + radius),
                    z: 0,
                };
            } else {
                return {
                    x: 0,
                    y: 0,
                    z: sz < (box.minZ + box.maxZ) / 2 ? -(dzMin + radius) : (dzMin + radius),
                };
            }
        }

        const penetration = radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        return {
            x: nx * penetration,
            y: ny * penetration,
            z: nz * penetration,
        };
    }

    private emitTriggerEvent(event: TriggerEvent): void {
        for (const listener of this.triggerListeners) {
            try {
                listener(event);
            } catch (err) {
                console.error('Trigger listener error:', err);
            }
        }
    }
}