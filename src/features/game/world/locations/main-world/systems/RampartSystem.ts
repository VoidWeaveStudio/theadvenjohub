// src/features/game/world/locations/main-world/systems/RampartSystem.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CollisionGrid, RingArc, ringAngle } from "../../../CollisionGrid";
import { applyRadialFog, RadialFogUniforms } from "../utils/radialFog";
import type { TerrainSystem } from "./TerrainSystem";

const WALL_HEIGHT = 5;
const WALL_HALF_THICKNESS = 1.5;
const WALKWAY_DROP = 0.4;
const BASE_SINK = 3;
const HEIGHT_STEP = 0.5;

const PARAPET_RADIUS_OFFSET = 1.35;
const PARAPET_HALF_THICKNESS = 0.35;
const PARAPET_HEIGHT = 1.3;
const PARAPET_COURSE = 0.45;

const ARC_TARGET_LENGTH = 26;
const MIN_HEIGHT_ARCS = 12;
const MAX_HEIGHT_ARCS = 40;
const RENDER_PER_ARC = 4;
const SEGMENT_OVERLAP = 1.04;

const MAX_ARC_DELTA = 4;
const SEAM_TREAD_LENGTH = 1.2;

const BASTION_SPACING_ARCS = 6;
const BASTION_RADIUS = 1.8;
const BASTION_OFFSET = 2.4;
const BASTION_RISE = 2;

const STAIR_COUNT = 4;
const STAIR_RISE = 0.45;
const STAIR_RUN = 0.85;
const STAIR_WIDTH = 2.4;

interface WallArc {
    angle: number;
    halfAngle: number;
    topY: number;
    baseY: number;
    parapetTop: number;
}

interface SeamTread {
    angle: number;
    halfAngle: number;
    topY: number;
}

interface StairStep {
    x: number;
    z: number;
    rotation: number;
    width: number;
    depth: number;
    minY: number;
    maxY: number;
}

function ringPoint(angle: number, radius: number, target: THREE.Vector2): THREE.Vector2 {
    return target.set(Math.sin(angle) * radius, -Math.cos(angle) * radius);
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
    if (parts.length === 0) return null;

    const flattened = parts.map((part) => {
        const flat = part.getIndex() ? part.toNonIndexed() : part;
        for (const name of Object.keys(flat.attributes)) {
            if (name !== "position" && name !== "normal" && name !== "uv") flat.deleteAttribute(name);
        }
        return flat;
    });

    parts.forEach((part, index) => {
        if (flattened[index] !== part) part.dispose();
    });

    const merged = mergeGeometries(flattened, false);
    flattened.forEach((part) => part.dispose());
    return merged;
}

export class RampartSystem {
    public radius: number | null = null;

    private group: THREE.Group | null = null;
    private material: THREE.MeshStandardMaterial | null = null;
    private arcs: WallArc[] = [];
    private treads: SeamTread[] = [];
    private stairs: StairStep[] = [];

