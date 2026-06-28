//src\features\game\network\PlayerInterpolator.ts
import * as THREE from 'three';

interface Snapshot {
    time: number;        
    position: THREE.Vector3;
    rotation: THREE.Euler;
}

export class PlayerInterpolator {
    private buffer: Snapshot[] = [];
    private readonly BUFFER_DELAY = 100; 
    private readonly MAX_BUFFER_SIZE = 20; 
    
    private lastServerTime: number = 0;
    private serverTimeOffset: number = 0; 

    addSnapshot(serverTime: number, position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }) {
        const snapshot: Snapshot = {
            time: serverTime,
            position: new THREE.Vector3(position.x, position.y || 0, position.z),
            rotation: new THREE.Euler(rotation.x, rotation.y, rotation.z)
        };

        const now = Date.now();
        this.serverTimeOffset = now - serverTime;
        this.lastServerTime = serverTime;

        this.buffer.push(snapshot);
        this.buffer.sort((a, b) => a.time - b.time);

        while (this.buffer.length > this.MAX_BUFFER_SIZE) {
            this.buffer.shift();
        }
    }

    getInterpolatedState(): { position: THREE.Vector3; rotation: THREE.Euler } | null {
        if (this.buffer.length < 2) {
            if (this.buffer.length === 1) {
                return {
                    position: this.buffer[0].position.clone(),
                    rotation: this.buffer[0].rotation.clone()
                };
            }
            return null;
        }

        const renderTime = Date.now() - this.serverTimeOffset - this.BUFFER_DELAY;

        let before: Snapshot | null = null;
        let after: Snapshot | null = null;

        for (let i = 0; i < this.buffer.length - 1; i++) {
            const curr = this.buffer[i];
            const next = this.buffer[i + 1];
            if (curr.time <= renderTime && next.time >= renderTime) {
                before = curr;
                after = next;
                break;
            }
        }

        if (!before && !after) {
            const last = this.buffer[this.buffer.length - 1];
            return {
                position: last.position.clone(),
                rotation: last.rotation.clone()
            };
        }

        if (!before) {
            return {
                position: this.buffer[0].position.clone(),
                rotation: this.buffer[0].rotation.clone()
            };
        }

        const t = (renderTime - before.time) / (after!.time - before.time);
        const clampedT = Math.max(0, Math.min(1, t));

        const position = new THREE.Vector3().lerpVectors(before.position, after!.position, clampedT);
        
        const rotation = new THREE.Euler(
            before.rotation.x + (after!.rotation.x - before.rotation.x) * clampedT,
            before.rotation.y + (after!.rotation.y - before.rotation.y) * clampedT,
            before.rotation.z + (after!.rotation.z - before.rotation.z) * clampedT
        );

        return { position, rotation };
    }

    clear() {
        this.buffer = [];
    }

    isEmpty(): boolean {
        return this.buffer.length === 0;
    }
}