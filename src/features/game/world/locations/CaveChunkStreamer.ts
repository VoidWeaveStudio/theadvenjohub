// src/features/game/world/locations/CaveChunkStreamer.ts
import * as THREE from "three";
import { CollisionGrid } from "../CollisionGrid";

interface CaveChunk {
    floorMesh: THREE.InstancedMesh;
    ceilingMesh: THREE.InstancedMesh;
    wallMesh: THREE.InstancedMesh;
}

export interface CaveChunkStreamerOptions {
    scene: THREE.Scene;
    collisionGrid: CollisionGrid;
    caveMap: number[][];
    floorHeights: number[][];
    ceilingHeights: number[][];
    cellSize: number;
    mapSize: number;
    worldSize: number;
    chunkSize: number;
    chunksPerSide: number;
    streamingRadius: number;
    floorGeometry: THREE.BufferGeometry;
    floorMaterial: THREE.Material;
    ceilingGeometry: THREE.BufferGeometry;
    ceilingMaterial: THREE.Material;
    wallGeometry: THREE.BufferGeometry;
    wallMaterial: THREE.Material;
}

export class CaveChunkStreamer {
    private chunks: Map<string, CaveChunk> = new Map();
    private loadedChunkKeys: Set<string> = new Set();

    constructor(private options: CaveChunkStreamerOptions) { }

    createChunks() {
        for (let cx = 0; cx < this.options.chunksPerSide; cx++) {
            for (let cz = 0; cz < this.options.chunksPerSide; cz++) {
                this.createChunk(cx, cz);
            }
        }
    }

    private createChunk(cx: number, cz: number) {
        const { caveMap, mapSize, cellSize, worldSize, collisionGrid, floorGeometry, floorMaterial, ceilingGeometry, ceilingMaterial, wallGeometry, wallMaterial, scene } = this.options;

        const key = `${cx},${cz}`;
        const startCellX = cx * 5;
        const startCellZ = cz * 5;

        let floorCount = 0, ceilingCount = 0, wallCount = 0;
        for (let x = startCellX; x < startCellX + 5; x++) {
            for (let z = startCellZ; z < startCellZ + 5; z++) {
                if (x < mapSize && z < mapSize) {
                    if (caveMap[x][z] === 1) {
                        floorCount++;
                        ceilingCount++;
                    } else {
                        wallCount++;
                    }
                }
            }
        }

        const floorMesh = new THREE.InstancedMesh(floorGeometry, floorMaterial, floorCount);
        const ceilingMesh = new THREE.InstancedMesh(ceilingGeometry, ceilingMaterial, ceilingCount);
        const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallCount);

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
                if (x >= mapSize || z >= mapSize) continue;

                const worldX = x * cellSize + cellSize / 2 - worldSize / 2;
                const worldZ = z * cellSize + cellSize / 2 - worldSize / 2;

                if (caveMap[x][z] === 1) {
                    const floorY = this.options.floorHeights[x][z];
                    matrix.setPosition(worldX, floorY, worldZ);
                    floorMesh.setMatrixAt(fi++, matrix);

                    const ceilY = this.options.ceilingHeights[x][z];
                    matrix.setPosition(worldX, ceilY, worldZ);
                    ceilingMesh.setMatrixAt(ci++, matrix);
                } else {
                    matrix.setPosition(worldX, 5, worldZ);
                    wallMesh.setMatrixAt(wi++, matrix);

                    collisionGrid.insert(new THREE.Box3(
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

        scene.add(floorMesh, ceilingMesh, wallMesh);
        this.chunks.set(key, { floorMesh, ceilingMesh, wallMesh });
    }

    updateStreaming(playerX: number, playerZ: number) {
        const { worldSize, chunkSize, chunksPerSide, streamingRadius } = this.options;

        const playerChunkX = Math.floor((playerX + worldSize / 2) / chunkSize);
        const playerChunkZ = Math.floor((playerZ + worldSize / 2) / chunkSize);

        const toShow: string[] = [];
        const toHide: string[] = [];

        for (let dx = -streamingRadius; dx <= streamingRadius; dx++) {
            for (let dz = -streamingRadius; dz <= streamingRadius; dz++) {
                const cx = playerChunkX + dx;
                const cz = playerChunkZ + dz;
                if (cx < 0 || cx >= chunksPerSide || cz < 0 || cz >= chunksPerSide) continue;
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
            if (dx > streamingRadius || dz > streamingRadius) {
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

    dispose() {
        this.chunks.forEach(chunk => {
            this.options.scene.remove(chunk.floorMesh);
            this.options.scene.remove(chunk.ceilingMesh);
            this.options.scene.remove(chunk.wallMesh);
            chunk.floorMesh.dispose();
            chunk.ceilingMesh.dispose();
            chunk.wallMesh.dispose();
        });
        this.chunks.clear();
        this.loadedChunkKeys.clear();
    }
}
