//src\features\game\world\locations\Cave.ts
import * as THREE from "three";
import { Location } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { CollisionGrid } from "../CollisionGrid";

interface CaveChunk {
    floorMesh: THREE.InstancedMesh;
    ceilingMesh: THREE.InstancedMesh;
    wallMesh: THREE.InstancedMesh;
}

export class Cave extends Location {
    public collisionGrid: CollisionGrid;
    
    private caveMap: number[][] = [];
    private floorHeights: number[][] = [];
    private ceilingHeights: number[][] = [];
    
    private chunks: Map<string, CaveChunk> = new Map();
    private loadedChunkKeys: Set<string> = new Set();
    private streamingRadius: number = 3;
    
    private floorGeometry: THREE.BufferGeometry | null = null;
    private floorMaterial: THREE.Material | null = null;
    private ceilingGeometry: THREE.BufferGeometry | null = null;
    private ceilingMaterial: THREE.Material | null = null;
    private wallGeometry: THREE.BufferGeometry | null = null;
    private wallMaterial: THREE.Material | null = null;
    
    private torches: { position: THREE.Vector3; light: THREE.PointLight; mesh: THREE.Mesh }[] = [];
    private stalactites: THREE.InstancedMesh | null = null;
    private stalactiteShadows: THREE.InstancedMesh | null = null;
    private mossMesh: THREE.InstancedMesh | null = null;
    private shadowTexture: THREE.Texture | null = null;
    
    private cellSize = 10;
    private mapSize = 30;
    private worldSize = 300;
    private chunkSize = 50;
    private chunksPerSide = 6;

    constructor() {
        super("cave", "Dark Cave");
        this.collisionGrid = new CollisionGrid(20);
    }

    create(rm: ResourceManager) {
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);

