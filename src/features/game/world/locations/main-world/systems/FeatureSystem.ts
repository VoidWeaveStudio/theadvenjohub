// src/features/game/world/locations/main-world/systems/FeatureSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";
import { buildTowerExterior } from "./TowerExteriorBuilder";

const TOWER_ENTRANCE_LOCATION_ID = "tower-first-floor";

export class FeatureSystem {
    private leftDoorGroup: THREE.Group | null = null;
    private rightDoorGroup: THREE.Group | null = null;
    private towerPortalMesh: THREE.Mesh | null = null;

    private isDoorOpening = false;
    private doorOpenProgress = 0;
    private readonly towerEntrancePos = new THREE.Vector3(300, 0, 0);
    public readonly towerClearZone = 180;

    private towerLights: THREE.Light[] = [];

    private towerGroup: THREE.Group | null = null;

    constructor(private world: MainWorld) { }

    createGloomyTower() {
        const result = buildTowerExterior(this.world);

        this.towerGroup = result.towerGroup;
        this.leftDoorGroup = result.leftDoorGroup;
        this.rightDoorGroup = result.rightDoorGroup;
        this.towerPortalMesh = result.towerPortalMesh;
        this.towerLights = result.towerLights;
        this.towerEntrancePos.copy(result.towerEntrancePos);

    }

    setVisible(visible: boolean) {
        if (this.towerGroup) this.towerGroup.visible = visible;
        for (const light of this.towerLights) {
            light.visible = visible;
        }
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

        const swing = this.doorOpenProgress < 0.5
            ? 4 * this.doorOpenProgress ** 3
            : 1 - Math.pow(-2 * this.doorOpenProgress + 2, 3) / 2;
        const swingAngle = (Math.PI / 2.15) * swing;

        if (this.leftDoorGroup) this.leftDoorGroup.rotation.y = -swingAngle;
        if (this.rightDoorGroup) this.rightDoorGroup.rotation.y = swingAngle;

        if (this.towerPortalMesh) {
            this.towerPortalMesh.visible = this.doorOpenProgress > 0.5;
        }

        if (isEPressed && dist2D < 9 && this.doorOpenProgress > 0.6) {
            this.world.pendingTeleport = TOWER_ENTRANCE_LOCATION_ID;
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

    }

    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        const dx = playerPosition.x - this.towerEntrancePos.x;
        const dz = playerPosition.z - this.towerEntrancePos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        if (dist2D < 9 && this.doorOpenProgress > 0.6) {
            return "[E] Enter the tower";
        }
        return null;
    }

    dispose() {
        if (this.towerGroup) {
            this.world.scene.remove(this.towerGroup);
            this.towerGroup.traverse((child) => {
                const obj = child as THREE.Mesh | THREE.Points;
                if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
                    obj.geometry?.dispose();
                    const mat = obj.material;
                    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                    else mat?.dispose();
                }
            });
            this.towerGroup = null;
        }
        this.leftDoorGroup = null;
        this.rightDoorGroup = null;
        this.towerPortalMesh = null;
        this.towerLights = [];

    }
}
