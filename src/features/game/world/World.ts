//src\features\game\world\World.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";
import { Terrain } from "./Terrain";
import { GridSystem } from "./GridSystem";

export interface Collider {
    box: THREE.Box3;
    mesh: THREE.Object3D;
}

export class World {
    public readonly size: number;
    public colliders: Collider[] = [];
    public interactables: THREE.Object3D[] = [];

    private terrain: Terrain;
    public gridSystem: GridSystem;

    private cachedColliderBoxes: THREE.Box3[] | null = null;

    constructor(size: number = 500) {
        this.size = size;
        this.terrain = new Terrain(this.size, 64);
        this.gridSystem = new GridSystem(this.size, 5);
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        this.terrain.create(scene);
        this.gridSystem.createVisualization(scene);
        this.createWater(scene);
        this.createVegetation(scene, resourceManager);
        this.createRocks(scene, resourceManager);
        this.createLighting(scene);

        this.cachedColliderBoxes = this.colliders.map((c) => c.box);
    }

    private createWater(scene: THREE.Scene) {
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x3a7fd5,
            transparent: true,
            opacity: 0.75,
            roughness: 0.1,
            metalness: 0.3,
        });

        const river = new THREE.Mesh(new THREE.PlaneGeometry(15, this.size), waterMat);
        river.rotation.x = -Math.PI / 2;
        river.position.set(120, 0.05, 0);
        scene.add(river);

        const lake = new THREE.Mesh(new THREE.CircleGeometry(35, 32), waterMat);
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(-100, 0.05, -90);
        scene.add(lake);
    }

    private createVegetation(scene: THREE.Scene, rm: ResourceManager) {
        const count = 180;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 45 + Math.random() * (this.size * 0.45 - 45);
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            const data = rm.getModel("tree");
            if (!data) continue;
            const tree = data.scene;
            tree.position.set(x, 0, z);
            tree.rotation.y = Math.random() * Math.PI * 2;
            const scale = 0.8 + Math.random() * 0.6;
            tree.scale.setScalar(scale);
            scene.add(tree);

            const box = new THREE.Box3().setFromObject(tree);
            this.colliders.push({ box, mesh: tree });
        }
    }

    private createRocks(scene: THREE.Scene, rm: ResourceManager) {
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * this.size * 0.8;
            const z = (Math.random() - 0.5) * this.size * 0.8;
            const dist = Math.sqrt(x * x + z * z);
            if (dist < 45) continue;

            const data = rm.getModel("rock");
            if (!data) continue;
            const rock = data.scene;
            rock.position.set(x, 0, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            const s = 0.6 + Math.random() * 1.2;
            rock.scale.setScalar(s);
            scene.add(rock);

            const box = new THREE.Box3().setFromObject(rock);
            this.colliders.push({ box, mesh: rock });
        }
    }

    private createLighting(scene: THREE.Scene) {
        const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 0.7);
        scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
        sun.position.set(80, 150, 60);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 400;
        sun.shadow.camera.left = -120;
        sun.shadow.camera.right = 120;
        sun.shadow.camera.top = 120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.bias = -0.0005;
        scene.add(sun);
    }

    getColliders(): Collider[] {
        return this.colliders;
    }

    getColliderBoxes(): THREE.Box3[] {
        if (!this.cachedColliderBoxes) {
            this.cachedColliderBoxes = this.colliders.map((c) => c.box);
        }
        return this.cachedColliderBoxes;
    }

    getTerrainHeight(x: number, z: number): number {
        return this.terrain.getHeightAt(x, z);
    }

    getGridSystem(): GridSystem {
        return this.gridSystem;
    }

    dispose() {
        this.terrain.dispose();
        this.gridSystem.dispose();
        this.cachedColliderBoxes = null;
    }
}