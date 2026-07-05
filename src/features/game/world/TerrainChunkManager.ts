// src/features/game/world/TerrainChunkManager.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

export interface TerrainChunkConfig {
    chunkSize: number;
    segmentsPerChunk: number;
    worldSize: number;
}

export class TerrainChunk {
    public mesh: THREE.Mesh;
    public chunkX: number;
    public chunkZ: number;
    public worldX: number;
    public worldZ: number;
    public heightCache: Float32Array = new Float32Array(0);
    public originalHeightCache: Float32Array = new Float32Array(0);
    public cacheSize: number = 0;
    public colliders: THREE.Box3[] = [];

    private readonly _chunkSize: number;
    private readonly _segmentsPerChunk: number;
    private readonly _heightFunction: (x: number, z: number) => number;

    constructor(
        chunkX: number,
        chunkZ: number,
        config: TerrainChunkConfig,
        heightFunction: (x: number, z: number) => number
    ) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this._chunkSize = config.chunkSize;
        this._segmentsPerChunk = config.segmentsPerChunk;
        this._heightFunction = heightFunction;

        const halfWorld = config.worldSize / 2;
        this.worldX = -halfWorld + chunkX * config.chunkSize + config.chunkSize / 2;
        this.worldZ = -halfWorld + chunkZ * config.chunkSize + config.chunkSize / 2;

        const geometry = this.createChunkGeometry(config);

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0,
            side: THREE.FrontSide,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.set(this.worldX, 0, this.worldZ);
        this.mesh.receiveShadow = true;
        this.mesh.name = `terrain-chunk-${chunkX}-${chunkZ}`;
    }

    private createChunkGeometry(config: TerrainChunkConfig): THREE.BufferGeometry {
        const segments = config.segmentsPerChunk;
        const chunkSize = config.chunkSize;

        const geometry = new THREE.PlaneGeometry(
            chunkSize,
            chunkSize,
            segments,
            segments
        );

        const positions = geometry.attributes.position;
        this.cacheSize = segments + 1;
        this.heightCache = new Float32Array(this.cacheSize * this.cacheSize);
        this.originalHeightCache = new Float32Array(this.cacheSize * this.cacheSize);

        const step = chunkSize / segments;
        const halfSize = chunkSize / 2;

        for (let i = 0; i < positions.count; i++) {
            const gridX = i % (segments + 1);
            const gridY = Math.floor(i / (segments + 1));

            const localX = -halfSize + gridX * step;
            const localY = -halfSize + gridY * step;

            const worldPosX = this.worldX + localX;
            const worldPosZ = this.worldZ + localY;

            const height = this._heightFunction(worldPosX, worldPosZ);

            positions.setZ(i, height);

            const idx = gridY * this.cacheSize + gridX;
            this.heightCache[idx] = height;
            this.originalHeightCache[idx] = height;
        }

        positions.needsUpdate = true;
        return geometry;
    }

    getHeightAtLocal(localX: number, localZ: number): number {
        return this.interpolateHeight(localX, localZ, this.heightCache);
    }

    getOriginalHeightAtLocal(localX: number, localZ: number): number {
        return this.interpolateHeight(localX, localZ, this.originalHeightCache);
    }

    private interpolateHeight(localX: number, localZ: number, cache: Float32Array): number {
        const segments = this._segmentsPerChunk;

        const gridX = ((localX / this._chunkSize) + 0.5) * segments;
        const gridZ = ((localZ / this._chunkSize) + 0.5) * segments;

        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = Math.min(x0 + 1, segments);
        const z1 = Math.min(z0 + 1, segments);

        if (x0 < 0 || z0 < 0 || x1 > segments || z1 > segments) return 0;

        const fx = gridX - x0;
        const fz = gridZ - z0;

        const h00 = cache[z0 * this.cacheSize + x0];
        const h10 = cache[z0 * this.cacheSize + x1];
        const h01 = cache[z1 * this.cacheSize + x0];
        const h11 = cache[z1 * this.cacheSize + x1];

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;

        return h0 * (1 - fz) + h1 * fz;
    }

    applyTexture(rm: ResourceManager) {
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        const colorMap = rm.getTexture("ground-color");
        const normalMap = rm.getTexture("ground-normal");
        const roughnessMap = rm.getTexture("ground-roughness");
        const aoMap = rm.getTexture("ground-ao");

        const repeatPerChunk = 10;

        if (colorMap) {
            material.map = colorMap.clone();
            material.map.repeat.set(repeatPerChunk, repeatPerChunk);
            material.map.needsUpdate = true;
        }
        if (normalMap) {
            material.normalMap = normalMap.clone();
            material.normalMap.repeat.set(repeatPerChunk, repeatPerChunk);
            material.normalScale.set(1.5, 1.5);
            material.normalMap.needsUpdate = true;
        }
        if (roughnessMap) {
            material.roughnessMap = roughnessMap.clone();
            material.roughnessMap.repeat.set(repeatPerChunk, repeatPerChunk);
            material.roughnessMap.needsUpdate = true;
        }
        if (aoMap) {
            material.aoMap = aoMap.clone();
            material.aoMap.repeat.set(repeatPerChunk, repeatPerChunk);
            material.aoMapIntensity = 0.7;
            material.aoMap.needsUpdate = true;
            this.mesh.geometry.setAttribute('uv2', this.mesh.geometry.attributes.uv);
        }
    }

    applyLake(
        centerX: number, centerZ: number,
        radius: number, depth: number,
        transitionWidth: number
    ) {
        const geometry = this.mesh.geometry;
        const positions = geometry.attributes.position;

        const localCenterX = centerX - this.worldX;
        const localCenterZ = centerZ - this.worldZ;

        const radiusSq = radius * radius;
        const outerRadius = radius + transitionWidth;
        const outerRadiusSq = outerRadius * outerRadius;

        let modified = false;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);

            const dx = x - localCenterX;
            const dy = y - localCenterZ;
            const distSq = dx * dx + dy * dy;

            if (distSq < radiusSq) {
                positions.setZ(i, -depth);
                modified = true;
            } else if (distSq < outerRadiusSq) {
                const dist = Math.sqrt(distSq);
                const originalZ = this.getOriginalHeightAtLocal(x, y);
                const transitionProgress = (dist - radius) / transitionWidth;
                const smoothProgress = this.smoothstep(0, 1, transitionProgress);
                const targetZ = -depth + ((originalZ - (-depth)) * smoothProgress);
                positions.setZ(i, targetZ);
                modified = true;
            }
        }

        if (modified) {
            positions.needsUpdate = true;
            this.rebuildHeightCache();
        }
    }

    private smoothstep(edge0: number, edge1: number, x: number): number {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    private rebuildHeightCache() {
        const geometry = this.mesh.geometry;
        const positions = geometry.attributes.position;
        const segments = this._segmentsPerChunk;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            const gridX = Math.round(((x / this._chunkSize) + 0.5) * segments);
            const gridY = Math.round(((y / this._chunkSize) + 0.5) * segments);

            if (gridX >= 0 && gridX <= segments && gridY >= 0 && gridY <= segments) {
                this.heightCache[gridY * this.cacheSize + gridX] = z;
            }
        }
    }

    computeNormals() {
        this.mesh.geometry.computeVertexNormals();
    }

    dispose() {
        this.mesh.geometry.dispose();
        const material = this.mesh.material as THREE.MeshStandardMaterial;
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        material.dispose();
    }
}

