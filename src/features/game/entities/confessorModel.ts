// src/features/game/entities/confessorModel.ts
import * as THREE from "three";

export type ConfessorPhase = "litany" | "procession" | "toll" | "rapture";

const PHASE_GLOW: Record<ConfessorPhase, number> = {
    litany: 0x6fd8ff,
    procession: 0xbfa6ff,
    toll: 0xffb347,
    rapture: 0xff4a3c,
};

const ROBE_DARK = 0x1c1826;
const ROBE = 0x2b2436;
const TRIM = 0x6b5f4a;
const BONE = 0xd8d0bb;

interface Batch {
    position: number[];
    normal: number[];
    color: number[];
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _colour = new THREE.Color();

function makeBatch(): Batch {
    return { position: [], normal: [], color: [] };
}

function toGeometry(batch: Batch): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normal, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(batch.color, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

function pushTri(
    batch: Batch,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    colour: number,
    shade: number
) {
    _a.set(cx - ax, cy - ay, cz - az);
    _b.set(bx - ax, by - ay, bz - az);
    _n.crossVectors(_a, _b);
    if (_n.lengthSq() < 1e-12) return;
    _n.normalize();

    _colour.setHex(colour).multiplyScalar(shade);

    batch.position.push(ax, ay, az, cx, cy, cz, bx, by, bz);
    for (let i = 0; i < 3; i++) {
        batch.normal.push(_n.x, _n.y, _n.z);
        batch.color.push(_colour.r, _colour.g, _colour.b);
    }
}

function pushQuad(
    batch: Batch,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    colour: number,
    shade: number
) {
    pushTri(batch, ax, ay, az, bx, by, bz, cx, cy, cz, colour, shade);
    pushTri(batch, ax, ay, az, cx, cy, cz, dx, dy, dz, colour, shade);
}

function pushRing(
    batch: Batch,
    cy: number,
    height: number,
    lowerRadius: number,
    upperRadius: number,
    sides: number,
    colour: number,
    shade: number
) {
    for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;

        const x0 = Math.cos(a0);
        const z0 = Math.sin(a0);
        const x1 = Math.cos(a1);
        const z1 = Math.sin(a1);

        pushQuad(
            batch,
            x0 * lowerRadius, cy, z0 * lowerRadius,
            x1 * lowerRadius, cy, z1 * lowerRadius,
            x1 * upperRadius, cy + height, z1 * upperRadius,
            x0 * upperRadius, cy + height, z0 * upperRadius,
            colour,
            shade * (0.86 + (i % 3) * 0.08)
        );
    }
}

function pushBox(
    batch: Batch,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    colour: number,
    shade: number
) {
    pushQuad(batch, minX, maxY, minZ, minX, maxY, maxZ, maxX, maxY, maxZ, maxX, maxY, minZ, colour, shade * 1.06);
    pushQuad(batch, minX, minY, minZ, maxX, minY, minZ, maxX, maxY, minZ, minX, maxY, minZ, colour, shade * 0.88);
    pushQuad(batch, maxX, minY, maxZ, minX, minY, maxZ, minX, maxY, maxZ, maxX, maxY, maxZ, colour, shade * 0.94);
    pushQuad(batch, minX, minY, maxZ, minX, minY, minZ, minX, maxY, minZ, minX, maxY, maxZ, colour, shade * 0.9);
    pushQuad(batch, maxX, minY, minZ, maxX, minY, maxZ, maxX, maxY, maxZ, maxX, maxY, minZ, colour, shade * 0.9);
}

function buildRobe(): THREE.BufferGeometry {
    const batch = makeBatch();

    pushRing(batch, 0, 1.1, 1.35, 1.0, 12, ROBE_DARK, 0.9);
    pushRing(batch, 1.1, 2.2, 1.0, 0.72, 12, ROBE, 1);
    pushRing(batch, 3.3, 1.5, 0.72, 0.62, 12, ROBE, 1.05);

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        pushBox(
            batch,
            Math.cos(angle) * 1.02 - 0.05, 0.12, Math.sin(angle) * 1.02 - 0.05,
            Math.cos(angle) * 1.02 + 0.05, 3.1, Math.sin(angle) * 1.02 + 0.05,
            ROBE_DARK,
            0.94
        );
    }

    pushRing(batch, 4.8, 0.42, 0.62, 0.86, 10, TRIM, 1.15);
    pushRing(batch, 5.22, 0.3, 0.86, 0.5, 10, ROBE, 1.02);

    pushRing(batch, 5.52, 0.3, 0.26, 0.28, 8, BONE, 0.95);

