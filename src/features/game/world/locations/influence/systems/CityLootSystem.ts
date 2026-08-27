// src/features/game/world/locations/influence/systems/CityLootSystem.ts
import * as THREE from "three";
import { CITY_LOOT } from "../cityLayout";

export const CITY_LOOT_PREFIX = "city-loot:";
export const CITY_LOOT_REACH = 3.4;

interface Container {
    id: string;
    tier: number;
    group: THREE.Group;
    lid: THREE.Object3D;
    glow: THREE.Mesh;
    opened: boolean;
    lidAngle: number;
    pulse: number;
}

export class CityLootSystem {
    private readonly containers = new Map<string, Container>();
    private readonly bodyMaterial: THREE.MeshStandardMaterial;
    private readonly rareMaterial: THREE.MeshStandardMaterial;
    private readonly bandMaterial: THREE.MeshStandardMaterial;
    private readonly glowMaterial: THREE.MeshBasicMaterial;
    private readonly rareGlowMaterial: THREE.MeshBasicMaterial;
    private readonly bodyGeometry: THREE.BoxGeometry;
    private readonly lidGeometry: THREE.BoxGeometry;
    private readonly bandGeometry: THREE.BoxGeometry;
    private readonly glowGeometry: THREE.PlaneGeometry;

    constructor(private readonly scene: THREE.Scene) {
        this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85, metalness: 0.08, flatShading: true });
        this.rareMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2f4a, roughness: 0.6, metalness: 0.3, flatShading: true });
        this.bandMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5f52, roughness: 0.5, metalness: 0.55, flatShading: true });
        this.glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
        this.rareGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xc78bff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });

        this.bodyGeometry = new THREE.BoxGeometry(1.5, 0.9, 1);
        this.lidGeometry = new THREE.BoxGeometry(1.56, 0.28, 1.06);
        this.bandGeometry = new THREE.BoxGeometry(1.62, 0.16, 0.14);
        this.glowGeometry = new THREE.PlaneGeometry(2.6, 2.6);
    }

    create() {
        for (const entry of CITY_LOOT) {
            const rare = entry.tier >= 2;
            const group = new THREE.Group();
            group.position.set(entry.x, 0, entry.z);
            group.rotation.y = (entry.x * 0.37 + entry.z * 0.19) % (Math.PI * 2);
            group.name = `city-loot-${entry.id}`;
            group.userData.interactionId = `${CITY_LOOT_PREFIX}${entry.id}`;
            group.userData.interactionRadius = CITY_LOOT_REACH;

            const body = new THREE.Mesh(this.bodyGeometry, rare ? this.rareMaterial : this.bodyMaterial);
            body.position.y = 0.45;
            group.add(body);

            const band = new THREE.Mesh(this.bandGeometry, this.bandMaterial);
            band.position.y = 0.62;
            group.add(band);

            const hinge = new THREE.Group();
            hinge.position.set(0, 0.9, -0.5);
            const lid = new THREE.Mesh(this.lidGeometry, rare ? this.rareMaterial : this.bodyMaterial);
            lid.position.set(0, 0.12, 0.5);
            hinge.add(lid);
            group.add(hinge);

            const glow = new THREE.Mesh(this.glowGeometry, rare ? this.rareGlowMaterial : this.glowMaterial);
            glow.rotation.x = -Math.PI / 2;
            glow.position.y = 0.06;
            glow.renderOrder = 3;
            group.add(glow);

            this.scene.add(group);
            this.containers.set(entry.id, {
                id: entry.id,
                tier: entry.tier,
                group,
                lid: hinge,
                glow,
                opened: false,
                lidAngle: 0,
                pulse: (entry.x + entry.z) * 0.1,
            });
        }
    }

    public getInteractables(): THREE.Object3D[] {
        return Array.from(this.containers.values()).map((container) => container.group);
    }

    public isOpen(id: string): boolean {
        return this.containers.get(id)?.opened === true;
    }

    public setOpened(ids: Iterable<string>) {
        const set = new Set(ids);
        for (const container of this.containers.values()) {
            container.opened = set.has(container.id);
        }
    }

    public open(id: string) {
        const container = this.containers.get(id);
        if (container) container.opened = true;
    }

    public update(delta: number, time: number) {
        for (const container of this.containers.values()) {
            const target = container.opened ? -Math.PI * 0.62 : 0;
            container.lidAngle = THREE.MathUtils.lerp(container.lidAngle, target, Math.min(1, delta * 6));
            container.lid.rotation.x = container.lidAngle;

            const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + container.pulse);
            container.glow.visible = !container.opened;
            if (!container.opened) {
                const material = container.glow.material as THREE.MeshBasicMaterial;
                material.opacity = (container.tier >= 2 ? 0.34 : 0.2) + pulse * 0.22;
                container.glow.scale.setScalar(0.86 + pulse * 0.2);
            }
        }
    }

    public dispose() {
        for (const container of this.containers.values()) {
            this.scene.remove(container.group);
        }
        this.containers.clear();

        this.bodyGeometry.dispose();
        this.lidGeometry.dispose();
        this.bandGeometry.dispose();
        this.glowGeometry.dispose();
        this.bodyMaterial.dispose();
        this.rareMaterial.dispose();
        this.bandMaterial.dispose();
        this.glowMaterial.dispose();
        this.rareGlowMaterial.dispose();
    }
}
