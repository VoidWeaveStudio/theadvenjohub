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
        
        const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(crystalGeo, crystalMat);
        mesh.position.y = 1.5;
        mesh.castShadow = true;
        this.centralCrystal.add(mesh);

        const light = new THREE.PointLight(0x00ffff, 4, 20, 2);
        light.position.y = 1.5;
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        this.centralCrystal.add(light);

        this.centralCrystal.position.set(0, 0, 0);
        this.scene.add(this.centralCrystal);

        this.centralCrystal.userData.interactionId = "tower-crystal";

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-0.5, 0, -0.5),
            new THREE.Vector3(0.5, 3, 0.5)
        ));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        if (this.centralCrystal) {
            this.centralCrystal.rotation.y = this.time * 0.5;
            const floatY = 1.5 + Math.sin(this.time * 1.5) * 0.2;
            this.centralCrystal.children[0].position.y = floatY;
            this.centralCrystal.children[1].position.y = floatY;
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