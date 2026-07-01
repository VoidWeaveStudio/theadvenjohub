// src/features/game/BulletPool.ts
import * as THREE from "three";
import { WEAPON_CONFIG } from "./config/gameConfig";

interface Bullet {
    line: THREE.Line;
    active: boolean;
    lifeTime: number;
    maxLife: number;
}

export class BulletPool {
    private pool: Bullet[] = [];
    private scene: THREE.Scene;
    private poolSize: number;
    private geometry: THREE.BufferGeometry;
    private material: THREE.LineBasicMaterial;

    constructor(scene: THREE.Scene, poolSize: number = WEAPON_CONFIG.bulletPoolSize) {
        this.scene = scene;
        this.poolSize = poolSize;
        
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < poolSize; i++) {
            const line = new THREE.Line(this.geometry.clone(), this.material.clone());
            line.visible = false;
            scene.add(line);
            
            this.pool.push({
                line,
                active: false,
                lifeTime: 0,
                maxLife: WEAPON_CONFIG.bulletLifetime
            });
        }
    }

    fire(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }) {
        const bullet = this.pool.find(b => !b.active);
        if (!bullet) {
            console.warn("Bullet pool exhausted");
            return;
        }

        const startDistance = 1.0;
        const trailLength = WEAPON_CONFIG.bulletTrailLength;

        const startPoint = new THREE.Vector3(
            origin.x + direction.x * startDistance,
            origin.y + direction.y * startDistance,
            origin.z + direction.z * startDistance
        );

        const endPoint = new THREE.Vector3(
            origin.x + direction.x * (startDistance + trailLength),
            origin.y + direction.y * (startDistance + trailLength),
            origin.z + direction.z * (startDistance + trailLength)
        );

        const positions = new Float32Array([
            startPoint.x, startPoint.y, startPoint.z,
            endPoint.x, endPoint.y, endPoint.z
        ]);
        bullet.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        bullet.line.geometry.attributes.position.needsUpdate = true;

        bullet.line.visible = true;
        bullet.active = true;
        bullet.lifeTime = 0;
    }

    update(deltaTime: number) {
        for (const bullet of this.pool) {
            if (!bullet.active) continue;

            bullet.lifeTime += deltaTime;
            
            const progress = bullet.lifeTime / bullet.maxLife;
            if (bullet.line.material instanceof THREE.LineBasicMaterial) {
                bullet.line.material.opacity = 0.8 * (1 - progress);
            }

            if (bullet.lifeTime >= bullet.maxLife) {
                bullet.line.visible = false;
                bullet.active = false;
            }
        }
    }

    dispose() {
        for (const bullet of this.pool) {
            this.scene.remove(bullet.line);
            bullet.line.geometry.dispose();
            if (bullet.line.material instanceof THREE.Material) {
                bullet.line.material.dispose();
            }
        }
        this.geometry.dispose();
        this.material.dispose();
        this.pool = [];
    }
}