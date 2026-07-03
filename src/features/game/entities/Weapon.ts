//src\features\game\entities\Weapon.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

export class Weapon {
    public mesh: THREE.Group = new THREE.Group();
    public muzzle: THREE.Object3D = new THREE.Object3D();
    private cooldown: number = 0;
    public fireRate: number = 0.12;
    public ammo: number = 30;
    public maxAmmo: number = 30;
    public reserveAmmo: number = 90;

    create(playerMesh: THREE.Group, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("rifle");
        if (data) {
            const rifle = data.scene;
            rifle.position.set(0.25, 1.35, -0.4);
            rifle.rotation.set(0, Math.PI, 0);
            this.mesh.add(rifle);
        }

        this.muzzle.position.set(0, 0, -0.8);
        this.mesh.add(this.muzzle);

        playerMesh.add(this.mesh);
    }

    canShoot(): boolean {
        return this.cooldown <= 0 && this.ammo > 0;
    }

    shoot(): boolean {
        if (!this.canShoot()) return false;
        this.cooldown = this.fireRate;
        this.ammo--;
        return true;
    }

    reload() {
        if (this.ammo === this.maxAmmo || this.reserveAmmo === 0) return;
        const needed = this.maxAmmo - this.ammo;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammo += toLoad;
        this.reserveAmmo -= toLoad;
    }

    update(delta: number) {
        if (this.cooldown > 0) this.cooldown -= delta;
    }

    getWorldMuzzle(): THREE.Vector3 {
        return this.muzzle.getWorldPosition(new THREE.Vector3());
    }
}