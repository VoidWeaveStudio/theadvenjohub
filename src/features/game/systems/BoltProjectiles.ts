// src/features/game/systems/BoltProjectiles.ts
import * as THREE from "three";

export interface BoltSpawn {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    speed: number;
    maxRange: number;
    pierce: number;
    accent: number;
    charged: boolean;
    local: boolean;
}

export type BoltStepResult = "continue" | "stop";

export interface BoltStep {
    from: THREE.Vector3;
    to: THREE.Vector3;
    bolt: Bolt;
}

const EMBER_COUNT = 16;
const ARC_POINTS = 22;
const ARC_STRANDS = 3;
const ARC_BRANCHES = 2;
const ARC_BRANCH_POINTS = 5;
const ARC_RESHAPE_HZ = 22;

let sharedEmberTexture: THREE.CanvasTexture | null = null;

function emberTexture(): THREE.CanvasTexture {
    if (sharedEmberTexture) return sharedEmberTexture;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,226,150,0.8)");
    gradient.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    sharedEmberTexture = new THREE.CanvasTexture(canvas);
    return sharedEmberTexture;
}

class Fireball {
    public readonly group = new THREE.Group();

    private readonly core: THREE.Mesh;
    private readonly coreMaterial: THREE.MeshBasicMaterial;
    private readonly shell: THREE.Mesh;
    private readonly shellMaterial: THREE.MeshBasicMaterial;
    private readonly tail: THREE.Mesh;
    private readonly tailMaterial: THREE.MeshBasicMaterial;
    private readonly embers: THREE.Points;
    private readonly emberGeometry: THREE.BufferGeometry;
    private readonly emberMaterial: THREE.PointsMaterial;
    private readonly emberPositions: Float32Array;
    private readonly emberSeeds: Float32Array;

    constructor(accent: number, scale: number) {
        this.coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xfff4d0,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
        });
        this.core = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 10, 8), this.coreMaterial);
        this.group.add(this.core);

        this.shellMaterial = new THREE.MeshBasicMaterial({
            color: accent,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 14, 12), this.shellMaterial);
        this.group.add(this.shell);

        this.tailMaterial = new THREE.MeshBasicMaterial({
            color: accent,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            side: THREE.DoubleSide,
        });
        this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.15 * scale, 1.15 * scale, 10, 1, true), this.tailMaterial);
        this.tail.rotation.x = -Math.PI / 2;
        this.tail.position.z = -0.58 * scale;
        this.group.add(this.tail);

        this.emberPositions = new Float32Array(EMBER_COUNT * 3);
        this.emberSeeds = new Float32Array(EMBER_COUNT);
        for (let i = 0; i < EMBER_COUNT; i++) this.emberSeeds[i] = Math.random();

        this.emberGeometry = new THREE.BufferGeometry();
        this.emberGeometry.setAttribute("position", new THREE.BufferAttribute(this.emberPositions, 3));
        this.emberMaterial = new THREE.PointsMaterial({
            color: accent,
            size: 0.13 * scale,
            map: emberTexture(),
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            toneMapped: false,
        });
        this.embers = new THREE.Points(this.emberGeometry, this.emberMaterial);
        this.embers.frustumCulled = false;
        this.group.add(this.embers);
    }

    update(elapsed: number, flicker: number) {
        const pulse = 1 + Math.sin(flicker) * 0.2;
        this.shell.scale.setScalar(pulse);
        this.shellMaterial.opacity = 0.44 + Math.sin(flicker * 0.7) * 0.16;
        this.coreMaterial.opacity = 0.9 + Math.sin(flicker * 1.6) * 0.1;
        this.tail.scale.set(pulse, 1, pulse);
        this.tailMaterial.opacity = 0.26 + Math.abs(Math.sin(flicker * 0.5)) * 0.16;

        for (let i = 0; i < EMBER_COUNT; i++) {
            const seed = this.emberSeeds[i];
            const life = (seed + elapsed * 2.4) % 1;
            const spread = 0.05 + life * 0.16;
            this.emberPositions[i * 3] = Math.sin(seed * 41 + elapsed * 7) * spread;
            this.emberPositions[i * 3 + 1] = Math.cos(seed * 33 + elapsed * 6) * spread;
            this.emberPositions[i * 3 + 2] = -life * 1.25;
        }
        this.emberGeometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        this.core.geometry.dispose();
        this.coreMaterial.dispose();
        this.shell.geometry.dispose();
        this.shellMaterial.dispose();
        this.tail.geometry.dispose();
        this.tailMaterial.dispose();
        this.emberGeometry.dispose();
        this.emberMaterial.dispose();
    }
}