        this.generateCaveMap();
        this.generateHeights();
        this.createShadowTexture();
        this.prepareAssets();
        this.createChunks();
        this.createTorches();
        this.createGlowingMoss();
        this.createStalactites();
        this.createFakeShadows();
        this.createPortal();
        this.createLighting();
    }

    private generateCaveMap() {
        const size = this.mapSize;
        this.caveMap = [];
        for (let x = 0; x < size; x++) {
            this.caveMap[x] = [];
            for (let z = 0; z < size; z++) {
                this.caveMap[x][z] = 0;
            }
        }

        const rooms = [
            { x: 13, z: 13, w: 5, h: 5 },
            { x: 3, z: 3, w: 5, h: 4 },
            { x: 22, z: 3, w: 5, h: 4 },
            { x: 3, z: 23, w: 5, h: 4 },
            { x: 22, z: 23, w: 5, h: 4 },
            { x: 13, z: 3, w: 4, h: 3 },
            { x: 13, z: 24, w: 4, h: 3 },
            { x: 3, z: 13, w: 3, h: 4 },
            { x: 24, z: 13, w: 3, h: 4 },
            { x: 8, z: 8, w: 3, h: 3 },
            { x: 19, z: 8, w: 3, h: 3 },
            { x: 8, z: 19, w: 3, h: 3 },
            { x: 19, z: 19, w: 3, h: 3 },
        ];

        for (const room of rooms) {
            for (let x = room.x; x < room.x + room.w; x++) {
                for (let z = room.z; z < room.z + room.h; z++) {
                    if (x >= 0 && x < size && z >= 0 && z < size) {
                        this.caveMap[x][z] = 1;
                    }
                }
            }
        }

        const connections = [
            [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
            [1, 9], [2, 10], [3, 11], [4, 12],
            [9, 5], [10, 5], [11, 6], [12, 6],
            [9, 7], [10, 8], [11, 7], [12, 8],
            [1, 7], [2, 8], [3, 7], [4, 8],
        ];

        for (const [a, b] of connections) {
            const ra = rooms[a], rb = rooms[b];
            const cx1 = Math.floor(ra.x + ra.w / 2);
            const cz1 = Math.floor(ra.z + ra.h / 2);
            const cx2 = Math.floor(rb.x + rb.w / 2);
            const cz2 = Math.floor(rb.z + rb.h / 2);

            let x = cx1, z = cz1;
            while (x !== cx2) {
                if (x >= 0 && x < size && z >= 0 && z < size) this.caveMap[x][z] = 1;
                x += x < cx2 ? 1 : -1;
            }
            while (z !== cz2) {
                if (x >= 0 && x < size && z >= 0 && z < size) this.caveMap[x][z] = 1;
                z += z < cz2 ? 1 : -1;
            }
        }
    }

    private generateHeights() {
        this.floorHeights = [];
        this.ceilingHeights = [];
        for (let x = 0; x < this.mapSize; x++) {
            this.floorHeights[x] = [];
            this.ceilingHeights[x] = [];
            for (let z = 0; z < this.mapSize; z++) {
                if (this.caveMap[x][z] === 1) {
                    this.floorHeights[x][z] = (Math.random() - 0.5) * 4;
                    this.ceilingHeights[x][z] = this.floorHeights[x][z] + 10 + Math.random() * 5;
                } else {
                    this.floorHeights[x][z] = -5;
                    this.ceilingHeights[x][z] = 15;
                }
            }
        }
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

    private createChunks() {
        for (let cx = 0; cx < this.chunksPerSide; cx++) {
            for (let cz = 0; cz < this.chunksPerSide; cz++) {
                this.createChunk(cx, cz);
            }
        }
    }

    private createChunk(cx: number, cz: number) {
        const key = `${cx},${cz}`;
        const startCellX = cx * 5;
        const startCellZ = cz * 5;

        let floorCount = 0, ceilingCount = 0, wallCount = 0;
        for (let x = startCellX; x < startCellX + 5; x++) {
            for (let z = startCellZ; z < startCellZ + 5; z++) {
                if (x < this.mapSize && z < this.mapSize) {
                    if (this.caveMap[x][z] === 1) {
                        floorCount++;
                        ceilingCount++;
                    } else {
                        wallCount++;
                    }
                }
            }
        }

        const floorMesh = new THREE.InstancedMesh(this.floorGeometry!, this.floorMaterial!, floorCount);
        const ceilingMesh = new THREE.InstancedMesh(this.ceilingGeometry!, this.ceilingMaterial!, ceilingCount);
        const wallMesh = new THREE.InstancedMesh(this.wallGeometry!, this.wallMaterial!, wallCount);

        floorMesh.castShadow = false;
        floorMesh.receiveShadow = false;
        ceilingMesh.castShadow = false;
        ceilingMesh.receiveShadow = false;
        wallMesh.castShadow = false;
        wallMesh.receiveShadow = false;

        let fi = 0, ci = 0, wi = 0;
        const matrix = new THREE.Matrix4();

        for (let x = startCellX; x < startCellX + 5; x++) {
            for (let z = startCellZ; z < startCellZ + 5; z++) {
                if (x >= this.mapSize || z >= this.mapSize) continue;

                const worldX = x * this.cellSize + this.cellSize / 2 - this.worldSize / 2;
                const worldZ = z * this.cellSize + this.cellSize / 2 - this.worldSize / 2;

                if (this.caveMap[x][z] === 1) {
                    const floorY = this.floorHeights[x][z];
                    matrix.setPosition(worldX, floorY, worldZ);
                    floorMesh.setMatrixAt(fi++, matrix);

                    const ceilY = this.ceilingHeights[x][z];
                    matrix.setPosition(worldX, ceilY, worldZ);
                    ceilingMesh.setMatrixAt(ci++, matrix);
                } else {
                    matrix.setPosition(worldX, 5, worldZ);
                    wallMesh.setMatrixAt(wi++, matrix);

                    this.collisionGrid.insert(new THREE.Box3(
                        new THREE.Vector3(worldX - 5, -5, worldZ - 5),
                        new THREE.Vector3(worldX + 5, 15, worldZ + 5)
                    ));
                }
            }
        }

        floorMesh.count = fi;
        ceilingMesh.count = ci;
        wallMesh.count = wi;
        floorMesh.instanceMatrix.needsUpdate = true;
        ceilingMesh.instanceMatrix.needsUpdate = true;
        wallMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(floorMesh, ceilingMesh, wallMesh);
        this.chunks.set(key, { floorMesh, ceilingMesh, wallMesh });
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

            this.torches.push({ position: torchPos, light, mesh: flameMesh });
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
        const portalX = 14.5 * this.cellSize - this.worldSize / 2;
        const portalZ = 25 * this.cellSize - this.worldSize / 2;
        const portalY = this.getHeightAt(portalX, portalZ) + 2;

        const portalGeo = new THREE.TorusGeometry(2, 0.3, 8, 16);
        const portalMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(portalX, portalY, portalZ);
        this.scene.add(portal);

        const portalLight = new THREE.PointLight(0x00ffff, 2, 15);
        portalLight.position.set(portalX, portalY, portalZ);
        this.scene.add(portalLight);

        this.addPortal({
            id: "cave-to-main",
            position: new THREE.Vector3(portalX, portalY, portalZ),
            radius: 2.5,
            targetLocationId: "main-world",
            targetSpawnPoint: new THREE.Vector3(195, 0, -145),
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
        this.updateStreaming(playerPosition.x, playerPosition.z);
        this.updateTorches(playerPosition);
    }

    private updateStreaming(playerX: number, playerZ: number) {
        const playerChunkX = Math.floor((playerX + this.worldSize / 2) / this.chunkSize);
        const playerChunkZ = Math.floor((playerZ + this.worldSize / 2) / this.chunkSize);

        const toShow: string[] = [];
        const toHide: string[] = [];

        for (let dx = -this.streamingRadius; dx <= this.streamingRadius; dx++) {
            for (let dz = -this.streamingRadius; dz <= this.streamingRadius; dz++) {
                const cx = playerChunkX + dx;
                const cz = playerChunkZ + dz;
                if (cx < 0 || cx >= this.chunksPerSide || cz < 0 || cz >= this.chunksPerSide) continue;
                const key = `${cx},${cz}`;
                const chunk = this.chunks.get(key);
                if (chunk && !this.loadedChunkKeys.has(key)) {
                    toShow.push(key);
                }
            }
        }

        this.loadedChunkKeys.forEach(key => {
            const chunk = this.chunks.get(key);
            if (!chunk) return;
            const [cx, cz] = key.split(',').map(Number);
            const dx = Math.abs(cx - playerChunkX);
            const dz = Math.abs(cz - playerChunkZ);
            if (dx > this.streamingRadius || dz > this.streamingRadius) {
                toHide.push(key);
            }
        });

        for (const key of toShow) {
            const chunk = this.chunks.get(key);
            if (chunk) {
                chunk.floorMesh.visible = true;
                chunk.ceilingMesh.visible = true;
                chunk.wallMesh.visible = true;
                this.loadedChunkKeys.add(key);
            }
        }

        for (const key of toHide) {
            const chunk = this.chunks.get(key);
            if (chunk) {
                chunk.floorMesh.visible = false;
                chunk.ceilingMesh.visible = false;
                chunk.wallMesh.visible = false;
                this.loadedChunkKeys.delete(key);
            }
        }
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
        this.chunks.forEach(chunk => {
            this.scene.remove(chunk.floorMesh);
            this.scene.remove(chunk.ceilingMesh);
            this.scene.remove(chunk.wallMesh);
            chunk.floorMesh.dispose();
            chunk.ceilingMesh.dispose();
            chunk.wallMesh.dispose();
        });
        this.chunks.clear();

        if (this.floorGeometry) this.floorGeometry.dispose();
        if (this.floorMaterial) this.floorMaterial.dispose();
        if (this.ceilingGeometry) this.ceilingGeometry.dispose();
        if (this.ceilingMaterial) this.ceilingMaterial.dispose();
        if (this.wallGeometry) this.wallGeometry.dispose();
        if (this.wallMaterial) this.wallMaterial.dispose();

        if (this.stalactites) {
            this.scene.remove(this.stalactites);
            this.stalactites.dispose();
        }
        if (this.stalactiteShadows) {
            this.scene.remove(this.stalactiteShadows);
            this.stalactiteShadows.dispose();
        }
        if (this.mossMesh) {
            this.scene.remove(this.mossMesh);
            this.mossMesh.dispose();
        }
        if (this.shadowTexture) this.shadowTexture.dispose();

        for (const torch of this.torches) {
            this.scene.remove(torch.light);
            this.scene.remove(torch.mesh);
        }
        this.torches = [];
    }
}