    private readonly point = new THREE.Vector2();

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly fogUniforms: RadialFogUniforms
    ) { }

    public get topHeight(): number {
        let highest = -Infinity;
        for (const arc of this.arcs) {
            if (arc.topY > highest) highest = arc.topY;
        }
        return highest === -Infinity ? 0 : highest;
    }

    public arcTopAt(x: number, z: number): number | null {
        if (this.arcs.length === 0) return null;
        return this.arcAt(ringAngle(x, z)).topY;
    }

    public setRadius(radius: number | null) {
        if (this.radius === radius) return;

        this.radius = radius;
        this.dispose();

        if (radius === null) {
            this.arcs = [];
            this.treads = [];
            this.stairs = [];
            return;
        }

        this.buildArcs(radius);
        this.buildTreads(radius);
        this.buildStairs(radius);
        this.buildMesh(radius);
    }

    private sampleGround(angle: number, radius: number): number {
        ringPoint(angle, radius, this.point);
        return this.terrain.getHeightAt(this.point.x, this.point.y);
    }

    private buildArcs(radius: number) {
        const circumference = Math.PI * 2 * radius;
        const count = Math.max(
            MIN_HEIGHT_ARCS,
            Math.min(MAX_HEIGHT_ARCS, Math.round(circumference / ARC_TARGET_LENGTH))
        );

        const step = (Math.PI * 2) / count;
        const halfAngle = step / 2;
        const samples = RENDER_PER_ARC * 2 + 1;

        this.arcs = [];

        for (let i = 0; i < count; i++) {
            const center = (i + 0.5) * step;

            let lowest = Infinity;
            let highest = -Infinity;

            for (let s = 0; s < samples; s++) {
                const angle = center - halfAngle + (step * s) / (samples - 1);

                for (const offset of [-WALL_HALF_THICKNESS, 0, WALL_HALF_THICKNESS]) {
                    const height = this.sampleGround(angle, radius + offset);
                    if (height < lowest) lowest = height;
                    if (height > highest) highest = height;
                }
            }

            this.arcs.push({
                angle: center,
                halfAngle,
                topY: Math.ceil((highest + WALL_HEIGHT) / HEIGHT_STEP) * HEIGHT_STEP,
                baseY: lowest - BASE_SINK,
                parapetTop: 0,
            });
        }

        this.limitArcSlope();

        for (let i = 0; i < count; i++) {
            const previous = this.arcs[(i - 1 + count) % count];
            const next = this.arcs[(i + 1) % count];
            this.arcs[i].parapetTop =
                Math.max(this.arcs[i].topY, previous.topY, next.topY) + PARAPET_HEIGHT;
        }
    }

    private limitArcSlope() {
        const count = this.arcs.length;

        for (let pass = 0; pass < count; pass++) {
            let changed = false;

            for (let i = 0; i < count; i++) {
                const current = this.arcs[i];
                const next = this.arcs[(i + 1) % count];
                const delta = next.topY - current.topY;

                if (delta > MAX_ARC_DELTA) {
                    current.topY = next.topY - MAX_ARC_DELTA;
                    changed = true;
                } else if (delta < -MAX_ARC_DELTA) {
                    next.topY = current.topY - MAX_ARC_DELTA;
                    changed = true;
                }
            }

            if (!changed) break;
        }
    }

    private buildTreads(radius: number) {
        this.treads = [];

        const count = this.arcs.length;
        const treadHalfAngle = SEAM_TREAD_LENGTH / radius / 2;

        for (let i = 0; i < count; i++) {
            const current = this.arcs[i];
            const next = this.arcs[(i + 1) % count];
            const delta = next.topY - current.topY;
            if (Math.abs(delta) <= HEIGHT_STEP) continue;

            const seamAngle = current.angle + current.halfAngle;
            const treads = Math.ceil(Math.abs(delta) / HEIGHT_STEP) - 1;
            if (treads <= 0) continue;

            const rise = delta / (treads + 1);
            const direction = delta > 0 ? -1 : 1;
            const base = delta > 0 ? current.topY : next.topY;

            for (let k = 1; k <= treads; k++) {
                this.treads.push({
                    angle: seamAngle + direction * treadHalfAngle * 2 * (treads - k + 0.5),
                    halfAngle: treadHalfAngle,
                    topY: base + Math.abs(rise) * k,
                });
            }
        }
    }

    private arcAt(angle: number): WallArc {
        const step = (Math.PI * 2) / this.arcs.length;
        const index = ((Math.floor(angle / step) % this.arcs.length) + this.arcs.length) % this.arcs.length;
        return this.arcs[index];
    }

    private stairFootprintScore(topAngle: number, centerRadius: number, span: number): number {
        let lowest = Infinity;
        let highest = -Infinity;

        for (let s = 0; s <= 6; s++) {
            const sample = topAngle - (span * s) / 6;

            for (const offset of [-STAIR_WIDTH / 2, STAIR_WIDTH / 2]) {
                const height = this.sampleGround(sample, centerRadius + offset);
                if (height < lowest) lowest = height;
                if (height > highest) highest = height;
            }
        }

        return highest - lowest;
    }

    private stairSpan(arc: WallArc, topAngle: number, centerRadius: number): { steps: number; span: number; startY: number } {
        const angleStep = STAIR_RUN / centerRadius;
        let steps = Math.max(2, Math.ceil((arc.topY - this.sampleGround(topAngle, centerRadius)) / STAIR_RISE));

        for (let pass = 0; pass < 3; pass++) {
            const startY = this.sampleGround(topAngle - angleStep * steps, centerRadius);
            const next = Math.max(2, Math.ceil((arc.topY - startY) / STAIR_RISE));
            if (next === steps) break;
            steps = next;
        }

        return {
            steps,
            span: angleStep * steps,
            startY: this.sampleGround(topAngle - angleStep * steps, centerRadius),
        };
    }

    private buildStairs(radius: number) {
        this.stairs = [];

        const centerRadius = radius - WALL_HALF_THICKNESS - STAIR_WIDTH / 2;
        const angleStep = STAIR_RUN / centerRadius;
        const perSlot = Math.max(1, Math.floor(this.arcs.length / STAIR_COUNT));

        for (let slot = 0; slot < STAIR_COUNT; slot++) {
            let best: WallArc | null = null;
            let bestScore = Infinity;
            let bestSpan = { steps: 2, span: 0, startY: 0 };

            for (let c = 0; c < perSlot; c++) {
                const arc = this.arcs[(slot * perSlot + c) % this.arcs.length];
                const span = this.stairSpan(arc, arc.angle, centerRadius);
                const score = this.stairFootprintScore(arc.angle, centerRadius, span.span);

                if (score < bestScore) {
                    bestScore = score;
                    best = arc;
                    bestSpan = span;
                }
            }

            if (!best) continue;

            const rise = best.topY - bestSpan.startY;
            if (rise <= 0) continue;

            const stepRise = rise / bestSpan.steps;

            for (let s = 0; s < bestSpan.steps; s++) {
                const angle = best.angle - angleStep * (s + 0.5);
                const stepArc = this.arcAt(angle);
                ringPoint(angle, centerRadius, this.point);

                this.stairs.push({
                    x: this.point.x,
                    z: this.point.y,
                    rotation: -angle,
                    width: STAIR_RUN * SEGMENT_OVERLAP,
                    depth: STAIR_WIDTH,
                    minY: Math.min(best.baseY, stepArc.baseY),
                    maxY: best.topY - stepRise * s,
                });
            }
        }
    }

    private buildMesh(radius: number) {
        const parts: THREE.BufferGeometry[] = [];
        const segments = this.arcs.length * RENDER_PER_ARC;
        const segmentStep = (Math.PI * 2) / segments;
        const chord = 2 * radius * Math.sin(segmentStep / 2) * SEGMENT_OVERLAP;

        for (let i = 0; i < segments; i++) {
            const angle = (i + 0.5) * segmentStep;
            const arc = this.arcAt(angle);

            const bottom = this.sampleGround(angle, radius) - BASE_SINK;
            const height = arc.topY - bottom;

            ringPoint(angle, radius, this.point);
            const body = new THREE.BoxGeometry(chord, height, WALL_HALF_THICKNESS * 2);
            body.rotateY(-angle);
            body.translate(this.point.x, bottom + height / 2, this.point.y);
            parts.push(body);

            ringPoint(angle, radius + PARAPET_RADIUS_OFFSET, this.point);
            const course = new THREE.BoxGeometry(chord, PARAPET_COURSE, PARAPET_HALF_THICKNESS * 2);
            course.rotateY(-angle);
            course.translate(this.point.x, arc.topY + PARAPET_COURSE / 2, this.point.y);
            parts.push(course);

            if (i % 2 === 0) {
                const merlon = new THREE.BoxGeometry(chord * 0.58, PARAPET_HEIGHT - PARAPET_COURSE, PARAPET_HALF_THICKNESS * 2);
                merlon.rotateY(-angle);
                merlon.translate(this.point.x, arc.topY + PARAPET_COURSE + (PARAPET_HEIGHT - PARAPET_COURSE) / 2, this.point.y);
                parts.push(merlon);
            }
        }

        for (const tread of this.treads) {
            const width = 2 * radius * Math.sin(tread.halfAngle) * SEGMENT_OVERLAP;

            ringPoint(tread.angle, radius, this.point);
            const slab = new THREE.BoxGeometry(width, WALKWAY_DROP, WALL_HALF_THICKNESS * 2);
            slab.rotateY(-tread.angle);
            slab.translate(this.point.x, tread.topY - WALKWAY_DROP / 2, this.point.y);
            parts.push(slab);
        }

        const bastionEvery = Math.max(1, Math.floor(this.arcs.length / BASTION_SPACING_ARCS));

        for (let i = 0; i < this.arcs.length; i += bastionEvery) {
            const arc = this.arcs[i];
            const angle = arc.angle - arc.halfAngle;
            const bottom = this.sampleGround(angle, radius + BASTION_OFFSET) - BASE_SINK;
            const height = arc.topY + BASTION_RISE - bottom;

            ringPoint(angle, radius + BASTION_OFFSET, this.point);
            const tower = new THREE.CylinderGeometry(BASTION_RADIUS, BASTION_RADIUS * 1.15, height, 8, 1);
            tower.translate(this.point.x, bottom + height / 2, this.point.y);
            parts.push(tower);
        }

        for (const step of this.stairs) {
            const height = step.maxY - step.minY;
            const angle = -step.rotation;
            const outward = 0.2;

            const geometry = new THREE.BoxGeometry(step.width, height, step.depth + outward * 2);
            geometry.rotateY(step.rotation);
            geometry.translate(
                step.x + Math.sin(angle) * outward,
                step.minY + height / 2,
                step.z - Math.cos(angle) * outward
            );
            parts.push(geometry);
        }

        const merged = mergeParts(parts);
        if (!merged) return;

        merged.computeVertexNormals();
        merged.computeBoundingSphere();

        this.material = new THREE.MeshStandardMaterial({
            color: 0x6b6459,
            roughness: 0.92,
            metalness: 0.03,
            flatShading: true,
        });

        applyRadialFog(this.material, this.fogUniforms);

        const mesh = new THREE.Mesh(merged, this.material);
        mesh.name = "rampart";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        this.group = new THREE.Group();
        this.group.add(mesh);
        this.scene.add(this.group);
    }

    public applyColliders(grid: CollisionGrid) {
        if (this.radius === null) return;

        for (const arc of this.arcs) {
            const ring: RingArc = { angle: arc.angle, halfAngle: arc.halfAngle };

            grid.insertRingWall(this.radius, WALL_HALF_THICKNESS, arc.baseY, arc.topY, [], ring);
            grid.insertPlatform(
                this.radius - WALL_HALF_THICKNESS,
                this.radius + WALL_HALF_THICKNESS,
                arc.topY - WALKWAY_DROP,
                arc.topY,
                ring
            );
            grid.insertRingWall(
                this.radius + PARAPET_RADIUS_OFFSET,
                PARAPET_HALF_THICKNESS,
                arc.topY,
                arc.parapetTop,
                [],
                ring
            );
        }

        for (const tread of this.treads) {
            grid.insertPlatform(
                this.radius - WALL_HALF_THICKNESS,
                this.radius + WALL_HALF_THICKNESS,
                tread.topY - WALKWAY_DROP,
                tread.topY,
                { angle: tread.angle, halfAngle: tread.halfAngle }
            );
        }

        for (const step of this.stairs) {
            grid.insertOrientedBox(step.x, step.z, step.width, step.depth, step.rotation, step.minY, step.maxY);
        }
    }

    public dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.geometry.dispose();
            });
            this.group = null;
        }

        this.material?.dispose();
        this.material = null;
    }
}
