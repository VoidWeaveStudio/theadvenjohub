// src/features/game/world/locations/tower/TowerFloor.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { isSharedNpcGeometry } from "../../../entities/npcModel";
import { LiftCrystal } from "../../liftCrystal";

const ZERO = new THREE.Vector3(0, 0, 0);

export abstract class TowerFloor extends Location {
    public collisionGrid: CollisionGrid;
    public maxPlayerRadius: number | null = 9999;
    protected time: number = 0;
    protected centralCrystal!: THREE.Group;
    protected crystal: LiftCrystal | null = null;
    protected crystalBaseY: number = 0;

    constructor(id: string, name: string) {
        super(id, name);
        this.collisionGrid = new CollisionGrid(20);
    }

    protected createCentralCrystal(position?: THREE.Vector3) {
        this.crystal = new LiftCrystal();
        this.centralCrystal = this.crystal.group;

        this.centralCrystal.position.copy(position ?? ZERO);
        this.crystalBaseY = this.centralCrystal.position.y;
        this.scene.add(this.centralCrystal);

        this.centralCrystal.userData.interactionId = "tower-crystal";

        const { x, y, z } = this.centralCrystal.position;
        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - 1, y, z - 1),
            new THREE.Vector3(x + 1, y + 3, z + 1)
        ));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        if (this.centralCrystal) {
            this.crystal?.update(delta);
            this.centralCrystal.position.y = this.crystalBaseY + Math.sin(this.time * 1.5) * 0.2;
        }
    }

    public getInteractables(): THREE.Object3D[] {
        return this.centralCrystal ? [this.centralCrystal] : [];
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 4);
    }

    dispose() {
        this.collisionGrid.clear();
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                if (!isSharedNpcGeometry(mesh.geometry)) mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
    }
}