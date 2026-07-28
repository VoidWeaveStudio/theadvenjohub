// src/features/game/world/locations/main-world/systems/FeatureSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";
import { buildTowerExterior } from "./TowerExteriorBuilder";
import { TowerParticles } from "./TowerParticles";

export class FeatureSystem {
    private leftDoorGroup: THREE.Group | null = null;
    private rightDoorGroup: THREE.Group | null = null;
    private towerPortalMesh: THREE.Mesh | null = null;

    private isDoorOpening = false;
    private doorOpenProgress = 0;
    private readonly towerEntrancePos = new THREE.Vector3(300, 0, 0);
    public readonly towerClearZone = 180;

    private towerLights: THREE.Light[] = [];
    private particles = new TowerParticles();

    constructor(private world: MainWorld) { }

    createGloomyTower() {
        const result = buildTowerExterior(this.world);

        this.leftDoorGroup = result.leftDoorGroup;
        this.rightDoorGroup = result.rightDoorGroup;
        this.towerPortalMesh = result.towerPortalMesh;
        this.towerLights = result.towerLights;
        this.towerEntrancePos.copy(result.towerEntrancePos);

        this.particles.create(result.towerGroup, result.doorZ);
    }

    update(delta: number, playerPosition: THREE.Vector3, isEPressed: boolean) {
        const dx = playerPosition.x - this.towerEntrancePos.x;
        const dz = playerPosition.z - this.towerEntrancePos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D < 30) {
            this.isDoorOpening = true;
        } else if (dist2D > 35) {
            this.isDoorOpening = false;
        }

        const animSpeed = 2.5;
        if (this.isDoorOpening && this.doorOpenProgress < 1) {
            this.doorOpenProgress += delta * animSpeed;
            if (this.doorOpenProgress > 1) this.doorOpenProgress = 1;
        } else if (!this.isDoorOpening && this.doorOpenProgress > 0) {
            this.doorOpenProgress -= delta * animSpeed;
            if (this.doorOpenProgress < 0) this.doorOpenProgress = 0;
        }

        if (this.leftDoorGroup) {
            this.leftDoorGroup.rotation.y = -(Math.PI / 2.5) * this.doorOpenProgress;
        }
        if (this.rightDoorGroup) {
            this.rightDoorGroup.rotation.y = (Math.PI / 2.5) * this.doorOpenProgress;
        }

        if (this.towerPortalMesh) {
            this.towerPortalMesh.visible = this.doorOpenProgress > 0.5;
        }

        if (dist2D < 3.0 && this.doorOpenProgress > 0.8) {
            this.world.pendingTeleport = "tower-main-hall";
        }

        const time = Date.now() * 0.001;
        this.towerLights.forEach((light, index) => {
            if (light.color.getHex() === 0xff8844 || light.color.getHex() === 0xffddaa) {
                const flicker = Math.sin(time * 8 + index * 5) * 0.4 + Math.cos(time * 15 + index) * 0.2;
                light.intensity = Math.max(2.0, (light.intensity || 6) + flicker);
            } else {
                light.intensity = 3 + Math.sin(time * 2) * 0.5;
            }
        });

        this.particles.update(delta);
    }

    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        const dx = playerPosition.x - this.towerEntrancePos.x;
        const dz = playerPosition.z - this.towerEntrancePos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D < 15 && this.doorOpenProgress > 0.3) {
            return "Walk into the portal";
        }
        return null;
    }

    createOcean() {
        const waterLevel = -5, mapSize = this.world.size, waterWidth = 1500, halfMap = mapSize / 2;
        const material = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.4, depthWrite: false });

        const createPlane = (w: number, h: number, x: number, z: number) => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, waterLevel, z); mesh.receiveShadow = true;
            this.world.scene.add(mesh);
        };

        createPlane(mapSize + waterWidth * 2, waterWidth, 0, halfMap + waterWidth / 2);
        createPlane(mapSize + waterWidth * 2, waterWidth, 0, -halfMap - waterWidth / 2);
        createPlane(waterWidth, mapSize + waterWidth * 2, -halfMap - waterWidth / 2, 0);
        createPlane(waterWidth, mapSize + waterWidth * 2, halfMap + waterWidth / 2, 0);
    }

    createBoundaryColliders() {
        const limit = 240, height = 50, thickness = 20;
        const walls = [
            new THREE.Box3(new THREE.Vector3(-limit, -10, -limit - thickness), new THREE.Vector3(limit, height, -limit)),
            new THREE.Box3(new THREE.Vector3(-limit, -10, limit), new THREE.Vector3(limit, height, limit + thickness)),
            new THREE.Box3(new THREE.Vector3(-limit - thickness, -10, -limit), new THREE.Vector3(-limit, height, limit)),
            new THREE.Box3(new THREE.Vector3(limit, -10, -limit), new THREE.Vector3(limit + thickness, height, limit)),
        ];
        walls.forEach(wall => {
            this.world.colliders.push(wall);
            this.world.terrainCollisionGrid.insert(wall);
        });
    }
}
