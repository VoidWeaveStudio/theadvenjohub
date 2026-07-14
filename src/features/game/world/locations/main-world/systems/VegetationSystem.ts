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
    private rockGeometry: THREE.BufferGeometry | null = null;
    private rockMaterial: THREE.Material | null = null;
    private grassGeometry: THREE.BufferGeometry | null = null;
    private grassMaterial: THREE.Material | null = null;

    private loadedChunkKeys: Set<string> = new Set();
    private readonly streamingRadius: number = 2;

    constructor(private world: MainWorld) { }

    prepareAssets(rm: ResourceManager) {
        const treeData = rm.getModel("tree");
        if (treeData) {
            const mesh = this.findFirstMesh(treeData.scene);
            if (mesh?.geometry) {
                const { geometry, material } = this.cloneAndRotateGeometry(mesh);
                this.treeGeometry = geometry; this.treeMaterial = material;
            }
        }
        const rockData = rm.getModel("rock");
        if (rockData) {
            const mesh = this.findFirstMesh(rockData.scene);
            if (mesh?.geometry) {
                const { geometry, material } = this.cloneAndRotateGeometry(mesh);
                this.rockGeometry = geometry; this.rockMaterial = material;
            }
        }
        const grassData = rm.getModel("grass");
        if (grassData) {
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
        scene.traverse((child) => { if (!found && (child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) found = child as THREE.Mesh; });
        return found;
    }

    private cloneAndRotateGeometry(sourceMesh: THREE.Mesh) {
        const geometry = sourceMesh.geometry.clone();
        const material = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material;
        geometry.rotateX(-Math.PI / 2);
        return { geometry, material };
    }

    private isInSafeZone(x: number, z: number) { return Math.sqrt(x * x + z * z) < 45; }

    createVegetationByChunks(rm: ResourceManager) {
        if (!this.treeGeometry || !this.treeMaterial) return;
        const treesPerChunk = 50, clearZoneRadius = 50;
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();

        this.world.terrain.chunks.forEach((chunk, key) => {
            const instances = new THREE.InstancedMesh(this.treeGeometry!, this.treeMaterial!, treesPerChunk);
            instances.castShadow = true; instances.receiveShadow = true;
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
                if (Math.sqrt(worldX * worldX + worldZ * worldZ) < clearZoneRadius) continue;
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
                chunk.colliders.push(new THREE.Box3(
                    new THREE.Vector3(worldX - 0.05 * scale.x, terrainHeight, worldZ - 0.05 * scale.x),
                    new THREE.Vector3(worldX + 0.05 * scale.x, terrainHeight + 2.2 * scale.y, worldZ + 0.05 * scale.x)
                ));
                placed++;
            }
            instances.count = placed; instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances); this.treeInstances.set(key, instances);
        });
    }

    createRocksByChunks(rm: ResourceManager) {
        if (!this.rockGeometry || !this.rockMaterial) return;
        const rocksPerChunk = 2, clearZoneRadius = 50;
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
                if (Math.sqrt(worldX * worldX + worldZ * worldZ) < clearZoneRadius) continue;

                position.set(worldX, terrainHeight, worldZ);
                rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
                const s = 0.6 + Math.random() * 1.2; scale.set(s, s, s);
                matrix.compose(position, rotation, scale);
                instances.setMatrixAt(placed, matrix);
                chunk.colliders.push(new THREE.Box3(new THREE.Vector3(worldX - 1, terrainHeight, worldZ - 1), new THREE.Vector3(worldX + 1, terrainHeight + 2, worldZ + 1)));
                placed++;
            }
            instances.count = placed; instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances); this.rockInstances.set(key, instances);
        });
    }

    createDecorationsByChunks(rm: ResourceManager) {
        if (!this.grassGeometry || !this.grassMaterial) return;
        const maxGrass = 4000, clearZoneRadius = 30;
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();

        this.world.terrain.chunks.forEach((chunk, key) => {
            const instances = new THREE.InstancedMesh(this.grassGeometry!, this.grassMaterial!, maxGrass);
            let placed = 0; const gridSize = 63, cellSize = this.world.terrain.config.chunkSize / gridSize;

            for (let gx = 0; gx < gridSize; gx++) {
                for (let gz = 0; gz < gridSize; gz++) {
                    const worldX = chunk.worldX + (-this.world.terrain.config.chunkSize / 2 + (gx + 0.5) * cellSize);
                    const worldZ = chunk.worldZ + (-this.world.terrain.config.chunkSize / 2 + (gz + 0.5) * cellSize);
                    const density = fbm(worldX * 0.05, worldZ * 0.05) * 1.2;
                    if (density < 0.08) continue;

                    const finalX = worldX + (hash2D(gx * 1.1, gz * 2.2) - 0.5) * cellSize * 0.8;
                    const finalZ = worldZ + (hash2D(gx * 3.3, gz * 4.4) - 0.5) * cellSize * 0.8;

                    if (this.isInSafeZone(finalX, finalZ) || Math.sqrt(finalX * finalX + finalZ * finalZ) < clearZoneRadius) continue;

                    position.set(finalX, this.world.terrain.getHeightAt(finalX, finalZ), finalZ);
                    rotation.setFromEuler(new THREE.Euler(0, hash2D(finalX * 10, finalZ * 10) * Math.PI * 2, 0));
                    const s = 0.7 + density * 0.6; scale.set(s, s + hash2D(finalX, finalZ) * 0.4, s);
                    matrix.compose(position, rotation, scale);
                    instances.setMatrixAt(placed, matrix); placed++;
                    if (placed >= maxGrass) break;
                }
                if (placed >= maxGrass) break;
            }
            instances.count = placed; instances.instanceMatrix.needsUpdate = true;
            this.world.scene.add(instances); this.grassInstances.set(key, instances);
        });
    }

    clearVegetationAroundPortal(centerX: number, centerZ: number, radius: number) {
        this.world.terrain.chunks.forEach((chunk, key) => {
            [this.treeInstances, this.rockInstances].forEach((map) => {
                const instances = map.get(key);
                if (!instances) return;
                const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
                let removed = 0;
                for (let i = 0; i < instances.count; i++) {
                    instances.getMatrixAt(i, matrix); pos.setFromMatrixPosition(matrix);
                    if (Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.z - centerZ, 2)) <= radius) {
                        matrix.makeScale(0, 0, 0); instances.setMatrixAt(i, matrix); removed++;
                    }
                }
                if (removed > 0) instances.instanceMatrix.needsUpdate = true;
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