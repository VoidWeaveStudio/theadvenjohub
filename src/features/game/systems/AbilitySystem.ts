// src/features/game/systems/AbilitySystem.ts
import * as THREE from "three";
import { AbilityEffectData, AbilityImpactPendingData, AbilityZoneData } from "../network/NetworkManager";

const ABILITY_COLORS: Record<string, number> = {
    overdrive: 0xffb347,
    combat_roll: 0x9ad1ff,
    kinetic_barrier: 0x4fd1ff,
    bulwark: 0xffd166,
    frag_grenade: 0xff8c42,
    suppression_field: 0xffa94d,
    marked_target: 0xff5c5c,
    shockwave: 0xffc857,
    barrage: 0xff6b35,
    shatter_ward: 0xc77dff,
    chain_lightning: 0x7bdff2,
    meteor: 0xff7b54,
    ascendance: 0xe0aaff,
    blink: 0xa78bfa,
    mana_shield: 0x8ecae6,
    reflect_ward: 0xb8c0ff,
    phase_step: 0xd0bfff,
    slow_field: 0x74c0fc,
    gravity_well: 0x9775fa,
    healing_rune: 0x8ce99a,
    hex: 0xda77f2,
    time_dilation: 0x66d9e8,
    cataclysm: 0xf03e3e,
    second_wind: 0xffd43b,
    soul_tether: 0xd0bfff,
    ricochet: 0xffe066,
    explosive_rounds: 0xff922b,
    burning: 0xff7a1a,
    bleeding: 0xc92a2a,
};

const BURST_SECONDS = 0.55;
const CHAIN_SECONDS = 0.35;
const TELEGRAPH_MIN_SECONDS = 0.15;
const EMBER_SECONDS = 0.7;

function colorFor(abilityId: string): number {
    return ABILITY_COLORS[abilityId] ?? 0x4fd1ff;
}

function ringGeometry(radius: number): THREE.RingGeometry {
    return new THREE.RingGeometry(Math.max(0.05, radius - 0.18), radius, 48);
}

class Burst {
    public readonly object: THREE.Group;

    private readonly ring: THREE.Mesh;
    private readonly ringMaterial: THREE.MeshBasicMaterial;
    private readonly core: THREE.Mesh;
    private readonly coreMaterial: THREE.MeshBasicMaterial;
    private readonly radius: number;

    private elapsed = 0;

    constructor(position: number[], radius: number, color: number) {
        this.radius = Math.max(0.8, radius);
        this.object = new THREE.Group();
        this.object.position.set(position[0], position[1] + 0.08, position[2]);

        this.ringMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.ring = new THREE.Mesh(ringGeometry(this.radius), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.object.add(this.ring);

        this.coreMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            depthWrite: false,
        });
        this.core = new THREE.Mesh(new THREE.SphereGeometry(this.radius * 0.35, 16, 12), this.coreMaterial);
        this.core.position.y = this.radius * 0.3;
        this.object.add(this.core);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        const progress = this.elapsed / BURST_SECONDS;
        if (progress >= 1) return false;

        const scale = 0.35 + progress * 0.85;
        this.ring.scale.setScalar(scale);
        this.ringMaterial.opacity = 0.85 * (1 - progress);

        this.core.scale.setScalar(1 + progress * 0.6);
        this.coreMaterial.opacity = 0.5 * (1 - progress * 1.4);

        return true;
    }

    dispose() {
        this.object.removeFromParent();
        this.ring.geometry.dispose();
        this.ringMaterial.dispose();
        this.core.geometry.dispose();
        this.coreMaterial.dispose();
    }
}

class Telegraph {
    public readonly object: THREE.Group;

    private readonly ring: THREE.Mesh;
    private readonly ringMaterial: THREE.MeshBasicMaterial;
    private readonly fill: THREE.Mesh;
    private readonly fillMaterial: THREE.MeshBasicMaterial;
    private readonly duration: number;

    private elapsed = 0;

