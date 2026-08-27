// src/features/game/entities/zombieModel.ts
import * as THREE from "three";

export type ZombieKind = "walker" | "runner" | "brute" | "herald";

export interface ZombiePose {
    moving: boolean;
    aggro: boolean;
    speed: number;
    hidden: boolean;
    lunging: boolean;
    attacking: boolean;
}

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

interface TaperOptions {
    topScaleX?: number;
    topScaleZ?: number;
    leanX?: number;
    leanZ?: number;
}

function pushTapered(
    batch: Batch,
    cx: number, cy: number, cz: number,
    halfX: number, halfY: number, halfZ: number,
    colour: number,
    shade: number,
    options: TaperOptions = {}
) {
    const tx = halfX * (options.topScaleX ?? 1);
    const tz = halfZ * (options.topScaleZ ?? 1);
    const ox = options.leanX ?? 0;
    const oz = options.leanZ ?? 0;

    const y0 = cy - halfY;
    const y1 = cy + halfY;

    const b0 = [cx - halfX, cz - halfZ];
    const b1 = [cx + halfX, cz - halfZ];
    const b2 = [cx + halfX, cz + halfZ];
    const b3 = [cx - halfX, cz + halfZ];

    const t0 = [cx + ox - tx, cz + oz - tz];
    const t1 = [cx + ox + tx, cz + oz - tz];
    const t2 = [cx + ox + tx, cz + oz + tz];
    const t3 = [cx + ox - tx, cz + oz + tz];

    pushQuad(batch, b0[0], y0, b0[1], b1[0], y0, b1[1], t1[0], y1, t1[1], t0[0], y1, t0[1], colour, shade * 0.9);
    pushQuad(batch, b2[0], y0, b2[1], b3[0], y0, b3[1], t3[0], y1, t3[1], t2[0], y1, t2[1], colour, shade * 0.78);
    pushQuad(batch, b3[0], y0, b3[1], b0[0], y0, b0[1], t0[0], y1, t0[1], t3[0], y1, t3[1], colour, shade * 0.84);
    pushQuad(batch, b1[0], y0, b1[1], b2[0], y0, b2[1], t2[0], y1, t2[1], t1[0], y1, t1[1], colour, shade * 0.84);
    pushQuad(batch, t0[0], y1, t0[1], t1[0], y1, t1[1], t2[0], y1, t2[1], t3[0], y1, t3[1], colour, shade * 1.08);
    pushQuad(batch, b3[0], y0, b3[1], b2[0], y0, b2[1], b1[0], y0, b1[1], b0[0], y0, b0[1], colour, shade * 0.6);
}

function rng(seed: number) {
    let state = (seed | 0) || 7;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        return ((state >>> 8) & 0xffffff) / 0xffffff;
    };
}

interface Palette {
    flesh: number;
    fleshDark: number;
    cloth: number;
    clothDark: number;
    bone: number;
    blood: number;
    glow: number;
}

const PALETTES: Record<ZombieKind, Palette> = {
    walker: { flesh: 0x7f8f74, fleshDark: 0x5e6a55, cloth: 0x453c33, clothDark: 0x2c261f, bone: 0xc8c0aa, blood: 0x59201c, glow: 0xa8ff6a },
    runner: { flesh: 0x9c8a7d, fleshDark: 0x6e5f55, cloth: 0x3a2b2b, clothDark: 0x241a1a, bone: 0xd6cdb6, blood: 0x8c1f18, glow: 0xff5a48 },
    brute: { flesh: 0x967a78, fleshDark: 0x6d5453, cloth: 0x3b332b, clothDark: 0x241f19, bone: 0xcfc6ad, blood: 0x6b1a16, glow: 0xff8a3c },
    herald: { flesh: 0x8c8a94, fleshDark: 0x5c5a64, cloth: 0x241f33, clothDark: 0x15121f, bone: 0xd8d2c0, blood: 0x4a1a4a, glow: 0xc79bff },
};

interface PartGeometries {
    body: THREE.BufferGeometry;
    eyes: THREE.BufferGeometry;
    armL: THREE.BufferGeometry;
    armR: THREE.BufferGeometry;
    legL: THREE.BufferGeometry;
    legR: THREE.BufferGeometry;
    silhouette: THREE.BufferGeometry;
    shoulderY: number;
    hipY: number;
    height: number;
}

const CACHE = new Map<string, PartGeometries>();

