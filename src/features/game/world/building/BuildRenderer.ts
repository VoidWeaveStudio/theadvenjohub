// src/features/game/world/building/BuildRenderer.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CollisionGrid } from "../CollisionGrid";
import {
    CELL_SIZE,
    DOOR_LEAF,
    HALF,
    LEVEL_HEIGHT,
    WALL_THICKNESS,
    applyBoxUv,
    getBuildEntry,
    getBuildParts,
    getBuildMaterial,
    getDoorLeafGeometry,
    stairSurfaceHeight,
    type BuildLightSpec,
} from "./BuildCatalog";
import { getSurfaceUvScale, type SurfaceId } from "./buildTextures";
import { BuildLayout, cellToWorld, levelBaseY, pieceKey, worldToCell, type BuildPiece } from "./BuildLayout";

const CHUNK_CELLS = 12;
const WALL_SKIN = 0.03;
const COVER_CLEARANCE = 0.5;
const DOOR_TRIGGER_RADIUS = 2.6;
const DOOR_SPEED = 5;
const MAX_ACTIVE_LIGHTS = 10;
const LIGHT_REFRESH_INTERVAL = 0.4;
const RAMP_SEGMENTS = 12;
const PAINT_REACH = 3.2;
const INTERACT_REACH = 3.2;

export const PAINT_PREFIX = "paint:";

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

interface PaintInstance {
    mesh: THREE.Mesh;
    url: string;
}

interface LightSource {
    x: number;
    y: number;
    z: number;
    level: number;
    phase: number;
    spec: BuildLightSpec;
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
    return stairSurfaceHeight(localZ, rise);
}

const paintTextures = new Map<string, THREE.Texture>();
const paintLoader = new THREE.TextureLoader();

function getPaintTexture(url: string): THREE.Texture {
    const cached = paintTextures.get(url);
    if (cached) return cached;

    const texture = paintLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    paintTextures.set(url, texture);
    return texture;
}

export class BuildRenderer {
    public readonly group = new THREE.Group();
    public readonly staticColliders: THREE.Box3[] = [];
    public onInteractablesChanged: ((added: THREE.Object3D[], removed: THREE.Object3D[]) => void) | null = null;

