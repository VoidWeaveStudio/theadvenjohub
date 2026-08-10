// src/features/game/world/building/BuildRenderer.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CollisionGrid } from "../CollisionGrid";
import {
    CELL_SIZE,
    DOOR_LEAF,
    HALF,
    LEVEL_HEIGHT,
    STAIR_STEPS,
    WALL_THICKNESS,
    getBuildEntry,
    getBuildParts,
    getBuildMaterial,
    getDoorLeafGeometry,
} from "./BuildCatalog";
import type { SurfaceId } from "./buildTextures";
import { BuildLayout, cellToWorld, levelBaseY, pieceKey, worldToCell, type BuildPiece } from "./BuildLayout";

const CHUNK_CELLS = 12;
const WALL_SKIN = 0.03;
const COVER_CLEARANCE = 0.5;
const DOOR_TRIGGER_RADIUS = 2.6;
const DOOR_SPEED = 5;

interface ChunkBucket {
    meshes: THREE.Mesh[];
    group: THREE.Group;
}

interface DoorInstance {
    root: THREE.Group;
    pivot: THREE.Group;
    worldX: number;
    worldZ: number;
    baseY: number;
    angle: number;
    target: number;
}

function chunkIdOf(piece: BuildPiece): string {
    return `${Math.floor(piece.x / CHUNK_CELLS)}:${Math.floor(piece.z / CHUNK_CELLS)}:${piece.l}`;
}

function cellIdOf(x: number, z: number): string {
    return `${x}:${z}`;
}

function rampHeightAt(piece: BuildPiece, rise: number, worldX: number, worldZ: number, plotSize: number): number {
    const dx = worldX - cellToWorld(piece.x, plotSize);
    const dz = worldZ - cellToWorld(piece.z, plotSize);
    const angle = (piece.r * Math.PI) / 2;
    const localZ = Math.sin(angle) * dx + Math.cos(angle) * dz;
    return rise * THREE.MathUtils.clamp((HALF - localZ) / CELL_SIZE, 0, 1);
}

export class BuildRenderer {
    public readonly group = new THREE.Group();
    public readonly staticColliders: THREE.Box3[] = [];

