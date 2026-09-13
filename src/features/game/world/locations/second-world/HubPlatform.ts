// src/features/game/world/locations/second-world/HubPlatform.ts
import * as THREE from "three";
import { GALAXY } from "../tower/floors/token-gates/galaxy/GalaxyLayout";

export const PLATFORM_CENTER = new THREE.Vector3(GALAXY.hubPosition.x, GALAXY.hubPosition.y, GALAXY.hubPosition.z);
export const PLATFORM_RADIUS = GALAXY.platformRadius;
export const PLATFORM_SURFACE_Y = PLATFORM_CENTER.y;

const DECK_THICKNESS = 2.2;
const KEEL_DEPTH = 20;
const PILLAR_COUNT = 8;
const PILLAR_HEIGHT = 6.4;
const SHARD_COUNT = 14;
const ACCENT = 0x4fd1ff;
const ACCENT_WARM = 0xd8b46a;

interface Shard {
    mesh: THREE.Mesh;
    radius: number;
    height: number;
    speed: number;
    phase: number;
    tumble: number;
}

export class HubPlatform {
    public group!: THREE.Group;
    public interactionTarget!: THREE.Object3D;

    private shards: Shard[] = [];
    private glyphRings: THREE.Mesh[] = [];
    private crystalLights: THREE.PointLight[] = [];
    private beaconMaterial!: THREE.MeshBasicMaterial;
    private beacon!: THREE.Mesh;
    private time = 0;

    constructor(private scene: THREE.Scene) { }

    create() {
        this.group = new THREE.Group();
        this.group.position.copy(PLATFORM_CENTER);

        const stone = new THREE.MeshStandardMaterial({
            color: 0x1d2430,
            roughness: 0.52,
            metalness: 0.42,
        });
        const stoneDark = new THREE.MeshStandardMaterial({
            color: 0x121722,
            roughness: 0.66,
            metalness: 0.32,
        });
        const trim = new THREE.MeshStandardMaterial({
            color: ACCENT_WARM,
            roughness: 0.28,
            metalness: 0.92,
            emissive: ACCENT_WARM,
            emissiveIntensity: 0.18,
        });

        this.buildDeck(stone, stoneDark, trim);
        this.buildKeel(stoneDark);
        this.buildPillars(stone, trim);
        this.buildPedestal(stone, trim);
        this.buildShards(stoneDark);

        this.scene.add(this.group);
    }