function buildArm(kind: ZombieKind, side: number, variant: number, palette: Palette): THREE.BufferGeometry {
    const random = rng(variant * 977 + side * 31 + kind.length * 13);
    const batch = makeBatch();

    const upperLength = kind === "brute" ? 0.52 : kind === "runner" ? 0.58 : 0.5;
    const foreLength = kind === "brute" ? 0.5 : kind === "runner" ? 0.62 : 0.52;
    const thick = kind === "brute" ? (side < 0 ? 0.26 : 0.21) : kind === "runner" ? 0.1 : 0.12;

    pushTapered(batch, 0, -upperLength, 0, thick, upperLength, thick * 0.95, palette.cloth, 0.95 + random() * 0.12, {
        topScaleX: 1.25, topScaleZ: 1.2,
    });

    const elbow = -upperLength * 2;
    const bend = kind === "runner" ? 0.16 : 0.09;

    pushTapered(batch, side * bend, elbow - foreLength, 0.03, thick * 0.86, foreLength, thick * 0.82, palette.flesh, 1 + random() * 0.1, {
        topScaleX: 1.2, topScaleZ: 1.15, leanX: -side * bend,
    });

    const handY = elbow - foreLength * 2;
    pushTapered(batch, side * bend * 1.4, handY - 0.1, 0.04, thick * 1.05, 0.12, thick * 0.7, palette.fleshDark, 1);

    for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * thick * 0.7;
        pushTapered(
            batch,
            side * bend * 1.4 + spread, handY - 0.26, 0.06,
            thick * 0.22, 0.14, thick * 0.24,
            palette.fleshDark, 0.94,
            { leanX: side * 0.05, leanZ: 0.05 }
        );
    }

    if (kind !== "herald" && random() < 0.55) {
        pushTapered(batch, 0, elbow + 0.08, thick * 0.9, thick * 0.9, 0.16, 0.05, palette.clothDark, 1.05);
    }

    return toGeometry(batch);
}

function buildLeg(kind: ZombieKind, side: number, variant: number, palette: Palette): THREE.BufferGeometry {
    const random = rng(variant * 613 + side * 71 + kind.length * 29);
    const batch = makeBatch();

    if (kind === "herald") {
        pushTapered(batch, 0, -0.42, 0, 0.16, 0.42, 0.16, palette.clothDark, 0.9, { topScaleX: 1.5, topScaleZ: 1.5 });
        return toGeometry(batch);
    }

    const thighLength = kind === "brute" ? 0.3 : 0.44;
    const shinLength = kind === "brute" ? 0.3 : 0.46;
    const thick = kind === "brute" ? 0.26 : kind === "runner" ? 0.12 : 0.15;

    pushTapered(batch, 0, -thighLength, 0, thick, thighLength, thick, palette.cloth, 0.95 + random() * 0.1, {
        topScaleX: 1.18, topScaleZ: 1.15,
    });

    const knee = -thighLength * 2;
    pushTapered(batch, 0, knee - shinLength, -0.02, thick * 0.85, shinLength, thick * 0.85, palette.flesh, 1, {
        topScaleX: 1.12, topScaleZ: 1.1,
    });

    const footY = knee - shinLength * 2;
    pushTapered(batch, 0, footY - 0.07, 0.09, thick * 0.95, 0.08, thick * 1.5, palette.clothDark, 1.02);

    if (random() < 0.4) {
        pushTapered(batch, 0, knee + 0.05, thick * 0.8, thick * 0.75, 0.13, 0.05, palette.blood, 1.1);
    }

    return toGeometry(batch);
}