    private chunks = new Map<string, ChunkBucket>();
    private cellIndex = new Map<string, BuildPiece[]>();
    private doors = new Map<string, DoorInstance>();
    private dirty = new Set<string>();
    private matrix = new THREE.Matrix4();
    private euler = new THREE.Euler();
    private quaternion = new THREE.Quaternion();
    private position = new THREE.Vector3();
    private scale = new THREE.Vector3(1, 1, 1);

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
        this.rebuildCellIndex();
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
        this.syncDoors();
        this.rebuildCollision();
    }

    private disposeChunk(chunkId: string) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) return;

        for (const mesh of chunk.meshes) {
            chunk.group.remove(mesh);
            mesh.geometry.dispose();
        }
        chunk.meshes.length = 0;
        this.group.remove(chunk.group);
        this.chunks.delete(chunkId);
    }

    private pieceMatrix(piece: BuildPiece): THREE.Matrix4 {
        this.position.set(
            cellToWorld(piece.x, this.layout.plotSize),
            levelBaseY(piece.l),
            cellToWorld(piece.z, this.layout.plotSize)
        );
        this.euler.set(0, (piece.r * Math.PI) / 2, 0);
        this.quaternion.setFromEuler(this.euler);
        return this.matrix.compose(this.position, this.quaternion, this.scale);
    }

    private rebuildChunk(chunkId: string, pieces: BuildPiece[]) {
        this.disposeChunk(chunkId);
        if (pieces.length === 0) return;

        const bySurface = new Map<SurfaceId, THREE.BufferGeometry[]>();

        for (const piece of pieces) {
            const matrix = this.pieceMatrix(piece);

            for (const part of getBuildParts(piece.t)) {
                const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
                geometry.applyMatrix4(matrix);

                const bucket = bySurface.get(part.surface);
                if (bucket) bucket.push(geometry);
                else bySurface.set(part.surface, [geometry]);
            }
        }

        const chunk: ChunkBucket = { meshes: [], group: new THREE.Group() };
        chunk.group.matrixAutoUpdate = false;

        bySurface.forEach((geometries, surface) => {
            const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
            if (geometries.length > 1) geometries.forEach((geometry) => geometry.dispose());
            if (!merged) {
                console.error("[BuildRenderer] could not merge chunk geometry", { surface, count: geometries.length });
                return;
            }

            const mesh = new THREE.Mesh(merged, getBuildMaterial(surface));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();

            chunk.meshes.push(mesh);
            chunk.group.add(mesh);
        });

        this.group.add(chunk.group);
        this.chunks.set(chunkId, chunk);
    }

    private syncDoors() {
        const seen = new Set<string>();

        for (const piece of this.layout.list()) {
            const entry = getBuildEntry(piece.t);
            if (!entry?.hinged) continue;

            const key = pieceKey(piece);
            seen.add(key);
            if (this.doors.has(key)) continue;

            const mesh = new THREE.Mesh(getDoorLeafGeometry(), getBuildMaterial(DOOR_LEAF.surface));
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const pivot = new THREE.Group();
            pivot.add(mesh);
            pivot.position.set(DOOR_LEAF.hingeX, 0, DOOR_LEAF.z);

            const root = new THREE.Group();
            root.add(pivot);
            root.applyMatrix4(this.pieceMatrix(piece));
            this.group.add(root);

            this.doors.set(key, {
                root,
                pivot,
                worldX: cellToWorld(piece.x, this.layout.plotSize),
                worldZ: cellToWorld(piece.z, this.layout.plotSize),
                baseY: levelBaseY(piece.l),
                angle: 0,
                target: 0,
            });
        }

        for (const [key, door] of Array.from(this.doors.entries())) {
            if (seen.has(key)) continue;
            this.group.remove(door.root);
            this.doors.delete(key);
        }
    }

    public update(delta: number, viewerX: number, viewerY: number, viewerZ: number) {
        if (this.doors.size === 0) return;

        const blend = Math.min(1, delta * DOOR_SPEED);

        for (const door of this.doors.values()) {
            const dx = viewerX - door.worldX;
            const dz = viewerZ - door.worldZ;
            const near = dx * dx + dz * dz < DOOR_TRIGGER_RADIUS * DOOR_TRIGGER_RADIUS
                && Math.abs(viewerY - door.baseY) < LEVEL_HEIGHT;

            door.target = near ? DOOR_LEAF.openAngle : 0;
            door.angle = THREE.MathUtils.lerp(door.angle, door.target, blend);
            door.pivot.rotation.y = door.angle;
        }
    }

    private rebuildCellIndex() {
        this.cellIndex.clear();
        for (const piece of this.layout.list()) {
            const id = cellIdOf(piece.x, piece.z);
            const bucket = this.cellIndex.get(id);
            if (bucket) bucket.push(piece);
            else this.cellIndex.set(id, [piece]);
        }
    }

    private insertBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        this.collisionGrid?.insert(new THREE.Box3(
            new THREE.Vector3(minX, minY, minZ),
            new THREE.Vector3(maxX, maxY, maxZ)
        ));
    }

    private insertWallSpan(
        piece: BuildPiece, from: number, to: number, bottom: number, top: number, baseY: number
    ) {
        if (to - from <= 0.001 || top - bottom <= 0.001) return;

        const worldX = cellToWorld(piece.x, this.layout.plotSize);
        const worldZ = cellToWorld(piece.z, this.layout.plotSize);
        const angle = (piece.r * Math.PI) / 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const faceOffset = HALF - WALL_THICKNESS / 2;
        const mid = (from + to) / 2;

        const centerX = worldX - sin * faceOffset + cos * mid;
        const centerZ = worldZ - cos * faceOffset - sin * mid;

        const alongX = Math.abs(cos) > 0.5;
        const halfSpan = (to - from) / 2;
        const halfThick = WALL_THICKNESS / 2 + WALL_SKIN;

        const halfX = alongX ? halfSpan : halfThick;
        const halfZ = alongX ? halfThick : halfSpan;

        this.insertBox(
            centerX - halfX, baseY + bottom, centerZ - halfZ,
            centerX + halfX, baseY + top, centerZ + halfZ
        );
    }

    private insertStairSteps(piece: BuildPiece, rise: number, baseY: number) {
        const worldX = cellToWorld(piece.x, this.layout.plotSize);
        const worldZ = cellToWorld(piece.z, this.layout.plotSize);
        const angle = (piece.r * Math.PI) / 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const step = rise / STAIR_STEPS;
        const run = CELL_SIZE / STAIR_STEPS;
        const alongX = Math.abs(cos) > 0.5;

        for (let i = 0; i < STAIR_STEPS; i++) {
            const localZ = HALF - run / 2 - i * run;
            const centerX = worldX + sin * localZ;
            const centerZ = worldZ + cos * localZ;

            const halfX = alongX ? HALF : run / 2;
            const halfZ = alongX ? run / 2 : HALF;

            this.insertBox(
                centerX - halfX, baseY, centerZ - halfZ,
                centerX + halfX, baseY + (i + 1) * step, centerZ + halfZ
            );
        }
    }

    private rebuildCollision() {
        if (!this.collisionGrid) return;

        this.collisionGrid.clear();
        for (const box of this.staticColliders) this.collisionGrid.insert(box);

        for (const piece of this.layout.list()) {
            const entry = getBuildEntry(piece.t);
            if (!entry) continue;

            const worldX = cellToWorld(piece.x, this.layout.plotSize);
            const worldZ = cellToWorld(piece.z, this.layout.plotSize);
            const baseY = levelBaseY(piece.l);

            if (entry.ramp && entry.walkableTop !== null) {
                this.insertStairSteps(piece, entry.walkableTop, baseY);
            } else if (entry.walkableTop !== null) {
                this.insertBox(
                    worldX - HALF, baseY + entry.walkableTop - 0.35, worldZ - HALF,
                    worldX + HALF, baseY + entry.walkableTop, worldZ + HALF
                );
            }

            if (!entry.blocking) continue;

            if (entry.slot === "edge") {
                const height = entry.blockHeight ?? LEVEL_HEIGHT;
                const opening = entry.opening;

                if (!opening) {
                    this.insertWallSpan(piece, -HALF, HALF, 0, height, baseY);
                    continue;
                }

                const halfHole = opening.width / 2;
                this.insertWallSpan(piece, -HALF, -halfHole, 0, height, baseY);
                this.insertWallSpan(piece, halfHole, HALF, 0, height, baseY);
                this.insertWallSpan(piece, -halfHole, halfHole, 0, opening.bottom, baseY);
                this.insertWallSpan(piece, -halfHole, halfHole, opening.top, height, baseY);
                continue;
            }

            const height = entry.blockHeight ?? LEVEL_HEIGHT * 0.7;
            this.insertBox(
                worldX - CELL_SIZE * 0.4, baseY, worldZ - CELL_SIZE * 0.4,
                worldX + CELL_SIZE * 0.4, baseY + height, worldZ + CELL_SIZE * 0.4
            );
        }
    }

    private piecesAt(worldX: number, worldZ: number): BuildPiece[] | undefined {
        return this.cellIndex.get(cellIdOf(
            worldToCell(worldX, this.layout.plotSize),
            worldToCell(worldZ, this.layout.plotSize)
        ));
    }

    public getSurfaceHeightAt(worldX: number, worldZ: number, referenceY: number = Infinity): number {
        const pieces = this.piecesAt(worldX, worldZ);
        if (!pieces) return 0;

        const limit = referenceY + CollisionGrid.STEP_UP_HEIGHT;
        let highest = 0;

        for (const piece of pieces) {
            const entry = getBuildEntry(piece.t);
            if (!entry || entry.walkableTop === null) continue;

            const baseY = levelBaseY(piece.l);
            const top = entry.ramp
                ? baseY + rampHeightAt(piece, entry.walkableTop, worldX, worldZ, this.layout.plotSize)
                : baseY + entry.walkableTop;

            if (top > limit) continue;
            if (top > highest) highest = top;
        }

        return highest;
    }

    public getCoverHeightAt(worldX: number, worldZ: number, y: number): number {
        const pieces = this.piecesAt(worldX, worldZ);
        if (!pieces) return Infinity;

        let lowest = Infinity;

        for (const piece of pieces) {
            const entry = getBuildEntry(piece.t);
            if (!entry || entry.slot !== "tile") continue;
            if (entry.layer !== "ceiling" && entry.layer !== "roof" && entry.walkableTop === null) continue;

            const coverY = levelBaseY(piece.l) + (entry.layer === "ceiling" ? LEVEL_HEIGHT : 0);
            if (coverY <= y + COVER_CLEARANCE) continue;
            if (coverY < lowest) lowest = coverY;
        }

        return lowest;
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
        this.cellIndex.clear();
        this.doors.forEach((door) => this.group.remove(door.root));
        this.doors.clear();
        this.dirty.clear();
        this.staticColliders.length = 0;
        this.group.removeFromParent();
    }
}