    constructor(position: number[], radius: number, color: number, durationSeconds: number) {
        this.duration = Math.max(TELEGRAPH_MIN_SECONDS, durationSeconds);
        this.object = new THREE.Group();
        this.object.position.set(position[0], position[1] + 0.06, position[2]);

        this.ringMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.ring = new THREE.Mesh(ringGeometry(radius), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.object.add(this.ring);

        this.fillMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), this.fillMaterial);
        this.fill.rotation.x = -Math.PI / 2;
        this.object.add(this.fill);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        const progress = this.elapsed / this.duration;
        if (progress >= 1) return false;

        this.fill.scale.setScalar(progress);
        this.ringMaterial.opacity = 0.5 + Math.abs(Math.sin(this.elapsed * 9)) * 0.4;

        return true;
    }

    dispose() {
        this.object.removeFromParent();
        this.ring.geometry.dispose();
        this.ringMaterial.dispose();
        this.fill.geometry.dispose();
        this.fillMaterial.dispose();
    }
}

class Zone {
    public readonly object: THREE.Group;
    public readonly casterId: string;
    public readonly slowPercent: number;
    public readonly radius: number;

    private readonly ring: THREE.Mesh;
    private readonly ringMaterial: THREE.MeshBasicMaterial;
    private readonly fillMaterial: THREE.MeshBasicMaterial;
    private readonly fill: THREE.Mesh;

    private elapsed = 0;

    constructor(position: number[], radius: number, color: number, casterId: string, slowPercent: number) {
        this.casterId = casterId;
        this.slowPercent = slowPercent;
        this.radius = radius;
        this.object = new THREE.Group();
        this.object.position.set(position[0], position[1] + 0.05, position[2]);

        this.ringMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.ring = new THREE.Mesh(ringGeometry(radius), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.object.add(this.ring);

        this.fillMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 44), this.fillMaterial);
        this.fill.rotation.x = -Math.PI / 2;
        this.object.add(this.fill);
    }

    update(delta: number) {
        this.elapsed += delta;
        const pulse = 0.5 + Math.sin(this.elapsed * 3) * 0.18;
        this.ringMaterial.opacity = pulse;
        this.fillMaterial.opacity = 0.08 + pulse * 0.08;
        this.object.rotation.y += delta * 0.35;
    }

    dispose() {
        this.object.removeFromParent();
        this.ring.geometry.dispose();
        this.ringMaterial.dispose();
        this.fill.geometry.dispose();
        this.fillMaterial.dispose();
    }
}

class Chain {
    public readonly object: THREE.Line;

    private readonly material: THREE.LineBasicMaterial;
    private elapsed = 0;

    constructor(points: number[][], color: number) {
        const vertices = points.map((p) => new THREE.Vector3(p[0], p[1] + 1.1, p[2]));
        const geometry = new THREE.BufferGeometry().setFromPoints(vertices);

        this.material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });
        this.object = new THREE.Line(geometry, this.material);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= CHAIN_SECONDS) return false;

        this.material.opacity = 0.95 * (1 - this.elapsed / CHAIN_SECONDS);
        return true;
    }

    dispose() {
        this.object.removeFromParent();
        this.object.geometry.dispose();
        this.material.dispose();
    }
}

class Ember {
    public readonly object: THREE.Mesh;

    private readonly material: THREE.MeshBasicMaterial;
    private readonly drift: number;
    private elapsed = 0;

    constructor(position: number[], color: number) {
        this.material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        });
        this.object = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), this.material);
        this.object.position.set(
            position[0] + (Math.random() - 0.5) * 0.55,
            position[1] + 0.75 + Math.random() * 0.4,
            position[2] + (Math.random() - 0.5) * 0.55
        );
        this.drift = 0.9 + Math.random() * 0.7;
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        const progress = this.elapsed / EMBER_SECONDS;
        if (progress >= 1) return false;

        this.object.position.y += delta * this.drift;
        this.object.scale.setScalar(1 - progress * 0.75);
        this.material.opacity = 0.9 * (1 - progress);

        return true;
    }

    dispose() {
        this.object.removeFromParent();
        this.object.geometry.dispose();
        this.material.dispose();
    }
}