function buildBody(kind: ZombieKind, variant: number, palette: Palette): { geometry: THREE.BufferGeometry; eyes: THREE.BufferGeometry; shoulderY: number; hipY: number; height: number } {
    const random = rng(variant * 331 + kind.length * 47);
    const batch = makeBatch();
    const eyes = makeBatch();

    const chestWidth = kind === "brute" ? 0.66 : kind === "runner" ? 0.3 : 0.36;
    const chestDepth = kind === "brute" ? 0.46 : kind === "runner" ? 0.19 : 0.23;
    const chestHeight = kind === "brute" ? 0.5 : 0.42;
    const hipY = kind === "brute" ? 0.82 : kind === "runner" ? 1.0 : 0.98;
    const shoulderY = hipY + chestHeight * 1.7;

    pushTapered(batch, 0, hipY - 0.16, 0, chestWidth * 0.72, 0.2, chestDepth * 0.9, palette.cloth, 0.95, {
        topScaleX: 1.05, topScaleZ: 1.05,
    });

    pushTapered(batch, 0, hipY + chestHeight * 0.55, 0, chestWidth * 0.78, chestHeight * 0.75, chestDepth, palette.cloth, 1, {
        topScaleX: 1.22, topScaleZ: 1.05, leanZ: kind === "runner" ? 0.05 : 0,
    });

    if (kind !== "herald") {
        const ribs = kind === "brute" ? 2 : 3;
        for (let i = 0; i < ribs; i++) {
            if (random() < 0.35) continue;
            const y = hipY + 0.2 + i * 0.16;
            pushTapered(batch, 0, y, chestDepth * 0.94, chestWidth * (0.62 - i * 0.06), 0.045, 0.03, palette.bone, 1.25);
        }
    }

    pushTapered(batch, 0, shoulderY - 0.16, 0, chestWidth * 1.02, 0.18, chestDepth * 1.02, palette.cloth, 1.04, {
        topScaleX: 0.62, topScaleZ: 0.72,
    });

    const neckLean = kind === "runner" ? 0.1 : kind === "brute" ? 0.04 : 0.05;
    const headY = shoulderY + (kind === "brute" ? 0.22 : 0.2);

    pushTapered(batch, 0, shoulderY, neckLean * 0.5, 0.09, 0.08, 0.09, palette.fleshDark, 0.92);

    const headWidth = kind === "brute" ? 0.3 : 0.17;
    const headDepth = kind === "runner" ? 0.21 : kind === "brute" ? 0.28 : 0.18;

    const headHeight = kind === "brute" ? 0.24 : 0.15;
    pushTapered(batch, 0, headY, neckLean, headWidth, headHeight, headDepth, palette.flesh, 1.05, {
        topScaleX: 0.86, topScaleZ: 0.86, leanZ: neckLean * 0.5,
    });

    const jawDrop = kind === "runner" ? 0.16 : 0.1;
    pushTapered(batch, 0, headY - 0.13, neckLean + headDepth * 0.42, headWidth * 0.7, jawDrop * 0.5, headDepth * 0.55, palette.fleshDark, 0.96, {
        leanZ: 0.05,
    });

    for (const side of [-1, 1]) {
        pushTapered(
            batch,
            side * headWidth * 0.42, headY + headHeight * 0.2, neckLean + headDepth * 0.86,
            headWidth * 0.24, 0.045, 0.03,
            palette.fleshDark, 0.4
        );
    }

    if (kind === "herald") {
        pushTapered(batch, 0, headY + 0.22, neckLean, headWidth * 1.5, 0.1, headDepth * 1.5, palette.clothDark, 1.05, {
            topScaleX: 0.3, topScaleZ: 0.3,
        });
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            pushTapered(
                batch,
                Math.cos(angle) * 0.34, shoulderY + 0.34 + Math.sin(angle * 1.7) * 0.1, Math.sin(angle) * 0.34,
                0.04, 0.11, 0.04,
                palette.glow, 1.7
            );
        }
        pushTapered(batch, 0, hipY - 0.55, 0, chestWidth * 0.9, 0.55, chestDepth * 1.2, palette.clothDark, 0.9, {
            topScaleX: 0.78, topScaleZ: 0.72,
        });
    }

    if (kind === "brute") {
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.7;
            pushTapered(
                batch,
                Math.cos(angle) * chestWidth * 0.7, hipY + chestHeight * (0.6 + (i % 2) * 0.35), Math.sin(angle) * chestDepth * 0.9,
                0.06, 0.11, 0.06,
                palette.bone, 1.3,
                { topScaleX: 0.3, topScaleZ: 0.3, leanZ: 0.04 }
            );
        }
    }

    if (kind !== "herald" && random() < 0.6) {
        pushTapered(batch, chestWidth * 0.3, hipY + 0.42, chestDepth * 0.98, 0.09, 0.09, 0.02, palette.blood, 1.2);
    }

    for (const side of [-1, 1]) {
        pushTapered(
            eyes,
            side * headWidth * 0.42, headY + headHeight * 0.2, neckLean + headDepth * 0.92,
            headWidth * 0.2, 0.038, 0.02,
            palette.glow, 1
        );
    }

    return { geometry: toGeometry(batch), eyes: toGeometry(eyes), shoulderY, hipY, height: headY + 0.3 };
}

function buildSilhouette(kind: ZombieKind, palette: Palette, hipY: number, shoulderY: number, height: number): THREE.BufferGeometry {
    const batch = makeBatch();
    const width = kind === "brute" ? 0.6 : kind === "runner" ? 0.3 : 0.36;

    pushTapered(batch, 0, hipY * 0.5, 0, width * 0.5, hipY * 0.5, width * 0.4, palette.cloth, 0.9, {
        topScaleX: 1.25, topScaleZ: 1.2,
    });
    pushTapered(batch, 0, (hipY + shoulderY) / 2, 0, width * 0.8, (shoulderY - hipY) / 2, width * 0.55, palette.cloth, 1, {
        topScaleX: 1.05, topScaleZ: 1,
    });
    pushTapered(batch, 0, (shoulderY + height) / 2, 0, width * 0.42, (height - shoulderY) / 2, width * 0.42, palette.flesh, 1.05, {
        topScaleX: 0.8, topScaleZ: 0.8,
    });

    return toGeometry(batch);
}