    pushRing(batch, 5.82, 0.56, 0.4, 0.36, 8, BONE, 1.08);
    pushBox(batch, -0.26, 5.96, 0.28, 0.26, 6.06, 0.4, ROBE_DARK, 1);
    pushBox(batch, -0.05, 6.06, 0.28, 0.05, 6.28, 0.4, ROBE_DARK, 1);

    pushRing(batch, 6.38, 1.2, 0.38, 0.05, 8, TRIM, 1.12);

    for (const side of [-1, 1]) {
        pushBox(batch, side * 0.78 - 0.14, 4.5, -0.16, side * 0.78 + 0.14, 5.0, 0.16, TRIM, 1.1);
    }

    return toGeometry(batch);
}

function buildArm(side: number): THREE.BufferGeometry {
    const batch = makeBatch();

    pushRing(batch, -1.1, 1.1, 0.2, 0.3, 8, ROBE, 0.98);
    pushRing(batch, -2.15, 1.05, 0.3, 0.16, 8, ROBE_DARK, 0.94);

    pushBox(batch, -0.11, -2.42, -0.11, 0.11, -2.12, 0.11, BONE, 1);
    for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.11;
        pushBox(batch, spread - 0.035, -2.72, -0.05, spread + 0.035, -2.38, 0.07, BONE, 0.96);
    }

    pushBox(batch, side * 0.06 - 0.03, -3.5, -0.03, side * 0.06 + 0.03, -2.66, 0.03, TRIM, 1.05);

    return toGeometry(batch);
}

function buildCenser(): THREE.BufferGeometry {
    const batch = makeBatch();

    pushRing(batch, -0.34, 0.34, 0.06, 0.22, 8, TRIM, 1.1);
    pushRing(batch, 0, 0.24, 0.22, 0.1, 8, TRIM, 1.16);
    pushBox(batch, -0.04, 0.24, -0.04, 0.04, 0.36, 0.04, TRIM, 1.2);

    return toGeometry(batch);
}

function buildShard(): THREE.BufferGeometry {
    return new THREE.OctahedronGeometry(0.34, 0);
}

const SHARD_COUNT = 9;

export class ConfessorModel {
    public readonly group: THREE.Group;

    private readonly robeMesh: THREE.Mesh;
    private readonly armL: THREE.Object3D;
    private readonly armR: THREE.Object3D;
    private readonly censerL: THREE.Object3D;
    private readonly censerR: THREE.Object3D;
    private readonly shards: THREE.Mesh[] = [];
    private readonly mask: THREE.Mesh;

    private readonly stoneMaterial: THREE.MeshStandardMaterial;
    private readonly glowMaterial: THREE.MeshStandardMaterial;
    private readonly shardMaterial: THREE.MeshStandardMaterial;
    private readonly light: THREE.PointLight;

    private readonly robeGeometry: THREE.BufferGeometry;
    private readonly armGeometryL: THREE.BufferGeometry;
    private readonly armGeometryR: THREE.BufferGeometry;
    private readonly censerGeometry: THREE.BufferGeometry;
    private readonly shardGeometry: THREE.BufferGeometry;
    private readonly maskGeometry: THREE.BufferGeometry;

    public readonly height = 7.6;

    private phase: ConfessorPhase = "litany";
    private glow = new THREE.Color(PHASE_GLOW.litany);
    private target = new THREE.Color(PHASE_GLOW.litany);
    private castBlend = 0;
    private time = 0;

