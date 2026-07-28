// src/features/game/world/locations/Cave.ts
import * as THREE from "three";
import { Location } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { CollisionGrid } from "../CollisionGrid";
import { generateCaveMap, generateHeights } from "./CaveGridGenerator";
import { CaveChunkStreamer } from "./CaveChunkStreamer";

export class Cave extends Location {
    public collisionGrid: CollisionGrid;
    public maxPlayerRadius = 50;

    private caveMap: number[][] = [];
    private floorHeights: number[][] = [];
    private ceilingHeights: number[][] = [];

    private chunkStreamer: CaveChunkStreamer | null = null;

    private floorGeometry: THREE.BufferGeometry | null = null;
    private floorMaterial: THREE.Material | null = null;
    private ceilingGeometry: THREE.BufferGeometry | null = null;
    private ceilingMaterial: THREE.Material | null = null;
    private wallGeometry: THREE.BufferGeometry | null = null;
    private wallMaterial: THREE.Material | null = null;

    private torches: { position: THREE.Vector3; light: THREE.PointLight; mesh: THREE.Mesh; pole: THREE.Mesh }[] = [];
    private stalactites: THREE.InstancedMesh | null = null;
    private stalactiteShadows: THREE.InstancedMesh | null = null;
    private mossMesh: THREE.InstancedMesh | null = null;
    private shadowTexture: THREE.Texture | null = null;

    private portalMesh: THREE.Mesh | null = null;
    private portalLight: THREE.PointLight | null = null;
    private portalPillarMesh: THREE.Mesh | null = null;

    private cellSize = 10;
    private mapSize = 30;
    private worldSize = 300;
    private chunkSize = 50;
    private chunksPerSide = 6;
    private streamingRadius = 3;

    constructor() {
        super("cave", "Dark Cave");
        this.collisionGrid = new CollisionGrid(20);
        this.terrain = this;
    }

    create(rm: ResourceManager) {
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

        this.caveMap = generateCaveMap(this.mapSize);
        const heights = generateHeights(this.caveMap, this.mapSize);
        this.floorHeights = heights.floorHeights;
        this.ceilingHeights = heights.ceilingHeights;

        this.createShadowTexture();
        this.prepareAssets();

        this.chunkStreamer = new CaveChunkStreamer({
            scene: this.scene,
            collisionGrid: this.collisionGrid,
            caveMap: this.caveMap,
            floorHeights: this.floorHeights,
            ceilingHeights: this.ceilingHeights,
            cellSize: this.cellSize,
            mapSize: this.mapSize,
            worldSize: this.worldSize,
            chunkSize: this.chunkSize,
            chunksPerSide: this.chunksPerSide,
            streamingRadius: this.streamingRadius,
            floorGeometry: this.floorGeometry!,
            floorMaterial: this.floorMaterial!,
            ceilingGeometry: this.ceilingGeometry!,
            ceilingMaterial: this.ceilingMaterial!,
            wallGeometry: this.wallGeometry!,
            wallMaterial: this.wallMaterial!,
        });
        this.chunkStreamer.createChunks();

        this.createTorches();
        this.createGlowingMoss();
        this.createStalactites();
        this.createFakeShadows();
        this.createPortal();
        this.createLighting();
    }

