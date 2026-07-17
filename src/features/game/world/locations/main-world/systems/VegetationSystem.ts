//src\features\game\world\locations\main-world\systems\VegetationSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createGrassBladeGeometry, createGrassMaterial } from "../utils/grass";
import { fbm, hash2D } from "../utils/noise";

export class VegetationSystem {
    private treeInstances: Map<string, THREE.InstancedMesh> = new Map();
    private rockInstances: Map<string, THREE.InstancedMesh> = new Map();
    private grassInstances: Map<string, THREE.InstancedMesh> = new Map();

    private treeGeometry: THREE.BufferGeometry | null = null;
    private treeMaterial: THREE.Material | null = null;
    private treeBBox: THREE.Box3 | null = null;

    private rockGeometry: THREE.BufferGeometry | null = null;
    private rockMaterial: THREE.Material | null = null;
    private rockBBox: THREE.Box3 | null = null;

    private grassGeometry: THREE.BufferGeometry | null = null;
    private grassMaterial: THREE.Material | null = null;

    private loadedChunkKeys: Set<string> = new Set();
    private readonly streamingRadius: number = 2;

    private safeZones = [
        { x: 0, z: 0, r: 45 },      
        { x: 50, z: 0, r: 20 },     
        { x: 300, z: 0, r: 180 },   
    ];

    constructor(private world: MainWorld) { }

    prepareAssets(rm: ResourceManager) {
        const treeData = rm.getModel("tree");
        if (treeData && !this.treeGeometry) {
            const mesh = this.findFirstMesh(treeData.scene);
            if (mesh?.geometry) {
                const { geometry, material } = this.cloneAndRotateGeometry(mesh);
                this.treeGeometry = geometry;
                this.treeMaterial = material;
                this.treeGeometry.computeBoundingBox();
                this.treeBBox = this.treeGeometry.boundingBox!.clone();
            }
        }

        const rockData = rm.getModel("rock");
        if (rockData && !this.rockGeometry) {
            const mesh = this.findFirstMesh(rockData.scene);
            if (mesh?.geometry) {
                const { geometry, material } = this.cloneAndRotateGeometry(mesh);
                this.rockGeometry = geometry;
                this.rockMaterial = material;
                this.rockGeometry.computeBoundingBox();
                this.rockBBox = this.rockGeometry.boundingBox!.clone();
            }
        }

        const grassData = rm.getModel("grass");
        if (grassData && !this.grassGeometry) {
            this.grassGeometry = createGrassBladeGeometry();
            const mesh = this.findFirstMesh(grassData.scene);
            let baseMat = new THREE.MeshStandardMaterial({ color: 0x4a8f2a });
            if (mesh?.material) {
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                if (mat instanceof THREE.MeshStandardMaterial) baseMat = mat;
                else if ((mat as any).color) baseMat = new THREE.MeshStandardMaterial({ color: (mat as any).color });
            }
            this.grassMaterial = createGrassMaterial(baseMat);
        }
    }

