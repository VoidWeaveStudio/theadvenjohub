//src\features\game\world\locations\main-world\systems\FeatureSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";

export class FeatureSystem {
    private leftDoor: THREE.Mesh | null = null;
    private rightDoor: THREE.Mesh | null = null;
    private isDoorOpening = false;
    private doorOpenProgress = 0;
    private readonly towerEntrancePos = new THREE.Vector3(150, 0, 0);
    public readonly towerRadius = 40;
    public readonly towerClearZone = 55;

    constructor(private world: MainWorld) { }

    createGloomyTower() {
        const towerX = 150, towerZ = 0;
        const groundY = this.world.terrain.getHeightAt(towerX, towerZ);
        
        const towerGroup = new THREE.Group();
        const towerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.1 });
        
        const towerHeight = 450;
        const towerRadius = 40;
        const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(towerRadius * 0.8, towerRadius, towerHeight, 20), towerMat);
        towerMesh.position.y = towerHeight / 2;
        towerMesh.castShadow = true; 
        towerMesh.receiveShadow = true;
        towerGroup.add(towerMesh);

        const spireHeight = 150;
        const spireMesh = new THREE.Mesh(new THREE.ConeGeometry(towerRadius * 0.5, spireHeight, 10), towerMat);
        spireMesh.position.y = towerHeight + spireHeight / 2;
        spireMesh.castShadow = true;
        towerGroup.add(spireMesh);

        const doorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.8 });
        
        this.leftDoor = new THREE.Mesh(new THREE.BoxGeometry(18, 35, 5), doorMat);
        this.leftDoor.position.set(-10, 17.5, towerRadius);
        this.leftDoor.castShadow = true;
        towerGroup.add(this.leftDoor);

        this.rightDoor = new THREE.Mesh(new THREE.BoxGeometry(18, 35, 5), doorMat);
        this.rightDoor.position.set(10, 17.5, towerRadius);
        this.rightDoor.castShadow = true;
        towerGroup.add(this.rightDoor);

        const eerieLight = new THREE.PointLight(0x6a0dad, 5, 80);
        eerieLight.position.set(0, 40, towerRadius + 5);
        towerGroup.add(eerieLight);

        this.world.scene.add(towerGroup);
        towerGroup.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(towerGroup);
        const center = box.getCenter(new THREE.Vector3());
        
        const PORTAL_SINK = 0.5; 
        towerGroup.position.set(
            towerX - center.x,
            groundY - box.min.y - PORTAL_SINK,
            towerZ - center.z
        );
        
        towerGroup.updateMatrixWorld(true);

        const doorLocalPos = new THREE.Vector3(0, 17.5, towerRadius);
        doorLocalPos.applyMatrix4(towerGroup.matrixWorld);
        this.towerEntrancePos.copy(doorLocalPos);

        this.world.vegetation.clearVegetationAroundPortal(towerX, towerZ, this.towerClearZone);

        const towerBox = new THREE.Box3(
            new THREE.Vector3(towerX - towerRadius - 2, groundY, towerZ - towerRadius - 2),
            new THREE.Vector3(towerX + towerRadius + 2, groundY + 60, towerZ + towerRadius + 2)
        );
        this.world.colliders.push(towerBox);
        this.world.terrainCollisionGrid.insert(towerBox);
    }

    update(delta: number, playerPosition: THREE.Vector3) {
        const distToDoor = playerPosition.distanceTo(this.towerEntrancePos);

        if (!this.isDoorOpening && distToDoor < 20) {
            this.isDoorOpening = true;
        }

        if (this.isDoorOpening && this.doorOpenProgress < 1) {
            this.doorOpenProgress += delta * 0.8; 
            if (this.doorOpenProgress > 1) this.doorOpenProgress = 1;

            const openDistance = 20; 
            
            if (this.leftDoor) {
                this.leftDoor.position.x = -10 - (openDistance * this.doorOpenProgress);
            }
            if (this.rightDoor) {
                this.rightDoor.position.x = 10 + (openDistance * this.doorOpenProgress);
            }

            if (this.doorOpenProgress === 1 && distToDoor < 30) {
                this.world.pendingTeleport = "tower";
            }
        }
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