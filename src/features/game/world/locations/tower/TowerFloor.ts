// src/features/game/world/locations/tower/TowerFloor.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";

export abstract class TowerFloor extends Location {
    public collisionGrid: CollisionGrid;
    protected time: number = 0;
    protected centralCrystal!: THREE.Group;

    constructor(id: string, name: string) {
        super(id, name);
        this.collisionGrid = new CollisionGrid(20);
    }

    protected createCentralCrystal() {
        this.centralCrystal = new THREE.Group();

        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.8, 1),
            new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 })
        );
        core.position.y = 1.5;
        core.castShadow = true;

        const shell = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.5, 1),
            new THREE.MeshPhysicalMaterial({
                color: 0x99ddff, transmission: 1, opacity: 0.6,
                transparent: true, roughness: 0, thickness: 0.5
            })
        );
        shell.position.y = 1.5;

        const light = new THREE.PointLight(0x66ccff, 9, 45);
        light.position.y = 1.5;
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;

        this.centralCrystal.add(core, shell, light);
        this.centralCrystal.position.set(0, 0, 0);
        this.scene.add(this.centralCrystal);

        this.centralCrystal.userData.interactionId = "tower-crystal";

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 3, 1)
        ));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        if (this.centralCrystal) {
            this.centralCrystal.rotation.y += delta * 0.6;
            this.centralCrystal.position.y = Math.sin(this.time * 1.5) * 0.2;
        }
    }

    public getInteractables(): THREE.Object3D[] {
        return [this.centralCrystal];
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 4);
    }

    dispose() {
        this.collisionGrid.clear();
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
    }
}