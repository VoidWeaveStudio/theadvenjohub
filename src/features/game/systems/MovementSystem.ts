//src\features\game\systems\MovementSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Entity } from "../entities/Entity";

export class MovementSystem extends System {
    private entities: Map<string, Entity> = new Map();
    private colliders: THREE.Box3[] = [];

    private tempBox: THREE.Box3 = new THREE.Box3();
    private tempSize: THREE.Vector3 = new THREE.Vector3(0.8, 2, 0.8);

    init() { }

    registerEntity(entity: Entity) {
        this.entities.set(entity.id, entity);
    }

    unregisterEntity(entityId: string) {
        this.entities.delete(entityId);
    }

    setColliders(colliders: THREE.Box3[]) {
        this.colliders = colliders;
    }

    update(delta: number) {
    }

    checkCollision(position: THREE.Vector3, size: THREE.Vector3 = this.tempSize): boolean {
        this.tempBox.setFromCenterAndSize(position, size);

        for (const collider of this.colliders) {
            if (collider.intersectsBox(this.tempBox)) {
                return true;
            }
        }

        return false;
    }

    dispose() {
        this.entities.clear();
    }
}