function partsFor(kind: ZombieKind, variant: number): PartGeometries {
    const key = `${kind}:${variant}`;
    const cached = CACHE.get(key);
    if (cached) return cached;

    const palette = PALETTES[kind];
    const body = buildBody(kind, variant, palette);

    const parts: PartGeometries = {
        body: body.geometry,
        eyes: body.eyes,
        armL: buildArm(kind, -1, variant, palette),
        armR: buildArm(kind, 1, variant, palette),
        legL: buildLeg(kind, -1, variant, palette),
        legR: buildLeg(kind, 1, variant, palette),
        silhouette: buildSilhouette(kind, palette, body.hipY, body.shoulderY, body.height),
        shoulderY: body.shoulderY,
        hipY: body.hipY,
        height: body.height,
    };

    CACHE.set(key, parts);
    return parts;
}

let sharedMaterial: THREE.MeshStandardMaterial | null = null;
let sharedEyeMaterial: THREE.MeshBasicMaterial | null = null;

function eyeMaterial(): THREE.MeshBasicMaterial {
    if (!sharedEyeMaterial) {
        sharedEyeMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            toneMapped: false,
            fog: true,
        });
    }
    return sharedEyeMaterial;
}

function zombieMaterial(): THREE.MeshStandardMaterial {
    if (!sharedMaterial) {
        sharedMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.86,
            metalness: 0.04,
            flatShading: true,
        });
    }
    return sharedMaterial;
}

const DETAIL_DISTANCE = 46;

export class ZombieModel {
    public readonly group: THREE.Group;

    private readonly kind: ZombieKind;
    private readonly parts: PartGeometries;
    private readonly bodyMesh: THREE.Mesh;
    private readonly eyeMesh: THREE.Mesh;
    private readonly silhouetteMesh: THREE.Mesh;
    private readonly armL: THREE.Object3D;
    private readonly armR: THREE.Object3D;
    private readonly legL: THREE.Object3D;
    private readonly legR: THREE.Object3D;
    private readonly limbs: THREE.Object3D[];

    private readonly lurch: number;
    private readonly tilt: number;
    private readonly limpSide: number;

    private phase: number;
    private time = 0;
    private attackBlend = 0;
    private detailed = true;

    constructor(kind: ZombieKind, seed: number) {
        this.kind = kind;
        const variant = Math.abs(seed) % 4;
        this.parts = partsFor(kind, variant);

        const random = rng(seed + 4801);
        this.lurch = (random() - 0.5) * (kind === "runner" ? 0.12 : 0.3);
        this.tilt = (random() - 0.5) * 0.22;
        this.limpSide = random() < 0.5 ? -1 : 1;
        this.phase = random() * Math.PI * 2;

        const material = zombieMaterial();
        this.group = new THREE.Group();

        this.bodyMesh = new THREE.Mesh(this.parts.body, material);
        this.group.add(this.bodyMesh);

        this.eyeMesh = new THREE.Mesh(this.parts.eyes, eyeMaterial());
        this.eyeMesh.renderOrder = 2;
        this.group.add(this.eyeMesh);

        this.silhouetteMesh = new THREE.Mesh(this.parts.silhouette, material);
        this.silhouetteMesh.visible = false;
        this.group.add(this.silhouetteMesh);

        const shoulderSpread = kind === "brute" ? 0.52 : kind === "runner" ? 0.27 : 0.33;
        const hipSpread = kind === "brute" ? 0.26 : 0.16;

        this.armL = new THREE.Object3D();
        this.armL.position.set(-shoulderSpread, this.parts.shoulderY - 0.06, 0);
        this.armL.add(new THREE.Mesh(this.parts.armL, material));
        this.group.add(this.armL);

        this.armR = new THREE.Object3D();
        this.armR.position.set(shoulderSpread, this.parts.shoulderY - 0.06, 0);
        this.armR.add(new THREE.Mesh(this.parts.armR, material));
        this.group.add(this.armR);

        this.legL = new THREE.Object3D();
        this.legL.position.set(-hipSpread, this.parts.hipY - 0.2, 0);
        this.legL.add(new THREE.Mesh(this.parts.legL, material));
        this.group.add(this.legL);

        this.legR = new THREE.Object3D();
        this.legR.position.set(hipSpread, this.parts.hipY - 0.2, 0);
        this.legR.add(new THREE.Mesh(this.parts.legR, material));
        this.group.add(this.legR);

        this.limbs = [this.armL, this.armR, this.legL, this.legR];
    }

