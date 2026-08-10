// src/features/game/world/building/BuildRenderer.ts
import * as THREE from "three";
import { CollisionGrid } from "../CollisionGrid";
import {
    CELL_SIZE,
    LEVEL_HEIGHT,
    WALL_THICKNESS,
    getBuildEntry,
    getBuildParts,
    getBuildMaterial,
} from "./BuildCatalog";
import { BuildLayout, cellToWorld, levelBaseY, type BuildPiece } from "./BuildLayout";

const CHUNK_CELLS = 12;

interface ChunkBucket {
    meshes: Map<string, THREE.InstancedMesh>;
    group: THREE.Group;
}

function chunkIdOf(piece: BuildPiece): string {
    return `${Math.floor(piece.x / CHUNK_CELLS)}:${Math.floor(piece.z / CHUNK_CELLS)}:${piece.l}`;
}

export class BuildRenderer {
    public readonly group = new THREE.Group();

    private chunks = new Map<string, ChunkBucket>();
    private dirty = new Set<string>();
    private dummy = new THREE.Object3D();
    private box = new THREE.Box3();

    constructor(private layout: BuildLayout, private collisionGrid: CollisionGrid | null) { }

    public markAll() {
        this.dirty.clear();
        for (const chunkId of this.chunks.keys()) this.dirty.add(chunkId);
        for (const piece of this.layout.list()) this.dirty.add(chunkIdOf(piece));
    }

    public markPiece(piece: BuildPiece) {
        this.dirty.add(chunkIdOf(piece));
    }

    public flush() {
        if (this.dirty.size === 0) return;

        const grouped = new Map<string, BuildPiece[]>();
        for (const piece of this.layout.list()) {
            const chunkId = chunkIdOf(piece);
            if (!this.dirty.has(chunkId)) continue;
            const bucket = grouped.get(chunkId);
            if (bucket) bucket.push(piece);
            else grouped.set(chunkId, [piece]);
        }

        for (const chunkId of this.dirty) {
            this.rebuildChunk(chunkId, grouped.get(chunkId) ?? []);
        }

        this.dirty.clear();
        this.rebuildCollision();
    }

    private disposeChunk(chunkId: string) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) return;

        chunk.meshes.forEach((mesh) => {
            chunk.group.remove(mesh);
            mesh.dispose();
        });
        chunk.meshes.clear();
        this.group.remove(chunk.group);
        this.chunks.delete(chunkId);
    }

    private rebuildChunk(chunkId: string, pieces: BuildPiece[]) {
        this.disposeChunk(chunkId);
        if (pieces.length === 0) return;

        const counts = new Map<string, number>();
        for (const piece of pieces) {
            const parts = getBuildParts(piece.t);
            for (let i = 0; i < parts.length; i++) {
                const key = `${piece.t}#${i}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        const chunk: ChunkBucket = { meshes: new Map(), group: new THREE.Group() };

        counts.forEach((count, key) => {
            const [typeId, indexRaw] = key.split("#");
            const index = Number(indexRaw);
            const parts = getBuildParts(typeId);
            const part = parts[index];
            if (!part) return;

            const mesh = new THREE.InstancedMesh(part.geometry, getBuildMaterial(part.surface), count);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.count = 0;
            chunk.meshes.set(key, mesh);
            chunk.group.add(mesh);
        });

        for (const piece of pieces) {
            const parts = getBuildParts(piece.t);
            this.applyTransform(piece);

            for (let i = 0; i < parts.length; i++) {
                const mesh = chunk.meshes.get(`${piece.t}#${i}`);
                if (!mesh) continue;
                mesh.setMatrixAt(mesh.count, this.dummy.matrix);
                mesh.count += 1;
            }
        }

        chunk.meshes.forEach((mesh) => {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        });

        this.group.add(chunk.group);
        this.chunks.set(chunkId, chunk);
    }

    private applyTransform(piece: BuildPiece) {
        this.dummy.position.set(
            cellToWorld(piece.x, this.layout.plotSize),
            levelBaseY(piece.l),
            cellToWorld(piece.z, this.layout.plotSize)
        );
        this.dummy.rotation.set(0, (piece.r * Math.PI) / 2, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
    }

    private rebuildCollision() {
        if (!this.collisionGrid) return;

        this.collisionGrid.clear();

        for (const piece of this.layout.list()) {
            const entry = getBuildEntry(piece.t);
            if (!entry) continue;

            const worldX = cellToWorld(piece.x, this.layout.plotSize);
            const worldZ = cellToWorld(piece.z, this.layout.plotSize);
            const baseY = levelBaseY(piece.l);

            if (entry.walkableTop !== null) {
                this.box.min.set(worldX - CELL_SIZE / 2, baseY + entry.walkableTop - 0.35, worldZ - CELL_SIZE / 2);
                this.box.max.set(worldX + CELL_SIZE / 2, baseY + entry.walkableTop, worldZ + CELL_SIZE / 2);
                this.collisionGrid.insert(this.box.clone());
            }

            if (!entry.blocking) continue;

            if (entry.slot === "edge") {
                const half = CELL_SIZE / 2;
                const offset = half - WALL_THICKNESS / 2;
                const angle = (piece.r * Math.PI) / 2;
                const centerX = worldX + Math.sin(angle) * offset;
                const centerZ = worldZ - Math.cos(angle) * offset;
                const alongX = Math.abs(Math.cos(angle)) > 0.5;

                const halfWidth = alongX ? half : WALL_THICKNESS;
                const halfDepth = alongX ? WALL_THICKNESS : half;

                this.box.min.set(centerX - halfWidth, baseY, centerZ - halfDepth);
                this.box.max.set(centerX + halfWidth, baseY + LEVEL_HEIGHT, centerZ + halfDepth);
                this.collisionGrid.insert(this.box.clone());
                continue;
            }

            this.box.min.set(worldX - CELL_SIZE * 0.4, baseY, worldZ - CELL_SIZE * 0.4);
            this.box.max.set(worldX + CELL_SIZE * 0.4, baseY + LEVEL_HEIGHT * 0.7, worldZ + CELL_SIZE * 0.4);
            this.collisionGrid.insert(this.box.clone());
        }
    }

    public getSurfaceHeightAt(worldX: number, worldZ: number): number {
        let highest = 0;

        for (const piece of this.layout.list()) {
            const entry = getBuildEntry(piece.t);
            if (!entry || entry.walkableTop === null) continue;

            const centerX = cellToWorld(piece.x, this.layout.plotSize);
            const centerZ = cellToWorld(piece.z, this.layout.plotSize);
            if (Math.abs(worldX - centerX) > CELL_SIZE / 2) continue;
            if (Math.abs(worldZ - centerZ) > CELL_SIZE / 2) continue;

            const top = levelBaseY(piece.l) + entry.walkableTop;
            if (top > highest) highest = top;
        }

        return highest;
    }

    public setLevelVisibility(maxLevel: number | null) {
        this.chunks.forEach((chunk, chunkId) => {
            const level = Number(chunkId.split(":")[2]);
            chunk.group.visible = maxLevel === null || level <= maxLevel;
        });
    }

    public dispose() {
        for (const chunkId of Array.from(this.chunks.keys())) this.disposeChunk(chunkId);
        this.chunks.clear();
        this.dirty.clear();
        this.group.removeFromParent();
    }
}