    private glow(color: number, opacity: number): THREE.MeshBasicMaterial {
        return new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        });
    }

    private buildDeck(stone: THREE.Material, stoneDark: THREE.Material, trim: THREE.Material) {
        const deck = new THREE.Mesh(
            new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS - 1.6, DECK_THICKNESS, 12),
            stone
        );
        deck.position.y = -DECK_THICKNESS / 2;
        deck.receiveShadow = true;
        this.group.add(deck);

        const facing = new THREE.Mesh(
            new THREE.CylinderGeometry(PLATFORM_RADIUS - 0.4, PLATFORM_RADIUS - 0.4, 0.16, 12),
            stoneDark
        );
        facing.position.y = 0.02;
        facing.receiveShadow = true;
        this.group.add(facing);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(PLATFORM_RADIUS - 0.2, 0.34, 8, 12), trim);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.1;
        this.group.add(rim);

        for (let i = 0; i < 3; i++) {
            const radius = PLATFORM_RADIUS - 4.5 - i * 6.2;
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(radius - 0.32, radius, 64),
                this.glow(ACCENT, 0.42 - i * 0.06)
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.12;
            this.group.add(ring);
            this.glyphRings.push(ring);
        }

        const spokeGeometry = new THREE.PlaneGeometry(PLATFORM_RADIUS - 5, 0.26);
        const spokeMaterial = this.glow(ACCENT, 0.3);
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
            spoke.rotation.x = -Math.PI / 2;
            spoke.rotation.z = -angle;
            spoke.position.set(
                Math.cos(angle) * (PLATFORM_RADIUS - 5) * 0.5,
                0.11,
                Math.sin(angle) * (PLATFORM_RADIUS - 5) * 0.5
            );
            this.group.add(spoke);
        }
    }

    private buildKeel(stoneDark: THREE.Material) {
        const keel = new THREE.Mesh(
            new THREE.CylinderGeometry(PLATFORM_RADIUS - 1.6, 3.2, KEEL_DEPTH, 12, 1, true),
            stoneDark
        );
        keel.position.y = -DECK_THICKNESS - KEEL_DEPTH / 2;
        this.group.add(keel);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7, 12), stoneDark);
        cap.position.y = -DECK_THICKNESS - KEEL_DEPTH - 3.5;
        cap.rotation.x = Math.PI;
        this.group.add(cap);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + 0.3;
            const length = 6 + (i % 3) * 3.5;
            const root = new THREE.Mesh(new THREE.ConeGeometry(0.9, length, 6), stoneDark);
            root.position.set(
                Math.cos(angle) * (PLATFORM_RADIUS * 0.55),
                -DECK_THICKNESS - length / 2 - 1,
                Math.sin(angle) * (PLATFORM_RADIUS * 0.55)
            );
            root.rotation.x = Math.PI;
            root.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12;
            this.group.add(root);
        }

        const underGlow = new THREE.Mesh(
            new THREE.CircleGeometry(PLATFORM_RADIUS - 2, 48),
            this.glow(ACCENT, 0.12)
        );
        underGlow.rotation.x = Math.PI / 2;
        underGlow.position.y = -DECK_THICKNESS - 0.3;
        this.group.add(underGlow);
    }

    private buildPillars(stone: THREE.Material, trim: THREE.Material) {
        const shaftGeometry = new THREE.CylinderGeometry(0.52, 0.86, PILLAR_HEIGHT, 4);
        const collarGeometry = new THREE.TorusGeometry(0.62, 0.11, 6, 12);
        const crystalGeometry = new THREE.OctahedronGeometry(0.78, 0);

        for (let i = 0; i < PILLAR_COUNT; i++) {
            const angle = (i / PILLAR_COUNT) * Math.PI * 2 + Math.PI / PILLAR_COUNT;
            const x = Math.cos(angle) * (PLATFORM_RADIUS - 3.4);
            const z = Math.sin(angle) * (PLATFORM_RADIUS - 3.4);

            const shaft = new THREE.Mesh(shaftGeometry, stone);
            shaft.position.set(x, PILLAR_HEIGHT / 2, z);
            shaft.rotation.y = angle;
            shaft.castShadow = true;
            this.group.add(shaft);

            const collar = new THREE.Mesh(collarGeometry, trim);
            collar.rotation.x = Math.PI / 2;
            collar.position.set(x, PILLAR_HEIGHT - 0.5, z);
            this.group.add(collar);

            const crystal = new THREE.Mesh(crystalGeometry, this.glow(ACCENT, 0.9));
            crystal.position.set(x, PILLAR_HEIGHT + 0.9, z);
            this.group.add(crystal);

            if (i % 2 === 0) {
                const light = new THREE.PointLight(ACCENT, 22, 34, 2);
                light.position.set(x, PILLAR_HEIGHT + 0.9, z);
                this.group.add(light);
                this.crystalLights.push(light);
            }
        }
    }

    private buildPedestal(stone: THREE.Material, trim: THREE.Material) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, 0.7, 12), stone);
        base.position.y = 0.35;
        base.receiveShadow = true;
        this.group.add(base);

        const step = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.4, 12), stone);
        step.position.y = 0.9;
        this.group.add(step);

        const inlay = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 32), this.glow(ACCENT_WARM, 0.5));
        inlay.rotation.x = -Math.PI / 2;
        inlay.position.y = 1.12;
        this.group.add(inlay);

        const collar = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.16, 8, 24), trim);
        collar.rotation.x = Math.PI / 2;
        collar.position.y = 1.1;
        this.group.add(collar);

        this.beaconMaterial = this.glow(ACCENT, 0.1);
        this.beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 4.4, 120, 20, 1, true),
            this.beaconMaterial
        );
        this.beacon.position.y = 62;
        this.group.add(this.beacon);

        const pad = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), this.glow(ACCENT, 0.16));
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0.14;
        this.group.add(pad);

        const anchor = new THREE.Object3D();
        anchor.position.y = 1.2;
        this.group.add(anchor);
        this.interactionTarget = anchor;
    }

    private buildShards(stoneDark: THREE.Material) {
        const geometry = new THREE.IcosahedronGeometry(1, 0);

        for (let i = 0; i < SHARD_COUNT; i++) {
            const scale = 0.7 + ((i * 37) % 10) / 10 * 1.9;
            const mesh = new THREE.Mesh(geometry, stoneDark);
            mesh.scale.set(scale, scale * (0.6 + ((i * 13) % 7) / 10), scale);
            mesh.castShadow = true;
            this.group.add(mesh);

            this.shards.push({
                mesh,
                radius: PLATFORM_RADIUS * (0.6 + ((i * 29) % 10) / 10 * 0.8),
                height: 3 + ((i * 17) % 10) / 10 * 12,
                speed: 0.05 + ((i * 7) % 10) / 10 * 0.08,
                phase: (i / SHARD_COUNT) * Math.PI * 2,
                tumble: 0.15 + ((i * 11) % 10) / 10 * 0.3,
            });
        }
    }

    public containsPoint(point: THREE.Vector3): boolean {
        return Math.hypot(point.x - PLATFORM_CENTER.x, point.z - PLATFORM_CENTER.z) <= PLATFORM_RADIUS;
    }

    public getHeightAt(x: number, z: number): number {
        return Math.hypot(x - PLATFORM_CENTER.x, z - PLATFORM_CENTER.z) <= PLATFORM_RADIUS
            ? PLATFORM_SURFACE_Y
            : -100000;
    }

    update(delta: number) {
        this.time += delta;

        for (const shard of this.shards) {
            const angle = this.time * shard.speed + shard.phase;
            shard.mesh.position.set(
                Math.cos(angle) * shard.radius,
                shard.height + Math.sin(this.time * 0.4 + shard.phase) * 1.2,
                Math.sin(angle) * shard.radius
            );
            shard.mesh.rotation.x += delta * shard.tumble * 0.5;
            shard.mesh.rotation.y += delta * shard.tumble;
        }

        for (let i = 0; i < this.glyphRings.length; i++) {
            const ring = this.glyphRings[i];
            ring.rotation.z += delta * (0.06 + i * 0.03) * (i % 2 === 0 ? 1 : -1);
            (ring.material as THREE.MeshBasicMaterial).opacity =
                0.34 + Math.sin(this.time * 0.8 + i) * 0.08;
        }

        const pulse = 0.9 + Math.sin(this.time * 1.3) * 0.1;
        for (const light of this.crystalLights) light.intensity = 20 * pulse;
        if (this.beaconMaterial) this.beaconMaterial.opacity = 0.08 + Math.sin(this.time * 0.7) * 0.025;
    }

    dispose() {
        if (!this.group) return;

        this.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });

        this.scene.remove(this.group);
        this.shards = [];
        this.glyphRings = [];
        this.crystalLights = [];
    }
}