    public get height(): number {
        return this.parts.height;
    }

    public setDistance(distance: number) {
        const detailed = distance < DETAIL_DISTANCE;
        if (detailed === this.detailed) return;

        this.detailed = detailed;
        this.bodyMesh.visible = detailed;
        this.eyeMesh.visible = detailed;
        this.silhouetteMesh.visible = !detailed;
        for (const limb of this.limbs) limb.visible = detailed;
    }

    public triggerAttack() {
        this.attackBlend = 1;
    }

    public update(delta: number, pose: ZombiePose) {
        this.time += delta;
        this.attackBlend = Math.max(0, this.attackBlend - delta * 2.2);

        if (pose.hidden) {
            this.group.position.y = -0.28;
            this.group.rotation.x = 0.42;
            this.group.rotation.z = this.tilt * 0.4;

            if (this.detailed) {
                this.armL.rotation.set(-0.9, 0, 0.35);
                this.armR.rotation.set(-0.9, 0, -0.35);
                this.legL.rotation.set(0.9, 0, 0);
                this.legR.rotation.set(0.9, 0, 0);
            }
            return;
        }

        const cadence = this.kind === "runner" ? 9.5 : this.kind === "brute" ? 3.1 : 4.4;
        const stride = pose.moving ? Math.min(1.4, 0.55 + pose.speed * 0.1) : 0;

        this.phase += delta * cadence * (pose.moving ? 1 : 0.22);

        const swing = Math.sin(this.phase);
        const bob = Math.abs(Math.cos(this.phase));

        const lean = pose.lunging ? 0.55 : this.kind === "runner" ? 0.34 : this.kind === "brute" ? 0.08 : 0.2;
        this.group.rotation.x = lean + this.lurch * 0.4 + (pose.moving ? bob * 0.05 : 0);
        this.group.rotation.z = this.tilt + swing * 0.05 * stride;
        this.group.position.y = pose.moving ? bob * 0.06 * stride : Math.sin(this.time * 1.4) * 0.015;

        if (!this.detailed) return;

        const attack = this.attackBlend * this.attackBlend;
        const reach = this.kind === "brute" ? 1.9 : 1.5;

        const armBase = pose.lunging
            ? -1.5
            : pose.aggro
                ? this.kind === "brute" ? -0.5 : -1.15
                : this.kind === "walker" ? -0.35 : -0.2;

        const armSwing = swing * 0.55 * stride * (pose.aggro ? 0.35 : 1);

        this.armL.rotation.x = armBase - armSwing - attack * reach;
        this.armR.rotation.x = armBase + armSwing - attack * reach;
        this.armL.rotation.z = 0.16 + (pose.aggro ? 0.1 : 0) + this.lurch * 0.3;
        this.armR.rotation.z = -0.16 - (pose.aggro ? 0.1 : 0) + this.lurch * 0.3;

        if (this.kind === "herald") {
            this.armL.rotation.x = -0.72 + Math.sin(this.time * 1.1) * 0.14 - attack * 0.8;
            this.armR.rotation.x = -0.72 + Math.cos(this.time * 1.3) * 0.14 - attack * 0.8;
            this.armL.rotation.z = 0.62 + Math.sin(this.time * 0.8) * 0.08;
            this.armR.rotation.z = -0.62 - Math.sin(this.time * 0.8) * 0.08;
            this.legL.rotation.x = 0;
            this.legR.rotation.x = 0;
            return;
        }

        const limp = this.kind === "walker" ? 0.35 : 0;
        this.legL.rotation.x = swing * 0.72 * stride * (this.limpSide < 0 ? 1 - limp : 1);
        this.legR.rotation.x = -swing * 0.72 * stride * (this.limpSide > 0 ? 1 - limp : 1);
        this.legL.rotation.z = 0.04;
        this.legR.rotation.z = -0.04;
    }

    public dispose() {
        this.group.removeFromParent();
    }
}

export function disposeZombieGeometry() {
    for (const parts of CACHE.values()) {
        parts.body.dispose();
        parts.armL.dispose();
        parts.armR.dispose();
        parts.legL.dispose();
        parts.legR.dispose();
        parts.silhouette.dispose();
        parts.eyes.dispose();
    }
    CACHE.clear();

    sharedMaterial?.dispose();
    sharedMaterial = null;
    sharedEyeMaterial?.dispose();
    sharedEyeMaterial = null;
}