    private findFirstMesh(scene: THREE.Group): THREE.Mesh | null {
        let found: THREE.Mesh | null = null;
        scene.traverse((child) => {
            if (!found && (child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
                found = child as THREE.Mesh;
            }
        });
        return found;
    }

    private cloneAndRotateGeometry(sourceMesh: THREE.Mesh) {
        const geometry = sourceMesh.geometry.clone();
        const material = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material;
        geometry.rotateX(-Math.PI / 2);
        return { geometry, material };
    }

    private isInSafeZone(x: number, z: number) {
        for (const zone of this.safeZones) {
            const dx = x - zone.x;
            const dz = z - zone.z;
            if (dx * dx + dz * dz < zone.r * zone.r) {
                return true;
            }
        }
        return false;
    }

    createVegetationByChunks(rm: ResourceManager) {
        if (!this.treeGeometry || !this.treeMaterial) return;
        const treesPerChunk = 50;
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();

        this.world.terrain.chunks.forEach((chunk, key) => {
            const instances = new THREE.InstancedMesh(this.treeGeometry!, this.treeMaterial!, treesPerChunk);
            instances.castShadow = true;
            instances.receiveShadow = true;
            let placed = 0;

            for (let i = 0; i < treesPerChunk; i++) {
                let worldX: number, worldZ: number, attempts = 0;
                do {
                    worldX = chunk.worldX + (-this.world.terrain.config.chunkSize / 2 + Math.random() * this.world.terrain.config.chunkSize);
                    worldZ = chunk.worldZ + (-this.world.terrain.config.chunkSize / 2 + Math.random() * this.world.terrain.config.chunkSize);
                    attempts++;
                } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

                if (this.isInSafeZone(worldX, worldZ)) continue;

                const terrainHeight = this.world.terrain.getHeightAt(worldX, worldZ);
                if (fbm(worldX * 0.015, worldZ * 0.015) < 0.42) continue;

                position.set(worldX, terrainHeight, worldZ);
                rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
                const r = Math.pow(Math.random(), 2.2);
                const hMult = THREE.MathUtils.lerp(1.6, 5.8, r);
                const tMult = Math.sqrt(hMult);
                const wNoise = 0.85 + Math.random() * 0.35;
                scale.set(tMult * wNoise, hMult, tMult * wNoise);
                if (Math.random() < 0.03) { scale.multiplyScalar(1.8); scale.y *= 1.4; }

                matrix.compose(position, rotation, scale);
                instances.setMatrixAt(placed, matrix);

                const trunkRadius = 0.2 * scale.x;
                const trunkHeight = 2.0 * scale.y;
                const trunkBbox = new THREE.Box3(
                    new THREE.Vector3(
                        position.x - trunkRadius,
                        position.y,
                        position.z - trunkRadius
                    ),
                    new THREE.Vector3(
                        position.x + trunkRadius,
                        position.y + trunkHeight,
                        position.z + trunkRadius
                    )
                );
                chunk.colliders.push(trunkBbox);

                placed++;
            }
            instances.count = placed;
            instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances);
            this.treeInstances.set(key, instances);
        });
    }