class LightningArc {
    public readonly group = new THREE.Group();

    private readonly strands: THREE.Line[] = [];
    private readonly strandBuffers: Float32Array[] = [];
    private readonly strandMaterials: THREE.LineBasicMaterial[] = [];
    private readonly branches: THREE.Line[] = [];
    private readonly branchBuffers: Float32Array[] = [];
    private readonly branchMaterials: THREE.LineBasicMaterial[] = [];

    private readonly axis = new THREE.Vector3();
    private readonly sideA = new THREE.Vector3();
    private readonly sideB = new THREE.Vector3();
    private readonly point = new THREE.Vector3();

    private reshapeAt = 0;

    constructor(accent: number) {
        const strandStyle: { color: number; opacity: number; jitter: number }[] = [
            { color: 0xffffff, opacity: 0.95, jitter: 0.05 },
            { color: accent, opacity: 0.7, jitter: 0.16 },
            { color: accent, opacity: 0.4, jitter: 0.3 },
        ];

        for (let s = 0; s < ARC_STRANDS; s++) {
            const style = strandStyle[s] ?? strandStyle[strandStyle.length - 1];
            const buffer = new Float32Array(ARC_POINTS * 3);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(buffer, 3));

            const material = new THREE.LineBasicMaterial({
                color: style.color,
                transparent: true,
                opacity: style.opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });

            const line = new THREE.Line(geometry, material);
            line.frustumCulled = false;
            this.group.add(line);

            this.strands.push(line);
            this.strandBuffers.push(buffer);
            this.strandMaterials.push(material);
        }

        for (let b = 0; b < ARC_BRANCHES; b++) {
            const buffer = new Float32Array(ARC_BRANCH_POINTS * 3);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(buffer, 3));

            const material = new THREE.LineBasicMaterial({
                color: accent,
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });

            const line = new THREE.Line(geometry, material);
            line.frustumCulled = false;
            this.group.add(line);

            this.branches.push(line);
            this.branchBuffers.push(buffer);
            this.branchMaterials.push(material);
        }
    }

    private basis(from: THREE.Vector3, to: THREE.Vector3): number {
        this.axis.copy(to).sub(from);
        const length = this.axis.length();
        if (length < 1e-5) return 0;
        this.axis.divideScalar(length);

        this.sideA.set(0, 1, 0);
        if (Math.abs(this.axis.dot(this.sideA)) > 0.9) this.sideA.set(1, 0, 0);
        this.sideA.crossVectors(this.axis, this.sideA).normalize();
        this.sideB.crossVectors(this.axis, this.sideA).normalize();

        return length;
    }

    update(from: THREE.Vector3, to: THREE.Vector3, elapsed: number) {
        if (elapsed < this.reshapeAt) return;
        this.reshapeAt = elapsed + 1 / ARC_RESHAPE_HZ;

        const length = this.basis(from, to);
        if (length === 0) return;

        const wobble = Math.min(0.45, 0.08 + length * 0.02);

        for (let s = 0; s < this.strands.length; s++) {
            const buffer = this.strandBuffers[s];
            const jitter = wobble * (0.35 + s * 0.5);

            for (let i = 0; i < ARC_POINTS; i++) {
                const t = i / (ARC_POINTS - 1);
                const taper = Math.sin(t * Math.PI);
                const offsetA = (Math.random() - 0.5) * jitter * taper;
                const offsetB = (Math.random() - 0.5) * jitter * taper;

                this.point
                    .copy(from)
                    .addScaledVector(this.axis, length * t)
                    .addScaledVector(this.sideA, offsetA)
                    .addScaledVector(this.sideB, offsetB);

                buffer[i * 3] = this.point.x;
                buffer[i * 3 + 1] = this.point.y;
                buffer[i * 3 + 2] = this.point.z;
            }

            this.strands[s].geometry.attributes.position.needsUpdate = true;
            this.strands[s].geometry.computeBoundingSphere();
        }

        for (let b = 0; b < this.branches.length; b++) {
            const buffer = this.branchBuffers[b];
            const root = 0.25 + Math.random() * 0.5;
            const spread = wobble * 2.2;

            for (let i = 0; i < ARC_BRANCH_POINTS; i++) {
                const t = i / (ARC_BRANCH_POINTS - 1);
                this.point
                    .copy(from)
                    .addScaledVector(this.axis, length * (root + t * 0.12))
                    .addScaledVector(this.sideA, (Math.random() - 0.5) * spread * t)
                    .addScaledVector(this.sideB, (Math.random() - 0.5) * spread * t);

                buffer[i * 3] = this.point.x;
                buffer[i * 3 + 1] = this.point.y;
                buffer[i * 3 + 2] = this.point.z;
            }

            this.branchMaterials[b].opacity = 0.25 + Math.random() * 0.4;
            this.branches[b].geometry.attributes.position.needsUpdate = true;
            this.branches[b].geometry.computeBoundingSphere();
        }
    }

    dispose() {
        for (const line of [...this.strands, ...this.branches]) {
            line.geometry.dispose();
        }
        for (const material of [...this.strandMaterials, ...this.branchMaterials]) {
            material.dispose();
        }
        this.group.removeFromParent();
    }
}