export class TerrainChunkManager {
    public chunks: Map<string, TerrainChunk> = new Map();
    public config: TerrainChunkConfig;
    private heightFunction: (x: number, z: number) => number;
    private chunksPerSide: number;

    constructor(config: TerrainChunkConfig, heightFunction: (x: number, z: number) => number) {
        this.config = config;
        this.heightFunction = heightFunction;
        this.chunksPerSide = Math.ceil(config.worldSize / config.chunkSize);
    }

    private getKey(chunkX: number, chunkZ: number): string {
        return `${chunkX},${chunkZ}`;
    }

    generateAll(rm: ResourceManager): TerrainChunk[] {
        const result: TerrainChunk[] = [];
        for (let cx = 0; cx < this.chunksPerSide; cx++) {
            for (let cz = 0; cz < this.chunksPerSide; cz++) {
                const chunk = new TerrainChunk(cx, cz, this.config, this.heightFunction);
                chunk.applyTexture(rm);
                this.chunks.set(this.getKey(cx, cz), chunk);
                result.push(chunk);
            }
        }
        return result;
    }

    computeAllNormals() {
        this.chunks.forEach(chunk => chunk.computeNormals());
    }

    getChunkAtWorldPos(worldX: number, worldZ: number): TerrainChunk | null {
        const halfWorld = this.config.worldSize / 2;
        const cx = Math.floor((worldX + halfWorld) / this.config.chunkSize);
        const cz = Math.floor((worldZ + halfWorld) / this.config.chunkSize);
        return this.chunks.get(this.getKey(cx, cz)) || null;
    }

    getHeightAt(worldX: number, worldZ: number): number {
        const chunk = this.getChunkAtWorldPos(worldX, worldZ);
        if (!chunk) return 0;

        const localX = worldX - chunk.worldX;
        const localZ = worldZ - chunk.worldZ;
        return chunk.getHeightAtLocal(localX, localZ);
    }

    getOriginalHeightAt(worldX: number, worldZ: number): number {
        const chunk = this.getChunkAtWorldPos(worldX, worldZ);
        if (!chunk) return 0;

        const localX = worldX - chunk.worldX;
        const localZ = worldZ - chunk.worldZ;
        return chunk.getOriginalHeightAtLocal(localX, localZ);
    }

    applyLake(
        centerX: number, centerZ: number,
        radius: number, depth: number,
        transitionWidth: number
    ) {
        const affectedRadius = radius + transitionWidth;
        const halfWorld = this.config.worldSize / 2;

        const minCX = Math.floor((centerX - affectedRadius + halfWorld) / this.config.chunkSize);
        const maxCX = Math.floor((centerX + affectedRadius + halfWorld) / this.config.chunkSize);
        const minCZ = Math.floor((centerZ - affectedRadius + halfWorld) / this.config.chunkSize);
        const maxCZ = Math.floor((centerZ + affectedRadius + halfWorld) / this.config.chunkSize);

        for (let cx = Math.max(0, minCX); cx <= Math.min(this.chunksPerSide - 1, maxCX); cx++) {
            for (let cz = Math.max(0, minCZ); cz <= Math.min(this.chunksPerSide - 1, maxCZ); cz++) {
                const chunk = this.chunks.get(this.getKey(cx, cz));
                if (chunk) {
                    chunk.applyLake(centerX, centerZ, radius, depth, transitionWidth);
                }
            }
        }
    }

    dispose() {
        this.chunks.forEach(chunk => chunk.dispose());
        this.chunks.clear();
    }
}