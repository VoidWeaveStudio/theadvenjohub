//src\features\game\entities\Weapon.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

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

    create(playerMesh: THREE.Group, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("rifle");
        if (!data) {
            throw new Error("Rifle model not found. Cannot initialize weapon.");
        }

        const rifle = data.scene;

        const box = new THREE.Box3().setFromObject(rifle);
        const size = box.getSize(new THREE.Vector3());

        const targetLength = 0.9;
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = targetLength / maxDim;
        rifle.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(rifle);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        rifle.position.sub(scaledCenter);

        rifle.position.set(0, 0, -0.2);
        rifle.rotation.set(0, 0, 0);

        this.mesh.add(rifle);

        this.muzzle.position.set(0, 0.05, -0.6);
        this.mesh.add(this.muzzle);

        this.foregrip.position.set(0, 0, -0.3);
        this.mesh.add(this.foregrip);

        this.gripPoint.position.set(0, -0.05, 0.1);
        this.mesh.add(this.gripPoint);

        playerMesh.add(this.mesh);
    }

    canShoot(): boolean {
        return !this.isReloading && this.cooldown <= 0 && this.ammo > 0;
    }

    shoot(): boolean {
        if (!this.canShoot()) return false;

        this.cooldown = this.fireRate;
        this.ammo--;

        return true;
    }

    reload() {
        if (this.isReloading || this.ammo === this.maxAmmo) return;

        this.isReloading = true;
        this.reloadCooldown = this.reloadTime;
    }

    update(delta: number) {
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