export class Bolt {
    public readonly object = new THREE.Group();
    public readonly worldObject: THREE.Group | null;
    public readonly position: THREE.Vector3;
    public readonly direction: THREE.Vector3;
    public readonly speed: number;
    public readonly maxRange: number;
    public readonly local: boolean;
    public readonly hitIds = new Set<string>();

    public pierceLeft: number;
    public travelled = 0;

    private readonly spawnPoint: THREE.Vector3;
    private readonly fireball: Fireball | null;
    private readonly arc: LightningArc | null;
    private readonly head: THREE.Mesh | null;
    private readonly headMaterial: THREE.MeshBasicMaterial | null;
    private flicker = Math.random() * Math.PI * 2;
    private elapsed = 0;

    constructor(spawn: BoltSpawn) {
        this.position = spawn.origin.clone();
        this.spawnPoint = spawn.origin.clone();
        this.direction = spawn.direction.clone().normalize();
        this.speed = spawn.speed;
        this.maxRange = spawn.maxRange;
        this.pierceLeft = spawn.pierce;
        this.local = spawn.local;

        if (spawn.charged) {
            this.fireball = null;
            this.arc = new LightningArc(spawn.accent);
            this.worldObject = this.arc.group;

            this.headMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });
            this.head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.headMaterial);
            this.object.add(this.head);
        } else {
            this.fireball = new Fireball(spawn.accent, 1);
            this.arc = null;
            this.worldObject = null;
            this.head = null;
            this.headMaterial = null;
            this.object.add(this.fireball.group);
        }

        this.object.position.copy(this.position);
        this.object.lookAt(this.position.clone().add(this.direction));
    }

    advance(delta: number): THREE.Vector3 {
        const step = Math.min(this.speed * delta, this.maxRange - this.travelled);
        this.travelled += step;

        this.elapsed += delta;
        this.flicker += delta * 26;

        if (this.fireball) {
            this.fireball.update(this.elapsed, this.flicker);
            this.object.rotateZ(delta * 7);
        }

        if (this.head && this.headMaterial) {
            const pulse = 1 + Math.sin(this.flicker * 2.4) * 0.25;
            this.head.scale.setScalar(pulse);
            this.headMaterial.opacity = 0.7 + Math.abs(Math.sin(this.flicker * 1.7)) * 0.3;
        }

        const next = this.position.clone().addScaledVector(this.direction, step);
        return next;
    }

    moveTo(point: THREE.Vector3) {
        this.position.copy(point);
        this.object.position.copy(point);
        this.arc?.update(this.spawnPoint, point, this.elapsed);
    }

    isSpent(): boolean {
        return this.travelled >= this.maxRange || this.pierceLeft < 0;
    }

    dispose() {
        this.object.removeFromParent();
        this.fireball?.dispose();
        this.arc?.dispose();
        this.head?.geometry.dispose();
        this.headMaterial?.dispose();
    }
}

export class BoltProjectiles {
    private readonly root = new THREE.Group();
    private readonly bolts: Bolt[] = [];

    private scene: THREE.Scene | null = null;

    setScene(scene: THREE.Scene) {
        if (this.scene === scene) return;

        this.root.removeFromParent();
        this.scene = scene;
        scene.add(this.root);
    }

    spawn(spawn: BoltSpawn): Bolt {
        const bolt = new Bolt(spawn);
        this.root.add(bolt.object);
        if (bolt.worldObject) this.root.add(bolt.worldObject);
        this.bolts.push(bolt);
        return bolt;
    }

    update(delta: number, onStep: (step: BoltStep) => BoltStepResult) {
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const bolt = this.bolts[i];
            const from = bolt.position.clone();
            const to = bolt.advance(delta);

            const result = onStep({ from, to, bolt });
            bolt.moveTo(to);

            if (result === "stop" || bolt.isSpent()) {
                bolt.dispose();
                this.bolts.splice(i, 1);
            }
        }
    }

    clear() {
        this.bolts.forEach((bolt) => bolt.dispose());
        this.bolts.length = 0;
    }

    dispose() {
        this.clear();
        this.root.removeFromParent();
        this.scene = null;
    }
}
