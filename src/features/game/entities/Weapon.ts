// src/features/game/entities/Weapon.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";
import { buildStaff, disposeStaff, STAFF_FOREGRIP_OFFSET, STAFF_GRIP_POINT_OFFSET, STAFF_MUZZLE_OFFSET } from "./Staff";
import {
    accentForTier,
    buildWeaponTierAttachments,
    disposeWeaponTierAttachments,
    updateWeaponTierAttachments,
    WeaponKind,
} from "./weaponTiers";

export const RIFLE_GRIP_QUATERNION = new THREE.Quaternion(
    -0.5570306081450372,
    0.5570306081450374,
    0.43556503715239797,
    -0.43556503715239797
);

export const RIFLE_GRIP_OFFSET = new THREE.Vector3(-0.09299880266052234, 0.8357661666701275, 0.4848819943996206);

export const STAFF_GRIP_OFFSET = RIFLE_GRIP_OFFSET.clone();

const RIFLE_MUZZLE_OFFSET = new THREE.Vector3(0, -0.4, 0.03);
const RIFLE_FOREGRIP_OFFSET = new THREE.Vector3(0, -0.15, 0);
const RIFLE_GRIP_POINT_OFFSET = new THREE.Vector3(0, 0.1, 0);

export function mountRifleModel(rifle: THREE.Group): THREE.Group {
    const box = new THREE.Box3().setFromObject(rifle);
    const size = box.getSize(new THREE.Vector3());

    const targetLength = 0.9;
    const maxDim = Math.max(size.x, size.y, size.z);
    rifle.scale.setScalar(targetLength / maxDim);

    const scaledBox = new THREE.Box3().setFromObject(rifle);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    rifle.position.copy(scaledCenter).multiplyScalar(-1);
    rifle.quaternion.copy(RIFLE_GRIP_QUATERNION);

    return rifle;
}

export function buildWeaponVisual(
    kind: WeaponKind,
    tier: number,
    resourceManager: ResourceManager
): THREE.Group | null {
    const group = new THREE.Group();

    if (kind === "staff") {
        group.add(buildStaff(accentForTier(tier)));
    } else {
        const data = resourceManager.getModel("rifle");
        if (!data) return null;
        group.add(mountRifleModel(data.scene));
    }

    group.add(buildWeaponTierAttachments(kind, tier));
    return group;
}

export function weaponGripOffset(kind: WeaponKind): THREE.Vector3 {
    return kind === "staff" ? STAFF_GRIP_OFFSET : RIFLE_GRIP_OFFSET;
}

export class Weapon {
    public mesh: THREE.Group = new THREE.Group();
    public muzzle: THREE.Object3D = new THREE.Object3D();
    public foregrip: THREE.Object3D = new THREE.Object3D();
    public gripPoint: THREE.Object3D = new THREE.Object3D();

    private cooldown: number = 0;
    public fireRate: number = 0.12;
    public ammo: number = 30;
    public maxAmmo: number = 30;

    public reloadTime: number = 2.0;
    private reloadCooldown: number = 0;
    public isReloading: boolean = false;

    public kind: WeaponKind = "rifle";
    public tier: number = 1;

    private resourceManager: ResourceManager | null = null;
    private visual: THREE.Group | null = null;
    private elapsed = 0;

    create(playerMesh: THREE.Group, resourceManager: ResourceManager) {
        this.resourceManager = resourceManager;

        this.mesh.add(this.muzzle);
        this.mesh.add(this.foregrip);
        this.mesh.add(this.gripPoint);

        this.rebuildVisual();
        playerMesh.add(this.mesh);
    }

    setLoadout(kind: WeaponKind, tier: number) {
        if (this.kind === kind && this.tier === tier) return;

        this.kind = kind;
        this.tier = tier;
        this.rebuildVisual();
    }

    private rebuildVisual() {
        if (!this.resourceManager) return;

        if (this.visual) {
            this.disposeVisual();
        }

        const visual = buildWeaponVisual(this.kind, this.tier, this.resourceManager);
        if (!visual) {
            if (this.kind === "rifle") throw new Error("Rifle model not found. Cannot initialize weapon.");
            return;
        }

        this.visual = visual;
        this.mesh.add(visual);
        this.mesh.position.copy(weaponGripOffset(this.kind));

        const isStaff = this.kind === "staff";
        this.muzzle.position.copy(isStaff ? STAFF_MUZZLE_OFFSET : RIFLE_MUZZLE_OFFSET);
        this.foregrip.position.copy(isStaff ? STAFF_FOREGRIP_OFFSET : RIFLE_FOREGRIP_OFFSET);
        this.gripPoint.position.copy(isStaff ? STAFF_GRIP_POINT_OFFSET : RIFLE_GRIP_POINT_OFFSET);
    }

    private disposeVisual() {
        if (!this.visual) return;

        for (const child of [...this.visual.children]) {
            if (child.name === "weapon-tier") disposeWeaponTierAttachments(child as THREE.Group);
            else if (child.name === "staff") disposeStaff(child as THREE.Group);
            else child.removeFromParent();
        }

        this.visual.removeFromParent();
        this.visual = null;
    }

    setGripTransform(offset: THREE.Vector3, euler: THREE.Euler) {
        this.mesh.position.copy(offset);
        if (this.visual) this.visual.rotation.copy(euler);
    }

    setFireRate(seconds: number) {
        this.fireRate = Math.max(0.02, seconds);
    }

    canShoot(): boolean {
        if (this.isReloading || this.cooldown > 0) return false;
        return this.kind === "staff" || this.ammo > 0;
    }

    shoot(): boolean {
        if (!this.canShoot()) return false;

        this.cooldown = this.fireRate;
        if (this.kind !== "staff") this.ammo--;

        return true;
    }

    reload() {
        if (this.kind === "staff") return;
        if (this.isReloading || this.ammo === this.maxAmmo) return;

        this.isReloading = true;
        this.reloadCooldown = this.reloadTime;
    }

    update(delta: number) {
        this.elapsed += delta;

        if (this.cooldown > 0) {
            this.cooldown -= delta;
            if (this.cooldown < 0) this.cooldown = 0;
        }

        if (this.isReloading) {
            this.reloadCooldown -= delta;
            if (this.reloadCooldown <= 0) {
                this.ammo = this.maxAmmo;
                this.isReloading = false;
                this.reloadCooldown = 0;
            }
        }

        if (this.visual) updateWeaponTierAttachments(this.visual, this.elapsed, delta);
    }

    getReloadProgress(): number {
        if (!this.isReloading || this.reloadTime <= 0) return 0;
        return Math.min(1, Math.max(0, 1 - this.reloadCooldown / this.reloadTime));
    }

    getWorldMuzzle(): THREE.Vector3 {
        return this.muzzle.getWorldPosition(new THREE.Vector3());
    }

    getForegripWorldPosition(): THREE.Vector3 {
        return this.foregrip.getWorldPosition(new THREE.Vector3());
    }

    getGripWorldPosition(): THREE.Vector3 {
        return this.gripPoint.getWorldPosition(new THREE.Vector3());
    }
}
