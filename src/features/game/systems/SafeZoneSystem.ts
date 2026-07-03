//src\features\game\systems\SafeZoneSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { SafeZone } from "../world/SafeZone";

export class SafeZoneSystem extends System {
    private safeZone!: SafeZone;

    init(safeZone: SafeZone) {
        this.safeZone = safeZone;
    }

    isInSafeZone(position: THREE.Vector3): boolean {
        const dx = position.x - this.safeZone.getPosition().x;
        const dz = position.z - this.safeZone.getPosition().z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist <= this.safeZone.getRadius(); 
    }

    distanceToCenter(position: THREE.Vector3): number {
        return position.distanceTo(this.safeZone.getPosition());
    }

    update(_delta: number) { }
    dispose() { }
}