    private chunks = new Map<string, ChunkBucket>();
    private cellIndex = new Map<string, BuildPiece[]>();
    private doors = new Map<string, DoorInstance>();
    private paints = new Map<string, PaintInstance>();
    private paintAnchors = new Map<string, THREE.Object3D>();
    private interactAnchors = new Map<string, THREE.Object3D>();
    private lightSources: LightSource[] = [];
    private activeSources: Array<LightSource | null> = [];
    private lightPool: THREE.PointLight[] = [];
    private lightTimer = 0;
    private daylight = 1;
    private elapsed = 0;
    private visibleLevel: number | null = null;
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
        this.syncPaintings();
        this.syncPaintAnchors();
        this.syncInteractAnchors();
        this.rebuildLightSources();
        this.rebuildCollision();
    }

    private syncPaintAnchors() {
        const seen = new Set<string>();
        const added: THREE.Object3D[] = [];
        const removed: THREE.Object3D[] = [];

        for (const piece of this.layout.list()) {
            const spec = getBuildEntry(piece.t)?.paint;
            if (!spec) continue;

            const key = pieceKey(piece);
            seen.add(key);
            if (this.paintAnchors.has(key)) continue;

            const anchor = new THREE.Object3D();
            anchor.position.set(0, spec.y, spec.z);
            anchor.applyMatrix4(this.pieceMatrix(piece));
            anchor.userData.interactionId = `${PAINT_PREFIX}${key}`;
            anchor.userData.interactionRadius = PAINT_REACH;

            this.group.add(anchor);
            this.paintAnchors.set(key, anchor);
            added.push(anchor);
        }

        for (const [key, anchor] of Array.from(this.paintAnchors.entries())) {
            if (seen.has(key)) continue;
            this.group.remove(anchor);
            this.paintAnchors.delete(key);
            removed.push(anchor);
        }

        if (added.length > 0 || removed.length > 0) {
            this.onInteractablesChanged?.(added, removed);
        }
    }

    private syncInteractAnchors() {
        const seen = new Set<string>();
        const added: THREE.Object3D[] = [];
        const removed: THREE.Object3D[] = [];

        for (const piece of this.layout.list()) {
            const spec = getBuildEntry(piece.t)?.interact;
            if (!spec) continue;

            const key = pieceKey(piece);
            const anchorKey = `${piece.t}|${key}`;
            seen.add(anchorKey);
            if (this.interactAnchors.has(anchorKey)) continue;

            const anchor = new THREE.Object3D();
            anchor.position.set(0, spec.y, 0);
            anchor.applyMatrix4(this.pieceMatrix(piece));
            anchor.userData.interactionId = spec.keyed ? `${spec.id}:${key}` : spec.id;
            anchor.userData.interactionRadius = spec.reach ?? INTERACT_REACH;

            this.group.add(anchor);
            this.interactAnchors.set(anchorKey, anchor);
            added.push(anchor);
        }

        for (const [anchorKey, anchor] of Array.from(this.interactAnchors.entries())) {
            if (seen.has(anchorKey)) continue;
            this.group.remove(anchor);
            this.interactAnchors.delete(anchorKey);
            removed.push(anchor);
        }

        if (added.length > 0 || removed.length > 0) {
            this.onInteractablesChanged?.(added, removed);
        }
    }

    public getInteractionAnchors(): THREE.Object3D[] {
        return [...this.paintAnchors.values(), ...this.interactAnchors.values()];
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

        const batches = new Map<string, { surface: SurfaceId; casts: boolean; geometries: THREE.BufferGeometry[] }>();

        for (const piece of pieces) {
            const matrix = this.pieceMatrix(piece);
            const layer = getBuildEntry(piece.t)?.layer;
            const casts = layer !== "ground";

            for (const part of getBuildParts(piece.t)) {
                const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
                geometry.applyMatrix4(matrix);

                const key = `${part.surface}:${casts ? 1 : 0}`;
                const bucket = batches.get(key);
                if (bucket) bucket.geometries.push(geometry);
                else batches.set(key, { surface: part.surface, casts, geometries: [geometry] });
            }
        }

        const chunk: ChunkBucket = { meshes: [], group: new THREE.Group() };
        chunk.group.matrixAutoUpdate = false;

        batches.forEach((batch) => {
            const { geometries, surface } = batch;
            const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
            if (geometries.length > 1) geometries.forEach((geometry) => geometry.dispose());
            if (!merged) {
                console.error("[BuildRenderer] could not merge chunk geometry", { surface, count: geometries.length });
                return;
            }

            applyBoxUv(merged, getSurfaceUvScale(surface));
            merged.computeBoundingSphere();

            const mesh = new THREE.Mesh(merged, getBuildMaterial(surface));
            mesh.castShadow = batch.casts;
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

    private disposePainting(key: string) {
        const painting = this.paints.get(key);
        if (!painting) return;

        this.group.remove(painting.mesh);
        painting.mesh.geometry.dispose();
        (painting.mesh.material as THREE.Material).dispose();
        this.paints.delete(key);
    }

    private syncPaintings() {
        const seen = new Set<string>();

        for (const piece of this.layout.list()) {
            const entry = getBuildEntry(piece.t);
            const spec = entry?.paint;
            if (!spec || !piece.d) continue;

            const key = pieceKey(piece);
            seen.add(key);

            const existing = this.paints.get(key);
            if (existing && existing.url === piece.d) continue;
            if (existing) this.disposePainting(key);

            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(spec.width, spec.height),
                new THREE.MeshStandardMaterial({ map: getPaintTexture(piece.d), roughness: 0.86, metalness: 0 })
            );
            mesh.position.set(0, spec.y, spec.z + 0.012);
            mesh.receiveShadow = true;
            mesh.applyMatrix4(this.pieceMatrix(piece));

            this.group.add(mesh);
            this.paints.set(key, { mesh, url: piece.d });
        }

        for (const key of Array.from(this.paints.keys())) {
            if (!seen.has(key)) this.disposePainting(key);
        }
    }

    private rebuildLightSources() {
        this.lightSources.length = 0;

        for (const piece of this.layout.list()) {
            const spec = getBuildEntry(piece.t)?.light;
            if (!spec) continue;

            const angle = (piece.r * Math.PI) / 2;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            this.lightSources.push({
                x: cellToWorld(piece.x, this.layout.plotSize) + spec.x * cos + spec.z * sin,
                y: levelBaseY(piece.l) + spec.y,
                z: cellToWorld(piece.z, this.layout.plotSize) - spec.x * sin + spec.z * cos,
                level: piece.l,
                phase: (piece.x * 7 + piece.z * 13 + piece.l * 3) % 17,
                spec,
            });
        }

        this.lightTimer = 0;
        this.refreshLights(0, 0, 0);
    }

    private resizeLightPool(size: number) {
        while (this.lightPool.length < size) {
            const light = new THREE.PointLight(0xffffff, 0, 10, 1.6);
            this.group.add(light);
            this.lightPool.push(light);
        }
        while (this.lightPool.length > size) {
            const light = this.lightPool.pop()!;
            this.group.remove(light);
            light.dispose();
        }
    }

    public setDaylight(daylight: number) {
        this.daylight = THREE.MathUtils.clamp(daylight, 0, 1);
        this.lightTimer = 0;
    }

    private sourceIntensity(source: LightSource): number {
        const dim = source.spec.nightOnly ? 1 - this.daylight * 0.85 : 1 - this.daylight * 0.25;
        return source.spec.intensity * Math.max(0.05, dim);
    }

    private refreshLights(viewerX: number, viewerY: number, viewerZ: number) {
        this.resizeLightPool(Math.min(this.lightSources.length, MAX_ACTIVE_LIGHTS));
        if (this.lightPool.length === 0) return;

        const visible = this.lightSources.filter(
            (source) => this.visibleLevel === null || source.level <= this.visibleLevel
        );

        visible.sort((a, b) => {
            const da = (a.x - viewerX) ** 2 + (a.y - viewerY) ** 2 + (a.z - viewerZ) ** 2;
            const db = (b.x - viewerX) ** 2 + (b.y - viewerY) ** 2 + (b.z - viewerZ) ** 2;
            return da - db;
        });

        this.activeSources.length = 0;

        for (let i = 0; i < this.lightPool.length; i++) {
            const light = this.lightPool[i];
            const source = visible[i];

            if (!source) {
                light.intensity = 0;
                light.visible = false;
                this.activeSources.push(null);
                continue;
            }

            light.visible = true;
            light.position.set(source.x, source.y, source.z);
            light.color.setHex(source.spec.color);
            light.intensity = this.sourceIntensity(source);
            light.distance = source.spec.distance;
            this.activeSources.push(source);
        }
    }

    private animateFlicker() {
        for (let i = 0; i < this.lightPool.length; i++) {
            const source = this.activeSources[i];
            if (!source?.spec.flicker) continue;

            const t = this.elapsed * 9 + source.phase;
            const wave = Math.sin(t) * 0.6 + Math.sin(t * 2.37) * 0.3 + Math.sin(t * 4.13) * 0.1;
            this.lightPool[i].intensity = this.sourceIntensity(source) * (1 + wave * source.spec.flicker);
        }
    }

    public update(delta: number, viewerX: number, viewerY: number, viewerZ: number) {
        this.elapsed += delta;

        if (this.lightSources.length > 0) {
            this.lightTimer -= delta;
            if (this.lightTimer <= 0) {
                this.lightTimer = LIGHT_REFRESH_INTERVAL;
                this.refreshLights(viewerX, viewerY, viewerZ);
            }
            this.animateFlicker();
        }

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

    private insertLocalBox(
        piece: BuildPiece, baseY: number,
        x0: number, x1: number, y0: number, y1: number, z0: number, z1: number
    ) {
        const worldX = cellToWorld(piece.x, this.layout.plotSize);
        const worldZ = cellToWorld(piece.z, this.layout.plotSize);
        const angle = (piece.r * Math.PI) / 2;
        const sin = Math.round(Math.sin(angle));
        const cos = Math.round(Math.cos(angle));

        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        for (const localX of [x0, x1]) {
            for (const localZ of [z0, z1]) {
                const x = worldX + localX * cos + localZ * sin;
                const z = worldZ - localX * sin + localZ * cos;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
        }

        this.insertBox(minX, baseY + y0, minZ, maxX, baseY + y1, maxZ);
    }

    private insertRampSides(piece: BuildPiece, rise: number, baseY: number) {
        const length = CELL_SIZE / RAMP_SEGMENTS;

        for (let i = 0; i < RAMP_SEGMENTS; i++) {
            const z0 = HALF - (i + 1) * length;
            const z1 = HALF - i * length;

            const height = stairSurfaceHeight(z1, rise);
            if (height <= 0.05) continue;

            for (const side of [-1, 1]) {
                this.insertLocalBox(piece, baseY, side * 0.9, side * HALF, 0, height, z0, z1);
            }
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
                this.insertRampSides(piece, entry.walkableTop, baseY);
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
            const radius = entry.blockRadius ?? CELL_SIZE * 0.4;
            this.insertBox(
                worldX - radius, baseY, worldZ - radius,
                worldX + radius, baseY + height, worldZ + radius
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
        this.visibleLevel = maxLevel;
        this.chunks.forEach((chunk, chunkId) => {
            const level = Number(chunkId.split(":")[2]);
            chunk.group.visible = maxLevel === null || level <= maxLevel;
        });
        this.lightTimer = 0;
    }

    public dispose() {
        for (const chunkId of Array.from(this.chunks.keys())) this.disposeChunk(chunkId);
        this.chunks.clear();
        this.cellIndex.clear();
        this.doors.forEach((door) => this.group.remove(door.root));
        this.doors.clear();
        for (const key of Array.from(this.paints.keys())) this.disposePainting(key);
        this.paintAnchors.forEach((anchor) => this.group.remove(anchor));
        this.paintAnchors.clear();
        this.interactAnchors.forEach((anchor) => this.group.remove(anchor));
        this.interactAnchors.clear();
        this.onInteractablesChanged = null;
        this.lightPool.forEach((light) => this.group.remove(light));
        this.lightPool.length = 0;
        this.lightSources.length = 0;
        this.activeSources.length = 0;
        this.dirty.clear();
        this.staticColliders.length = 0;
        this.group.removeFromParent();
    }
}
