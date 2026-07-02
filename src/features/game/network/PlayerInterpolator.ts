//src\features\game\network\PlayerInterpolator.ts
import * as THREE from 'three';

interface Snapshot {
    time: number;
    position: THREE.Vector3;
    rotation: THREE.Euler;
}

export class PlayerInterpolator {
    private snapshots: Snapshot[] = [];
    private renderDelay = 100;
    private lastVelocity = new THREE.Vector3(0, 0, 0);
    private lastUpdateTime = 0;

    addSnapshot(
        time: number, 
        position: {x: number, y: number, z: number}, 
        rotation: {x: number, y: number, z: number}, 
        velocity?: {x: number, z: number}
    ) {
        const pos = new THREE.Vector3(position.x, position.y, position.z);
        const rot = new THREE.Euler(rotation.x, rotation.y, rotation.z);
        
        this.snapshots.push({ time, position: pos, rotation: rot });
        
        if (this.snapshots.length > 3) {
            this.snapshots.shift();
        }

        this.lastUpdateTime = time;
        if (velocity) {
            this.lastVelocity.set(velocity.x, 0, velocity.z);
        }
    }

    getInterpolatedState(): { position: THREE.Vector3, rotation: THREE.Euler } | null {
        if (this.snapshots.length === 0) return null;

        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;

        if (timeSinceLastUpdate < 150 && this.snapshots.length >= 2) {
            const renderTime = now - this.renderDelay;

            for (let i = 0; i < this.snapshots.length - 1; i++) {
                const older = this.snapshots[i];
                const newer = this.snapshots[i + 1];

                if (older.time <= renderTime && newer.time >= renderTime) {
                    const t = (renderTime - older.time) / (newer.time - older.time);
                    const position = new THREE.Vector3().lerpVectors(older.position, newer.position, t);
                    const rotation = new THREE.Euler().copy(older.rotation); 
                    return { position, rotation };
                }
            }
        }

        const lastState = this.snapshots[this.snapshots.length - 1];
        const dt = (timeSinceLastUpdate - 150) / 1000;
        
        const maxExtrapolationTime = 0.5; 
        const clampedDt = Math.min(dt, maxExtrapolationTime);

        const position = lastState.position.clone().add(
            this.lastVelocity.clone().multiplyScalar(clampedDt)
        );

        return {
            position,
            rotation: lastState.rotation
        };
    }

    clear() {
        this.snapshots = [];
        this.lastVelocity.set(0, 0, 0);
        this.lastUpdateTime = 0;
    }
}