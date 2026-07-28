// src/features/game/systems/ShootingEffects.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

interface Bullet {
    group: THREE.Group;
    mesh: THREE.Mesh;
    trail: THREE.Mesh;
    velocity: THREE.Vector3;
    direction: THREE.Vector3;
    life: number;
    maxLife: number;
    origin: THREE.Vector3;
    hitPoint: THREE.Vector3;
}

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    active: boolean;
}

export class ShootingEffects {
    private scene!: THREE.Scene;

    private readonly TRAIL_LENGTH = 1.5;
    private readonly TRAIL_RADIUS = 0.015;
    private readonly BULLET_SPEED = 200;
    private tracerGeometry: THREE.CylinderGeometry | null = null;

    private bullets: Bullet[] = [];

    private readonly MAX_PARTICLES = 100;
    private particlePool: Particle[] = [];
    private particleGeometry: THREE.SphereGeometry | null = null;
    private particleMaterial: THREE.MeshBasicMaterial | null = null;

    private impactPool: THREE.Mesh[] = [];
    private readonly MAX_IMPACTS = 20;

    private muzzleLight: THREE.PointLight | null = null;
    private muzzleLightTimeout: ReturnType<typeof setTimeout> | null = null;

    private warmupBullet: THREE.Group | null = null;
    private warmupTrail: THREE.Mesh | null = null;

    public setScene(scene: THREE.Scene) {
        this.clearAllEffects();

        for (const p of this.particlePool) {
            if (this.scene) this.scene.remove(p.mesh);
        }
        for (const impact of this.impactPool) {
            if (this.scene) this.scene.remove(impact);
        }
        if (this.muzzleLight && this.scene) {
            this.scene.remove(this.muzzleLight);
        }

        this.scene = scene;

        if (this.muzzleLight) {
            this.scene.add(this.muzzleLight);
        }
        for (const p of this.particlePool) {
            this.scene.add(p.mesh);
        }
        for (const impact of this.impactPool) {
            this.scene.add(impact);
        }
    }

    init(scene: THREE.Scene) {
        this.scene = scene;

        this.initParticlePool();
        this.initImpactPool();

        this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
        this.scene.add(this.muzzleLight);
    }

    public prewarm(resourceManager: ResourceManager) {
        const data = resourceManager.getModel("bullet");
        if (data) {
            this.warmupBullet = data.scene;
            this.warmupBullet.position.set(0, -500, 0);
            this.scene.add(this.warmupBullet);
        }

        this.warmupTrail = this.createTracerMesh(new THREE.Vector3(0, 0, -1));
        this.warmupTrail.position.set(0, -500, 0);
        this.scene.add(this.warmupTrail);
    }

    public endPrewarm() {
        if (this.warmupBullet) {
            this.scene.remove(this.warmupBullet);
            this.warmupBullet = null;
        }
        if (this.warmupTrail) {
            this.scene.remove(this.warmupTrail);
            (this.warmupTrail.material as THREE.Material).dispose();
            this.warmupTrail = null;
        }
    }