    createRocksByChunks(rm: ResourceManager) {
        if (!this.rockGeometry || !this.rockMaterial) return;
        const rocksPerChunk = 2;
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();

        this.world.terrain.chunks.forEach((chunk, key) => {
            const instances = new THREE.InstancedMesh(this.rockGeometry!, this.rockMaterial!, rocksPerChunk);
            instances.receiveShadow = true;
            let placed = 0;

            for (let i = 0; i < rocksPerChunk; i++) {
                let worldX: number, worldZ: number, attempts = 0;
                do {
                    worldX = chunk.worldX + (-this.world.terrain.config.chunkSize / 2 + Math.random() * this.world.terrain.config.chunkSize);
                    worldZ = chunk.worldZ + (-this.world.terrain.config.chunkSize / 2 + Math.random() * this.world.terrain.config.chunkSize);
                    attempts++;
                } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

                if (this.isInSafeZone(worldX, worldZ)) continue;

                const terrainHeight = this.world.terrain.getHeightAt(worldX, worldZ);

                position.set(worldX, terrainHeight, worldZ);
                rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
                const s = 0.6 + Math.random() * 1.2;
                scale.set(s, s, s);
                matrix.compose(position, rotation, scale);
                instances.setMatrixAt(placed, matrix);

                const rockRadius = 0.5 * scale.x;
                const rockBbox = new THREE.Box3(
                    new THREE.Vector3(
                        position.x - rockRadius,
                        position.y,
                        position.z - rockRadius
                    ),
                    new THREE.Vector3(
                        position.x + rockRadius,
                        position.y + rockRadius * 2,
                        position.z + rockRadius
                    )
                );
                chunk.colliders.push(rockBbox);

                placed++;
            }
            instances.count = placed;
            instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances);
            this.rockInstances.set(key, instances);
        });
    }

    createDecorationsByChunks(rm: ResourceManager) {
        if (!this.grassGeometry || !this.grassMaterial) return;
        const maxGrass = 4000;
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();

        this.world.terrain.chunks.forEach((chunk, key) => {
            const instances = new THREE.InstancedMesh(this.grassGeometry!, this.grassMaterial!, maxGrass);
            let placed = 0;
            const gridSize = 63, cellSize = this.world.terrain.config.chunkSize / gridSize;

            for (let gx = 0; gx < gridSize; gx++) {
                for (let gz = 0; gz < gridSize; gz++) {
                    const worldX = chunk.worldX + (-this.world.terrain.config.chunkSize / 2 + (gx + 0.5) * cellSize);
                    const worldZ = chunk.worldZ + (-this.world.terrain.config.chunkSize / 2 + (gz + 0.5) * cellSize);
                    const density = fbm(worldX * 0.05, worldZ * 0.05) * 1.2;
                    if (density < 0.08) continue;

                    const finalX = worldX + (hash2D(gx * 1.1, gz * 2.2) - 0.5) * cellSize * 0.8;
                    const finalZ = worldZ + (hash2D(gx * 3.3, gz * 4.4) - 0.5) * cellSize * 0.8;

                    if (this.isInSafeZone(finalX, finalZ)) continue;

                    position.set(finalX, this.world.terrain.getHeightAt(finalX, finalZ), finalZ);
                    rotation.setFromEuler(new THREE.Euler(0, hash2D(finalX * 10, finalZ * 10) * Math.PI * 2, 0));
                    const s = 0.7 + density * 0.6;
                    scale.set(s, s + hash2D(finalX, finalZ) * 0.4, s);
                    matrix.compose(position, rotation, scale);
                    instances.setMatrixAt(placed, matrix);
                    placed++;
                    if (placed >= maxGrass) break;
                }
                if (placed >= maxGrass) break;
            }
            instances.count = placed;
            instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances);
            this.grassInstances.set(key, instances);
        });
    }

    clearVegetationAroundPortal(centerX: number, centerZ: number, radius: number) {
        const radiusSq = radius * radius;
        this.world.terrain.chunks.forEach((chunk, key) => {
            [this.treeInstances, this.rockInstances].forEach((map) => {
                const instances = map.get(key);
                if (!instances) return;
                const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
                let removed = 0;

                for (let i = 0; i < instances.count; i++) {
                    instances.getMatrixAt(i, matrix);
                    pos.setFromMatrixPosition(matrix);
                    const distSq = Math.pow(pos.x - centerX, 2) + Math.pow(pos.z - centerZ, 2);

                    if (distSq <= radiusSq) {
                        matrix.makeScale(0, 0, 0);
                        instances.setMatrixAt(i, matrix);
                        removed++;
                    }
                }

                if (removed > 0) {
                    instances.instanceMatrix.needsUpdate = true;
                    chunk.colliders = chunk.colliders.filter(box => {
                        const center = box.getCenter(new THREE.Vector3());
                        const cDistSq = Math.pow(center.x - centerX, 2) + Math.pow(center.z - centerZ, 2);
                        return cDistSq > radiusSq;
                    });
                }
            });
        });
    }

    updateStreamingAndVisibility(playerX: number, playerZ: number) {
        const playerChunk = this.world.terrain.getChunkAtWorldPos(playerX, playerZ);
        if (!playerChunk) return;

        const toShow: string[] = [], toHide: string[] = [];
        for (let dx = -this.streamingRadius; dx <= this.streamingRadius; dx++) {
            for (let dz = -this.streamingRadius; dz <= this.streamingRadius; dz++) {
                const key = `${playerChunk.chunkX + dx},${playerChunk.chunkZ + dz}`;
                if (this.world.terrain.chunks.has(key) && !this.loadedChunkKeys.has(key)) toShow.push(key);
            }
        }
        this.loadedChunkKeys.forEach(key => {
            const chunk = this.world.terrain.chunks.get(key);
            if (chunk && (Math.abs(chunk.chunkX - playerChunk.chunkX) > this.streamingRadius || Math.abs(chunk.chunkZ - playerChunk.chunkZ) > this.streamingRadius)) {
                toHide.push(key);
            }
        });

        for (const key of toShow) {
            const chunk = this.world.terrain.chunks.get(key);
            if (chunk) {
                chunk.mesh.visible = true;
                const trees = this.treeInstances.get(key);
                if (trees) trees.visible = true;
                const rocks = this.rockInstances.get(key);
                if (rocks) rocks.visible = true;
                const grass = this.grassInstances.get(key);
                if (grass) grass.visible = true;
                this.loadedChunkKeys.add(key);
            }
        }
        for (const key of toHide) {
            const chunk = this.world.terrain.chunks.get(key);
            if (chunk) {
                chunk.mesh.visible = false;
                const trees = this.treeInstances.get(key);
                if (trees) trees.visible = false;
                const rocks = this.rockInstances.get(key);
                if (rocks) rocks.visible = false;
                const grass = this.grassInstances.get(key);
                if (grass) grass.visible = false;
                this.loadedChunkKeys.delete(key);
            }
        }
    }

    dispose() {
        [this.treeInstances, this.rockInstances, this.grassInstances].forEach(map => {
            map.forEach(inst => { this.world.scene.remove(inst); inst.dispose(); });
            map.clear();
        });
        this.treeGeometry?.dispose(); this.treeMaterial?.dispose();
        this.rockGeometry?.dispose(); this.rockMaterial?.dispose();
        this.grassGeometry?.dispose(); this.grassMaterial?.dispose();
    }
}