    private createShadowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        this.shadowTexture = new THREE.CanvasTexture(canvas);
    }

    private prepareAssets() {
        this.floorGeometry = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
        this.floorGeometry.rotateX(-Math.PI / 2);
        this.floorMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });

        this.ceilingGeometry = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
        this.ceilingGeometry.rotateX(Math.PI / 2);
        this.ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0x1a0a00, side: THREE.DoubleSide });

        this.wallGeometry = new THREE.BoxGeometry(this.cellSize, 20, this.cellSize);
        this.wallMaterial = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
    }

    private createTorches() {
        const positions = [
            { x: 0, z: 0 },
            { x: -100, z: -100 },
            { x: 100, z: -100 },
            { x: -100, z: 100 },
            { x: 100, z: 100 },
            { x: 0, z: -100 },
            { x: 0, z: 100 },
            { x: -100, z: 0 },
            { x: 100, z: 0 },
            { x: -50, z: -50 },
            { x: 50, z: -50 },
            { x: -50, z: 50 },
            { x: 50, z: 50 },
        ];

        for (const pos of positions) {
            const cellX = Math.floor((pos.x + this.worldSize / 2) / this.cellSize);
            const cellZ = Math.floor((pos.z + this.worldSize / 2) / this.cellSize);
            if (cellX < 0 || cellX >= this.mapSize || cellZ < 0 || cellZ >= this.mapSize) continue;
            if (this.caveMap[cellX][cellZ] !== 1) continue;

            const height = this.getHeightAt(pos.x, pos.z);
            const torchPos = new THREE.Vector3(pos.x, height + 2.5, pos.z);

            const torchMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.15, 1, 6),
                new THREE.MeshLambertMaterial({ color: 0x8b4513 })
            );
            torchMesh.position.copy(torchPos);
            this.scene.add(torchMesh);

            const flameMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff6600 })
            );
            flameMesh.position.set(torchPos.x, torchPos.y + 0.6, torchPos.z);
            this.scene.add(flameMesh);

            const light = new THREE.PointLight(0xff6600, 0, 15);
            light.position.set(torchPos.x, torchPos.y + 0.6, torchPos.z);
            this.scene.add(light);

            this.torches.push({ position: torchPos, light, mesh: flameMesh, pole: torchMesh });
        }
    }

    private createGlowingMoss() {
        const mossGeometry = new THREE.PlaneGeometry(1.5, 1.5);
        const mossMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mossCount = 80;
        const mesh = new THREE.InstancedMesh(mossGeometry, mossMaterial, mossCount);

        const matrix = new THREE.Matrix4();
        let placed = 0;

        for (let i = 0; i < mossCount * 3 && placed < mossCount; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 20);
            const z = (Math.random() - 0.5) * (this.worldSize - 20);
            const cellX = Math.floor((x + this.worldSize / 2) / this.cellSize);
            const cellZ = Math.floor((z + this.worldSize / 2) / this.cellSize);

            if (cellX >= 0 && cellX < this.mapSize && cellZ >= 0 && cellZ < this.mapSize && this.caveMap[cellX][cellZ] === 0) {
                let nearPassage = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const nx = cellX + dx, nz = cellZ + dz;
                        if (nx >= 0 && nx < this.mapSize && nz >= 0 && nz < this.mapSize && this.caveMap[nx][nz] === 1) {
                            nearPassage = true;
                        }
                    }
                }

                if (nearPassage) {
                    const height = this.floorHeights[cellX][cellZ];
                    const y = height + 2 + Math.random() * 6;
                    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
                    matrix.compose(new THREE.Vector3(x, y, z), rotation, new THREE.Vector3(1, 1, 1));
                    mesh.setMatrixAt(placed++, matrix);
                }
            }
        }

        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        this.mossMesh = mesh;
    }

    private createStalactites() {
        const geometry = new THREE.ConeGeometry(0.4, 2.5, 6);
        const material = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });

        const count = 300;
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
        let placed = 0;

        for (let i = 0; i < count * 3 && placed < count; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 20);
            const z = (Math.random() - 0.5) * (this.worldSize - 20);
            const cellX = Math.floor((x + this.worldSize / 2) / this.cellSize);
            const cellZ = Math.floor((z + this.worldSize / 2) / this.cellSize);

            if (cellX >= 0 && cellX < this.mapSize && cellZ >= 0 && cellZ < this.mapSize && this.caveMap[cellX][cellZ] === 1) {
                const ceilHeight = this.ceilingHeights[cellX][cellZ];
                const scale = 0.5 + Math.random() * 1.5;
                matrix.compose(
                    new THREE.Vector3(x, ceilHeight - 1.25 * scale, z),
                    rotation,
                    new THREE.Vector3(scale, scale, scale)
                );
                mesh.setMatrixAt(placed++, matrix);
            }
        }

        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        this.stalactites = mesh;
    }

    private createFakeShadows() {
        if (!this.stalactites) return;

        const shadowGeometry = new THREE.PlaneGeometry(1.5, 1.5);
        shadowGeometry.rotateX(-Math.PI / 2);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            map: this.shadowTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0.4,
        });

        const count = this.stalactites.count;
        const shadowMesh = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, count);

        const matrix = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            this.stalactites.getMatrixAt(i, matrix);
            const pos = new THREE.Vector3();
            pos.setFromMatrixPosition(matrix);

            const cellX = Math.floor((pos.x + this.worldSize / 2) / this.cellSize);
            const cellZ = Math.floor((pos.z + this.worldSize / 2) / this.cellSize);
            let floorHeight = 0;
            if (cellX >= 0 && cellX < this.mapSize && cellZ >= 0 && cellZ < this.mapSize) {
                floorHeight = this.floorHeights[cellX][cellZ];
            }

            matrix.setPosition(pos.x, floorHeight + 0.05, pos.z);
            shadowMesh.setMatrixAt(i, matrix);
        }

        shadowMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(shadowMesh);
        this.stalactiteShadows = shadowMesh;
    }

    private createPortal() {

        const portalX = 0;
        const portalZ = 0;
        const portalY = this.getHeightAt(portalX, portalZ) + 2;

        const portalGeo = new THREE.TorusGeometry(2, 0.3, 8, 16);
        const portalMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(portalX, portalY, portalZ);
        this.scene.add(portal);
        this.portalMesh = portal;

        const portalLight = new THREE.PointLight(0x00ffff, 3, 25);
        portalLight.position.set(portalX, portalY, portalZ);
        this.scene.add(portalLight);
        this.portalLight = portalLight;

        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 10, 8);
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.25
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(portalX, portalY, portalZ);
        this.scene.add(pillar);
        this.portalPillarMesh = pillar;

        this.addPortal({
            id: "cave-to-main",
            position: new THREE.Vector3(portalX, portalY, portalZ),
            radius: 3,
            targetLocationId: "main-world",
            targetSpawnPoint: new THREE.Vector3(55, 0, 0),
            mesh: portal,
        });
    }

    private createLighting() {
        const ambient = new THREE.AmbientLight(0x111122, 0.3);
        this.scene.add(ambient);
    }

    public getHeightAt(x: number, z: number): number {
        const cellX = Math.floor((x + this.worldSize / 2) / this.cellSize);
        const cellZ = Math.floor((z + this.worldSize / 2) / this.cellSize);
        if (cellX < 0 || cellX >= this.mapSize || cellZ < 0 || cellZ >= this.mapSize) return 0;
        return this.floorHeights[cellX][cellZ];
    }

    public update(playerPosition: THREE.Vector3, delta: number) {
        this.chunkStreamer?.updateStreaming(playerPosition.x, playerPosition.z);
        this.updateTorches(playerPosition);
    }

    private updateTorches(playerPos: THREE.Vector3) {
        const sorted = [...this.torches].sort((a, b) =>
            a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
        );

        for (let i = 0; i < this.torches.length; i++) {
            const torch = this.torches[i];
            const shouldBeOn = i < 4;
            torch.light.intensity = shouldBeOn ? 1.5 : 0;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, this.getHeightAt(0, 0), 0);
    }

    dispose() {
        this.chunkStreamer?.dispose();
        this.chunkStreamer = null;

        if (this.floorGeometry) this.floorGeometry.dispose();
        if (this.floorMaterial) this.floorMaterial.dispose();
        if (this.ceilingGeometry) this.ceilingGeometry.dispose();
        if (this.ceilingMaterial) this.ceilingMaterial.dispose();
        if (this.wallGeometry) this.wallGeometry.dispose();
        if (this.wallMaterial) this.wallMaterial.dispose();

        // InstancedMesh.dispose() only frees the per-instance transform buffer —
        // the shared geometry/material (not owned by ResourceManager's cache here,
        // created fresh per Cave instance) must be disposed separately.
        if (this.stalactites) {
            this.scene.remove(this.stalactites);
            this.stalactites.geometry.dispose();
            (this.stalactites.material as THREE.Material).dispose();
            this.stalactites.dispose();
            this.stalactites = null;
        }
        if (this.stalactiteShadows) {
            this.scene.remove(this.stalactiteShadows);
            this.stalactiteShadows.geometry.dispose();
            (this.stalactiteShadows.material as THREE.Material).dispose();
            this.stalactiteShadows.dispose();
            this.stalactiteShadows = null;
        }
        if (this.mossMesh) {
            this.scene.remove(this.mossMesh);
            this.mossMesh.geometry.dispose();
            (this.mossMesh.material as THREE.Material).dispose();
            this.mossMesh.dispose();
            this.mossMesh = null;
        }
        if (this.shadowTexture) this.shadowTexture.dispose();

        for (const torch of this.torches) {
            this.scene.remove(torch.light);

            this.scene.remove(torch.mesh);
            torch.mesh.geometry.dispose();
            (torch.mesh.material as THREE.Material).dispose();

            this.scene.remove(torch.pole);
            torch.pole.geometry.dispose();
            (torch.pole.material as THREE.Material).dispose();
        }
        this.torches = [];

        if (this.portalMesh) {
            this.scene.remove(this.portalMesh);
            this.portalMesh.geometry.dispose();
            (this.portalMesh.material as THREE.Material).dispose();
            this.portalMesh = null;
        }
        if (this.portalLight) {
            this.scene.remove(this.portalLight);
            this.portalLight = null;
        }
        if (this.portalPillarMesh) {
            this.scene.remove(this.portalPillarMesh);
            this.portalPillarMesh.geometry.dispose();
            (this.portalPillarMesh.material as THREE.Material).dispose();
            this.portalPillarMesh = null;
        }
    }
}