    private initParticlePool() {
        this.particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        this.particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            const mesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
            mesh.visible = false;
            this.scene.add(mesh);

            this.particlePool.push({
                mesh,
                velocity: new THREE.Vector3(),
                life: 0,
                active: false
            });
        }
    }

    private initImpactPool() {
        const geo = new THREE.SphereGeometry(0.1, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

        for (let i = 0; i < this.MAX_IMPACTS; i++) {
            const impact = new THREE.Mesh(geo, mat);
            impact.visible = false;
            this.scene.add(impact);
            this.impactPool.push(impact);
        }
    }

    public clearAllEffects() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            if (this.scene) {
                this.scene.remove(b.group);
                this.scene.remove(b.trail);
            }
            (b.trail.material as THREE.Material).dispose();
        }
        this.bullets = [];

        for (const p of this.particlePool) {
            p.mesh.visible = false;
            p.active = false;
            p.life = 0;
        }

        for (const impact of this.impactPool) {
            impact.visible = false;
        }

        if (this.muzzleLight) {
            this.muzzleLight.intensity = 0;
        }
        if (this.muzzleLightTimeout) {
            clearTimeout(this.muzzleLightTimeout);
            this.muzzleLightTimeout = null;
        }
    }

    public updateParticles(delta: number) {
        for (const p of this.particlePool) {
            if (!p.active) continue;

            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.velocity.y -= 9.8 * delta;
            p.life -= delta * 2;

            const scale = Math.max(0, p.life);
            p.mesh.scale.setScalar(scale);

            if (p.life <= 0) {
                p.mesh.visible = false;
                p.active = false;
            }
        }
    }

    private getTracerGeometry(): THREE.CylinderGeometry {
        if (!this.tracerGeometry) {
            this.tracerGeometry = new THREE.CylinderGeometry(this.TRAIL_RADIUS, this.TRAIL_RADIUS, 1, 6, 1, true);
        }
        return this.tracerGeometry;
    }

    private createTracerMesh(direction: THREE.Vector3): THREE.Mesh {
        const material = new THREE.MeshBasicMaterial({
            color: 0xffee88,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
        });
        const mesh = new THREE.Mesh(this.getTracerGeometry(), material);
        mesh.scale.set(1, this.TRAIL_LENGTH, 1);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        return mesh;
    }

    public spawnBullet(resourceManager: ResourceManager, origin: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3) {
        const data = resourceManager.getModel("bullet");
        if (!data) {
            console.warn("Bullet model not found.");
            return;
        }

        const bulletGroup = data.scene;
        const bulletMesh = bulletGroup.children[0] as THREE.Mesh;
        bulletGroup.position.copy(origin);
        bulletGroup.lookAt(origin.clone().add(direction));
        this.scene.add(bulletGroup);

        const trail = this.createTracerMesh(direction);
        trail.position.copy(origin).addScaledVector(direction, -this.TRAIL_LENGTH / 2);
        this.scene.add(trail);

        const distanceToHit = origin.distanceTo(hitPoint);
        const timeToHit = distanceToHit / this.BULLET_SPEED;

        this.bullets.push({
            group: bulletGroup,
            mesh: bulletMesh,
            trail,
            velocity: direction.clone().multiplyScalar(this.BULLET_SPEED),
            direction: direction.clone(),
            life: timeToHit,
            maxLife: timeToHit,
            origin: origin.clone(),
            hitPoint: hitPoint.clone(),
        });
    }

    public muzzleFlash(origin: THREE.Vector3) {
        if (!this.muzzleLight) return;

        this.muzzleLight.position.copy(origin);
        this.muzzleLight.intensity = 3;

        if (this.muzzleLightTimeout) {
            clearTimeout(this.muzzleLightTimeout);
        }

        this.muzzleLightTimeout = setTimeout(() => {
            if (this.muzzleLight) {
                this.muzzleLight.intensity = 0;
            }
        }, 60);
    }

    public spawnBloodEffect(point: THREE.Vector3) {
        let spawned = 0;
        for (const p of this.particlePool) {
            if (spawned >= 5) break;
            if (p.active) continue;

            p.mesh.position.copy(point);
            p.mesh.visible = true;
            p.mesh.scale.setScalar(1);
            p.velocity.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            p.life = 1.0;
            p.active = true;
            spawned++;
        }
    }

    public spawnImpactEffect(point: THREE.Vector3) {
        for (const impact of this.impactPool) {
            if (!impact.visible) {
                impact.position.copy(point);
                impact.visible = true;

                setTimeout(() => {
                    impact.visible = false;
                }, 300);
                return;
            }
        }
    }

    public updateBullets(delta: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            const step = b.velocity.clone().multiplyScalar(delta);
            b.group.position.add(step);
            b.life -= delta;

            b.trail.position.copy(b.group.position).addScaledVector(b.direction, -this.TRAIL_LENGTH / 2);

            const lifeRatio = b.life / b.maxLife;
            const trailMat = b.trail.material as THREE.MeshBasicMaterial;
            if (lifeRatio < 0.3) {
                trailMat.opacity = 0.85 * Math.max(0, lifeRatio / 0.3);
            }

            if (b.life <= 0) {
                this.scene.remove(b.group);
                this.scene.remove(b.trail);
                trailMat.dispose();
                this.bullets.splice(i, 1);
            }
        }
    }

    dispose() {
        this.clearAllEffects();

        for (const p of this.particlePool) {
            if (this.scene) this.scene.remove(p.mesh);
        }
        this.particlePool = [];

        for (const impact of this.impactPool) {
            if (this.scene) this.scene.remove(impact);
        }
        this.impactPool = [];

        if (this.particleGeometry) {
            this.particleGeometry.dispose();
            this.particleGeometry = null;
        }
        if (this.particleMaterial) {
            this.particleMaterial.dispose();
            this.particleMaterial = null;
        }

        if (this.tracerGeometry) {
            this.tracerGeometry.dispose();
            this.tracerGeometry = null;
        }

        if (this.muzzleLightTimeout) {
            clearTimeout(this.muzzleLightTimeout);
            this.muzzleLightTimeout = null;
        }
        if (this.muzzleLight && this.scene) {
            this.scene.remove(this.muzzleLight);
            this.muzzleLight = null;
        }
    }
}
