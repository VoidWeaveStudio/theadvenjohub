// src/features/game/world/locations/influence/systems/InfluenceCrystalSystem.ts
import * as THREE from "three";
import { CITY_CRYSTAL } from "../cityLayout";

export type CrystalPhase = "sealed" | "claimable" | "owned" | "siege" | "broken";

export const CRYSTAL_INTERACTION = "influence-crystal";

const SHARD_COUNT = 7;
const BASE_Y = 1.35;
const HALO_SIZE = 9;
const BEAM_HEIGHT = 240;

const PHASE_COLOUR: Record<CrystalPhase, number> = {
    sealed: 0x4a4658,
    claimable: 0xbfa6ff,
    owned: 0x6fd8ff,
    siege: 0xff5a48,
    broken: 0x2a2630,
};

function createHaloTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.32, "rgba(255,255,255,0.34)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export class InfluenceCrystalSystem {
    public readonly group: THREE.Group;

    private readonly shards: THREE.Mesh[] = [];
    private readonly shardPhase: number[] = [];
    private readonly material: THREE.MeshStandardMaterial;
    private readonly cageMaterial: THREE.MeshStandardMaterial;
    private readonly halo: THREE.Sprite;
    private readonly haloTexture: THREE.CanvasTexture;
    private readonly light: THREE.PointLight;
    private readonly ringMaterial: THREE.MeshBasicMaterial;
    private readonly ring: THREE.Mesh;
    private readonly beam: THREE.Mesh;
    private readonly beamMaterial: THREE.MeshBasicMaterial;

    private phase: CrystalPhase = "sealed";
    private healthFraction = 1;
    private captureProgress = 0;
    private tint = new THREE.Color(PHASE_COLOUR.sealed);
    private target = new THREE.Color(PHASE_COLOUR.sealed);
    private time = 0;

    constructor() {
        this.group = new THREE.Group();
        this.group.position.set(CITY_CRYSTAL.x, 0, CITY_CRYSTAL.z);
        this.group.name = "influence-crystal";
        this.group.userData.interactionId = CRYSTAL_INTERACTION;
        this.group.userData.interactionRadius = 6.5;

        this.material = new THREE.MeshStandardMaterial({
            color: 0x1b1a26,
            emissive: PHASE_COLOUR.sealed,
            emissiveIntensity: 1.4,
            roughness: 0.24,
            metalness: 0.1,
            transparent: true,
            opacity: 0.92,
            flatShading: true,
        });

        this.cageMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3444,
            roughness: 0.7,
            metalness: 0.35,
            flatShading: true,
        });

        const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), this.material);
        core.position.y = BASE_Y + 1.9;
        this.group.add(core);
        this.shards.push(core);
        this.shardPhase.push(0);

        for (let i = 1; i < SHARD_COUNT; i++) {
            const size = 0.42 + (i % 3) * 0.22;
            const shard = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), this.material);
            shard.scale.y = 1.7 + (i % 2) * 0.5;
            this.group.add(shard);
            this.shards.push(shard);
            this.shardPhase.push((i / (SHARD_COUNT - 1)) * Math.PI * 2);
        }

        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, BASE_Y, 8), this.cageMaterial);
        plinth.position.y = BASE_Y / 2;
        this.group.add(plinth);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), this.cageMaterial);
            arm.position.set(Math.cos(angle) * 1.9, BASE_Y + 1.5, Math.sin(angle) * 1.9);
            arm.rotation.z = Math.cos(angle) * 0.22;
            arm.rotation.x = -Math.sin(angle) * 0.22;
            this.group.add(arm);
        }

        this.haloTexture = createHaloTexture();
        this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.haloTexture,
            color: PHASE_COLOUR.sealed,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        }));
        this.halo.position.y = BASE_Y + 1.9;
        this.halo.scale.setScalar(HALO_SIZE);
        this.halo.renderOrder = 4;
        this.group.add(this.halo);

        this.light = new THREE.PointLight(PHASE_COLOUR.sealed, 8, 44, 2);
        this.light.position.y = BASE_Y + 2.4;
        this.group.add(this.light);

        this.ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        });
        this.ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.9, 48, 1, 0, 0), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.12;
        this.ring.renderOrder = 5;
        this.group.add(this.ring);

        this.beamMaterial = new THREE.MeshBasicMaterial({
            color: PHASE_COLOUR.sealed,
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
        });
        this.beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 3.4, BEAM_HEIGHT, 12, 1, true),
            this.beamMaterial
        );
        this.beam.position.y = BEAM_HEIGHT / 2;
        this.beam.renderOrder = 5;
        this.beam.frustumCulled = false;
        this.group.add(this.beam);
    }

    public setPhase(phase: CrystalPhase, ownerColour: number | null) {
        this.phase = phase;
        const base = phase === "owned" && ownerColour !== null ? ownerColour : PHASE_COLOUR[phase];
        this.target.setHex(base);
    }

    public setHealth(fraction: number) {
        this.healthFraction = THREE.MathUtils.clamp(fraction, 0, 1);
    }

    public setCaptureProgress(progress: number) {
        this.captureProgress = THREE.MathUtils.clamp(progress, 0, 1);
    }

    public update(delta: number) {
        this.time += delta;
        this.tint.lerp(this.target, Math.min(1, delta * 2.4));

        const wounded = 0.35 + this.healthFraction * 0.65;
        const beat = this.phase === "siege"
            ? 0.55 + 0.45 * Math.abs(Math.sin(this.time * 3.4))
            : 0.72 + 0.28 * Math.sin(this.time * 1.05);

        const alive = this.phase !== "broken";
        const glow = alive ? beat * wounded : 0.08;

        this.material.emissive.copy(this.tint);
        this.material.emissiveIntensity = 0.6 + glow * 2.1;
        this.material.opacity = 0.55 + glow * 0.42;

        this.light.color.copy(this.tint);
        this.light.intensity = alive ? 3 + glow * 9 : 0.4;
        this.light.distance = 26 + glow * 26;

        (this.halo.material as THREE.SpriteMaterial).color.copy(this.tint);
        (this.halo.material as THREE.SpriteMaterial).opacity = alive ? 0.16 + glow * 0.3 : 0.04;
        this.halo.scale.setScalar(HALO_SIZE * (0.86 + glow * 0.24));

        this.beamMaterial.color.copy(this.tint);
        this.beamMaterial.opacity = alive
            ? (this.phase === "sealed" ? 0.03 + glow * 0.05 : 0.05 + glow * 0.14)
            : 0;
        this.beam.visible = alive;

        const core = this.shards[0];
        core.rotation.y += delta * 0.42;
        core.rotation.x += delta * 0.17;
        core.position.y = BASE_Y + 1.9 + Math.sin(this.time * 0.9) * 0.16;
        core.scale.setScalar(alive ? 1 : 0.55);

        for (let i = 1; i < this.shards.length; i++) {
            const shard = this.shards[i];
            const phase = this.shardPhase[i] + this.time * (0.32 + (i % 3) * 0.09);
            const radius = alive ? 2.05 + Math.sin(this.time * 0.7 + i) * 0.28 : 3.6;
            const lift = alive ? 1.4 + Math.sin(this.time * 1.3 + i * 1.7) * 0.5 : -0.4;

            shard.position.set(Math.cos(phase) * radius, BASE_Y + lift, Math.sin(phase) * radius);
            shard.rotation.y = phase * 1.4;
            shard.rotation.z = Math.sin(this.time * 0.8 + i) * 0.4;
        }

        if (this.captureProgress > 0.001) {
            this.ring.geometry.dispose();
            this.ring.geometry = new THREE.RingGeometry(3.1, 3.9, 48, 1, -Math.PI / 2, this.captureProgress * Math.PI * 2);
            this.ringMaterial.opacity = 0.55 + Math.sin(this.time * 6) * 0.15;
            this.ringMaterial.color.copy(this.tint);
            this.ring.visible = true;
        } else {
            this.ring.visible = false;
        }
    }

    public dispose() {
        this.group.removeFromParent();

        for (const shard of this.shards) shard.geometry.dispose();
        this.material.dispose();
        this.cageMaterial.dispose();

        this.halo.material.dispose();
        this.haloTexture.dispose();

        this.ring.geometry.dispose();
        this.ringMaterial.dispose();
        this.beam.geometry.dispose();
        this.beamMaterial.dispose();

        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && !this.shards.includes(child)) child.geometry.dispose();
        });
    }
}
