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
        
        console.log(`🔫 [Weapon] Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`🔫 [Weapon] Scaled by: ${scale.toFixed(3)} (target: ${targetLength}m)`);
        
        const scaledBox = new THREE.Box3().setFromObject(rifle);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        rifle.position.sub(scaledCenter);
        
        rifle.position.set(0.25, 1.35, -0.4);
        rifle.rotation.set(0, Math.PI, 0);
        
        this.mesh.add(rifle);

        this.muzzle.position.set(0.25, 1.35, -0.8);
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
        if (this.cooldown > 0) {
            this.cooldown -= delta;
            if (this.cooldown < 0) this.cooldown = 0;
        }
    }

    getWorldMuzzle(): THREE.Vector3 {
        return this.muzzle.getWorldPosition(new THREE.Vector3());
    }
}