export class AbilitySystem {
    private readonly root = new THREE.Group();

    private readonly bursts: Burst[] = [];
    private readonly telegraphs: Telegraph[] = [];
    private readonly chains: Chain[] = [];
    private readonly embers: Ember[] = [];
    private readonly zones = new Map<string, Zone>();

    private scene: THREE.Scene | null = null;

    attach(scene: THREE.Scene) {
        if (this.scene === scene) return;

        this.root.removeFromParent();
        this.scene = scene;
        scene.add(this.root);
    }

    playEffect(data: AbilityEffectData) {
        const color = colorFor(data.abilityId);

        if (data.kind === "chain" && data.chain && data.chain.length > 1) {
            const chain = new Chain(data.chain, color);
            this.root.add(chain.object);
            this.chains.push(chain);
            return;
        }

        const radius = data.radius > 0 ? data.radius : data.kind === "target" ? 1.2 : 2.2;
        this.spawnBurst(data.position, radius, color);
    }

    spawnBurst(position: number[], radius: number, color: number) {
        const burst = new Burst(position, radius, color);
        this.root.add(burst.object);
        this.bursts.push(burst);
    }

    spawnEmber(position: number[], abilityId: string) {
        const ember = new Ember(position, colorFor(abilityId));
        this.root.add(ember.object);
        this.embers.push(ember);
    }

    addPendingImpact(data: AbilityImpactPendingData) {
        const telegraph = new Telegraph(
            data.position,
            data.radius,
            colorFor(data.abilityId),
            data.resolveInMs / 1000
        );
        this.root.add(telegraph.object);
        this.telegraphs.push(telegraph);
    }

    addZone(data: AbilityZoneData) {
        this.removeZone(data.zoneId);

        const zone = new Zone(
            data.position,
            data.radius,
            colorFor(data.abilityId),
            data.casterId,
            data.slowPercent ?? 0
        );
        this.root.add(zone.object);
        this.zones.set(data.zoneId, zone);
    }

    hostileSlowAt(position: THREE.Vector3, localPlayerId: string, allyIds?: Set<string>): number {
        let strongest = 0;

        this.zones.forEach((zone) => {
            if (zone.slowPercent <= strongest) return;
            if (zone.casterId === localPlayerId) return;
            if (allyIds?.has(zone.casterId)) return;

            const dx = zone.object.position.x - position.x;
            const dz = zone.object.position.z - position.z;
            if (Math.hypot(dx, dz) > zone.radius) return;

            strongest = zone.slowPercent;
        });

        return strongest;
    }

    removeZone(zoneId: string) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;

        zone.dispose();
        this.zones.delete(zoneId);
    }

    update(delta: number) {
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            if (this.bursts[i].update(delta)) continue;
            this.bursts[i].dispose();
            this.bursts.splice(i, 1);
        }

        for (let i = this.telegraphs.length - 1; i >= 0; i--) {
            if (this.telegraphs[i].update(delta)) continue;
            this.telegraphs[i].dispose();
            this.telegraphs.splice(i, 1);
        }

        for (let i = this.chains.length - 1; i >= 0; i--) {
            if (this.chains[i].update(delta)) continue;
            this.chains[i].dispose();
            this.chains.splice(i, 1);
        }

        for (let i = this.embers.length - 1; i >= 0; i--) {
            if (this.embers[i].update(delta)) continue;
            this.embers[i].dispose();
            this.embers.splice(i, 1);
        }

        this.zones.forEach((zone) => zone.update(delta));
    }

    clear() {
        this.bursts.forEach((b) => b.dispose());
        this.bursts.length = 0;

        this.telegraphs.forEach((t) => t.dispose());
        this.telegraphs.length = 0;

        this.chains.forEach((c) => c.dispose());
        this.chains.length = 0;

        this.embers.forEach((e) => e.dispose());
        this.embers.length = 0;

        this.zones.forEach((z) => z.dispose());
        this.zones.clear();
    }

    dispose() {
        this.clear();
        this.root.removeFromParent();
        this.scene = null;
    }
}