    constructor() {
        this.group = new THREE.Group();

        this.stoneMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.78,
            metalness: 0.12,
            flatShading: true,
        });

        this.glowMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0810,
            emissive: PHASE_GLOW.litany,
            emissiveIntensity: 2.4,
            roughness: 0.4,
            metalness: 0,
            flatShading: true,
        });

        this.shardMaterial = new THREE.MeshStandardMaterial({
            color: 0x14101c,
            emissive: PHASE_GLOW.litany,
            emissiveIntensity: 0.75,
            roughness: 0.3,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8,
            flatShading: true,
        });

        this.robeGeometry = buildRobe();
        this.armGeometryL = buildArm(-1);
        this.armGeometryR = buildArm(1);
        this.censerGeometry = buildCenser();
        this.shardGeometry = buildShard();
        this.maskGeometry = new THREE.ConeGeometry(0.32, 0.62, 6);

        this.robeMesh = new THREE.Mesh(this.robeGeometry, this.stoneMaterial);
        this.group.add(this.robeMesh);

        this.mask = new THREE.Mesh(this.maskGeometry, this.glowMaterial);
        this.mask.position.set(0, 5.98, 0.34);
        this.mask.rotation.x = Math.PI * 0.5;
        this.group.add(this.mask);

        this.armL = new THREE.Object3D();
        this.armL.position.set(-1.02, 4.85, 0.08);
        this.armL.add(new THREE.Mesh(this.armGeometryL, this.stoneMaterial));
        this.group.add(this.armL);

        this.armR = new THREE.Object3D();
        this.armR.position.set(1.02, 4.85, 0.08);
        this.armR.add(new THREE.Mesh(this.armGeometryR, this.stoneMaterial));
        this.group.add(this.armR);

        this.censerL = new THREE.Object3D();
        this.censerL.position.set(0, -3.5, 0);
        this.censerL.add(new THREE.Mesh(this.censerGeometry, this.stoneMaterial));
        this.armL.add(this.censerL);

        this.censerR = new THREE.Object3D();
        this.censerR.position.set(0, -3.5, 0);
        this.censerR.add(new THREE.Mesh(this.censerGeometry, this.stoneMaterial));
        this.armR.add(this.censerR);

        for (let i = 0; i < SHARD_COUNT; i++) {
            const shard = new THREE.Mesh(this.shardGeometry, this.shardMaterial);
            shard.scale.set(0.34 + (i % 3) * 0.16, 1.05 + (i % 4) * 0.28, 0.34 + (i % 3) * 0.16);
            this.shards.push(shard);
            this.group.add(shard);
        }

        this.light = new THREE.PointLight(PHASE_GLOW.litany, 22, 48, 2);
        this.light.position.set(0, 5.6, 0);
        this.group.add(this.light);
    }

    public setPhase(phase: ConfessorPhase) {
        this.phase = phase;
        this.target.setHex(PHASE_GLOW[phase]);
    }

    public beginCast(seconds: number) {
        this.castBlend = Math.max(this.castBlend, Math.min(1, seconds));
    }

    public flashHit() {
        this.castBlend = Math.max(this.castBlend, 0.35);
    }

    public update(delta: number, moving: boolean) {
        this.time += delta;
        this.castBlend = Math.max(0, this.castBlend - delta);

        this.glow.lerp(this.target, Math.min(1, delta * 2.2));

        const rapture = this.phase === "rapture";
        const beat = rapture
            ? 0.6 + 0.4 * Math.abs(Math.sin(this.time * 5.2))
            : 0.72 + 0.28 * Math.sin(this.time * 1.2);
        const cast = Math.min(1, this.castBlend);

        this.glowMaterial.emissive.copy(this.glow);
        this.glowMaterial.emissiveIntensity = 0.9 + beat * 0.85 + cast * 1.6;

        this.shardMaterial.emissive.copy(this.glow);
        this.shardMaterial.emissiveIntensity = 0.42 + beat * 0.45 + cast * 0.9;

        this.light.color.copy(this.glow);
        this.light.intensity = 10 + beat * 14 + cast * 26;

        this.group.position.y = Math.sin(this.time * 0.85) * 0.14 + (rapture ? 0.35 : 0);
        this.robeMesh.rotation.y = Math.sin(this.time * 0.3) * 0.06;
        this.mask.position.y = 5.98 + Math.sin(this.time * 1.1) * 0.05;

        const sway = Math.sin(this.time * (moving ? 2.1 : 1.1));
        const raise = cast * 1.25;

        this.armL.rotation.x = -0.24 - raise + sway * 0.1;
        this.armR.rotation.x = -0.24 - raise - sway * 0.1;
        this.armL.rotation.z = 0.34 + cast * 0.3;
        this.armR.rotation.z = -0.34 - cast * 0.3;

        this.censerL.rotation.x = Math.sin(this.time * 2.4) * 0.5;
        this.censerR.rotation.x = Math.sin(this.time * 2.4 + 1.6) * 0.5;

        const orbit = rapture ? 2.6 : 1.6;
        for (let i = 0; i < this.shards.length; i++) {
            const shard = this.shards[i];
            const angle = (i / this.shards.length) * Math.PI * 2 + this.time * 0.42;
            const radius = orbit + Math.sin(this.time * 0.9 + i) * 0.35 + cast * 0.9;
            const lift = 4.8 + Math.sin(this.time * 1.3 + i * 1.9) * 0.9;

            shard.position.set(Math.cos(angle) * radius, lift, Math.sin(angle) * radius);
            shard.rotation.y = angle * 1.7;
            shard.rotation.z = Math.sin(this.time + i) * 0.6;
        }
    }

    public dispose() {
        this.group.removeFromParent();

        this.robeGeometry.dispose();
        this.armGeometryL.dispose();
        this.armGeometryR.dispose();
        this.censerGeometry.dispose();
        this.shardGeometry.dispose();
        this.maskGeometry.dispose();

        this.stoneMaterial.dispose();
        this.glowMaterial.dispose();
        this.shardMaterial.dispose();
    }
}
