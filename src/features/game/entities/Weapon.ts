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
    private frameCount: number = 0;

    create(playerMesh: THREE.Group, resourceManager: ResourceManager) {
        console.log("🔫 [Weapon] === CREATE START ===");
        console.log(`🔫 [Weapon] Weapon mesh position before: (${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z})`);
        
        const data = resourceManager.getModel("rifle");
        if (data) {
            console.log("   ✅ Rifle model data found");
            const rifle = data.scene;
            
            rifle.position.set(0.25, 1.35, -0.4);
            rifle.rotation.set(0, Math.PI, 0);
            
            console.log(`   - Rifle position: (${rifle.position.x}, ${rifle.position.y}, ${rifle.position.z})`);
            console.log(`   - Rifle rotation: (${rifle.rotation.x}, ${rifle.rotation.y}, ${rifle.rotation.z})`);
            
            this.mesh.add(rifle);
            console.log("   ✅ Rifle added to weapon mesh");
        } else {
            console.warn("   ❌ Rifle model not found!");
        }

        this.muzzle.position.set(0, 0, -0.8);
        this.mesh.add(this.muzzle);
        console.log(`   🎯 Muzzle position set: (${this.muzzle.position.x}, ${this.muzzle.position.y}, ${this.muzzle.position.z})`);

        playerMesh.add(this.mesh);
        console.log("   ✅ Weapon mesh attached to player mesh");
        console.log(`   - Player children count: ${playerMesh.children.length}`);
        console.log("🔫 [Weapon] === CREATE END ===");
    }

    canShoot(): boolean {
        const canShoot = this.cooldown <= 0 && this.ammo > 0;
        if (this.frameCount % 60 === 0) {
            console.log(`🔫 [Weapon] canShoot: ${canShoot} (cooldown: ${this.cooldown.toFixed(2)}, ammo: ${this.ammo})`);
        }
        return canShoot;
    }

    shoot(): boolean {
        if (!this.canShoot()) return false;
        
        this.cooldown = this.fireRate;
        this.ammo--;
        
        if (this.frameCount % 10 === 0) {
            console.log(`🔫 [Weapon] SHOOT! Ammo: ${this.ammo}/${this.maxAmmo}, Cooldown: ${this.cooldown}s`);
        }
        
        return true;
    }

    reload() {
        if (this.ammo === this.maxAmmo || this.reserveAmmo === 0) {
            console.log(`⚠️ [Weapon] Cannot reload (ammo: ${this.ammo}/${this.maxAmmo}, reserve: ${this.reserveAmmo})`);
            return;
        }
        
        const needed = this.maxAmmo - this.ammo;
        const toLoad = Math.min(needed, this.reserveAmmo);
        this.ammo += toLoad;
        this.reserveAmmo -= toLoad;
        
        console.log(`🔄 [Weapon] RELOAD! +${toLoad} ammo (${this.ammo}/${this.maxAmmo}, reserve: ${this.reserveAmmo})`);
    }

    update(delta: number) {
        this.frameCount++;
        
        if (this.cooldown > 0) {
            this.cooldown -= delta;
            if (this.cooldown < 0) this.cooldown = 0;
        }
         
        if (this.frameCount % 120 === 0) {
            const worldPos = this.mesh.getWorldPosition(new THREE.Vector3());
            const muzzleWorldPos = this.muzzle.getWorldPosition(new THREE.Vector3());
            console.log(`🔫 [Weapon] World position: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
            console.log(`   - Muzzle world position: (${muzzleWorldPos.x.toFixed(2)}, ${muzzleWorldPos.y.toFixed(2)}, ${muzzleWorldPos.z.toFixed(2)})`);
        }
    }

    getWorldMuzzle(): THREE.Vector3 {
        return this.muzzle.getWorldPosition(new THREE.Vector3());
    }
}