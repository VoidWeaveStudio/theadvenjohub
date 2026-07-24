// src/features/game/systems/ShootingSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { CameraController } from "../core/CameraController";
import { ResourceManager } from "../core/ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { OtherPlayer } from "../entities/OtherPlayer";
import { Location } from "../world/Location";
import { CollisionGrid } from "../world/CollisionGrid";

interface Bullet {
    group: THREE.Group;
    mesh: THREE.Mesh;
    trail: THREE.Line;
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

interface ShootData {
    origin: number[];
    direction: number[];
}

interface HitData {
    target: string | null;
    point: number[];
}

interface NetworkShootData {
    id: string;
    origin: number[];
    direction: number[];
}

export class ShootingSystem extends System {
    public onHitPlayer?: () => void;

    private scene!: THREE.Scene;
    private player!: Player;
    private inputManager!: InputManager;
    private camera!: CameraController;
    private resourceManager!: ResourceManager;
    private network!: NetworkManager;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private bullets: Bullet[] = [];
    private otherPlayerHitboxes: Map<string, THREE.Mesh> = new Map();
    private enemyHitboxes: Map<string, THREE.Mesh> = new Map();
    private otherPlayersRef: Map<string, OtherPlayer> | null = null;
    private location: Location | null = null;
    private collisionGrid: CollisionGrid | null = null;

    private readonly TRAIL_LENGTH = 1.5;
    private readonly BULLET_SPEED = 200;

    private readonly MAX_PARTICLES = 100;
    private particlePool: Particle[] = [];
    private particleGeometry: THREE.SphereGeometry | null = null;
    private particleMaterial: THREE.MeshBasicMaterial | null = null;

    private impactPool: THREE.Mesh[] = [];
    private readonly MAX_IMPACTS = 20;

    private muzzleLight: THREE.PointLight | null = null;
    private muzzleLightTimeout: ReturnType<typeof setTimeout> | null = null;

    private warmupBullet: THREE.Group | null = null;
    private warmupTrail: THREE.Line | null = null;

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

    init(
        scene: THREE.Scene,
        player: Player,
        inputManager: InputManager,
        camera: CameraController,
        resourceManager: ResourceManager,
        network: NetworkManager,
        otherPlayersRef?: Map<string, OtherPlayer>,
        location?: Location,
        collisionGrid?: CollisionGrid
    ) {
        this.scene = scene;
        this.player = player;
        this.inputManager = inputManager;
        this.camera = camera;
        this.resourceManager = resourceManager;
        this.network = network;
        this.otherPlayersRef = otherPlayersRef || null;
        this.location = location || null;
        this.collisionGrid = collisionGrid || null;

        this.initParticlePool();
        this.initImpactPool();

        this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
        this.scene.add(this.muzzleLight);
    }

    public prewarm() {
        const data = this.resourceManager.getModel("bullet");
        if (data) {
            this.warmupBullet = data.scene;
            this.warmupBullet.position.set(0, -500, 0);
            this.scene.add(this.warmupBullet);
        }

        const trailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const trailMat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.8,
            linewidth: 2,
        });
        this.warmupTrail = new THREE.Line(trailGeo, trailMat);
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
            this.warmupTrail.geometry.dispose();
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
            b.trail.geometry.dispose();
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

    setLocation(location: Location | null, collisionGrid: CollisionGrid | null) {
        this.location = location;
        this.collisionGrid = collisionGrid;
    }

    registerOtherPlayer(id: string, hitbox: THREE.Mesh) {
        this.otherPlayerHitboxes.set(id, hitbox);
    }

    unregisterOtherPlayer(id: string) {
        this.otherPlayerHitboxes.delete(id);
    }

    registerEnemyHitbox(id: string, hitbox: THREE.Mesh) {
        this.enemyHitboxes.set(id, hitbox);
    }

    unregisterEnemyHitbox(id: string) {
        this.enemyHitboxes.delete(id);
    }

    update(delta: number) {
        if (this.inputManager.isMousePressed(0)) {
            const weapon = this.player.getWeapon();
            if (weapon.canShoot()) {
                if (weapon.shoot()) {
                    this.localShoot();
                }
            }
        }

        if (this.inputManager.isKeyJustPressed("KeyR")) {
            this.player.getWeapon().reload();
        }

        this.updateBullets(delta);
        this.updateParticles(delta);
        this.player.getWeapon().update(delta);
    }

    private updateParticles(delta: number) {
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

    private localShoot() {
        const cameraPos = this.camera.camera.getWorldPosition(new THREE.Vector3());
        const cameraDir = this.camera.getForwardDirection();

        this.raycaster.set(cameraPos, cameraDir);
        this.raycaster.far = 300;

        let hitPoint: THREE.Vector3 | null = null;
        let targetId: string | null = null;
        let targetType: 'player' | 'enemy' | null = null;
        let minDistance = Infinity;

        this.otherPlayerHitboxes.forEach((hitbox, id) => {
            const op = this.otherPlayersRef?.get(id);
            if (op && !op.isDead() && !op.isHidden()) {
                const box = new THREE.Box3().setFromObject(hitbox);
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                    const dist = cameraPos.distanceTo(intersectPoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        hitPoint = intersectPoint.clone();
                        targetId = id;
                        targetType = 'player';
                    }
                }
            }
        });

        this.enemyHitboxes.forEach((hitbox, id) => {
            const box = new THREE.Box3().setFromObject(hitbox);
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                const dist = cameraPos.distanceTo(intersectPoint);
                if (dist < minDistance) {
                    minDistance = dist;
                    hitPoint = intersectPoint.clone();
                    targetId = id;
                    targetType = 'enemy';
                }
            }
        });

        if (this.collisionGrid) {
            const endPoint = cameraPos.clone().add(cameraDir.clone().multiplyScalar(300));
            const center = cameraPos.clone().add(endPoint).multiplyScalar(0.5);
            const size = new THREE.Vector3(300, 50, 300);

            const candidates = this.collisionGrid.query(center, size);
            for (const box of candidates) {
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                    const dist = cameraPos.distanceTo(intersectPoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        hitPoint = intersectPoint.clone();
                        targetId = null;
                        targetType = null;
                    }
                }
            }
        } else if (this.location) {
            for (const box of this.location.colliders) {
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                    const dist = cameraPos.distanceTo(intersectPoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        hitPoint = intersectPoint.clone();
                        targetId = null;
                        targetType = null;
                    }
                }
            }
        }

        const weapon = this.player.getWeapon();
        const muzzlePos = weapon.getWorldMuzzle();

        const finalHitPoint = hitPoint
            ? hitPoint
            : cameraPos.clone().add(cameraDir.clone().multiplyScalar(300));

        const bulletDir = finalHitPoint.clone().sub(muzzlePos).normalize();

        this.network.sendShoot({
            origin: muzzlePos.toArray(),
            direction: bulletDir.toArray(),
        });

        this.spawnBullet(muzzlePos, bulletDir, finalHitPoint);
        this.muzzleFlash(muzzlePos);

        if (hitPoint) {
            if (targetType === 'player') {
                this.spawnBloodEffect(hitPoint);
                this.onHitPlayer?.();
                this.network.sendHit({
                    target: targetId,
                    point: hitPoint.toArray(),
                });
            } else if (targetType === 'enemy') {
                this.spawnBloodEffect(hitPoint);
                this.network.sendEnemyHit({
                    target: targetId!,
                    point: hitPoint.toArray(),
                });
            } else {
                this.spawnImpactEffect(hitPoint);
                this.network.sendHit({
                    target: null,
                    point: hitPoint.toArray(),
                });
            }
        }
    }

    private spawnBullet(origin: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3) {
        const data = this.resourceManager.getModel("bullet");
        if (!data) {
            console.warn("Bullet model not found.");
            return;
        }

        const bulletGroup = data.scene;
        const bulletMesh = bulletGroup.children[0] as THREE.Mesh;
        bulletGroup.position.copy(origin);
        this.scene.add(bulletGroup);

        const trailGeo = new THREE.BufferGeometry().setFromPoints([
            origin.clone(),
            origin.clone(),
        ]);
        const trailMat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        const trail = new THREE.Line(trailGeo, trailMat);
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

    private muzzleFlash(origin: THREE.Vector3) {
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

    private spawnBloodEffect(point: THREE.Vector3) {
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

    private spawnImpactEffect(point: THREE.Vector3) {
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

    private updateBullets(delta: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            const step = b.velocity.clone().multiplyScalar(delta);
            b.group.position.add(step);
            b.life -= delta;

            const head = b.group.position.clone();
            const tail = head.clone().sub(b.direction.clone().multiplyScalar(this.TRAIL_LENGTH));

            const positions = b.trail.geometry.attributes.position as THREE.BufferAttribute;
            if (positions) {
                positions.setXYZ(0, head.x, head.y, head.z);
                positions.setXYZ(1, tail.x, tail.y, tail.z);
                positions.needsUpdate = true;
            }

            const lifeRatio = b.life / b.maxLife;
            const trailMat = b.trail.material as THREE.LineBasicMaterial;
            if (lifeRatio < 0.3) {
                trailMat.opacity = 0.8 * (lifeRatio / 0.3);
            }

            if (b.life <= 0) {
                this.scene.remove(b.group);
                this.scene.remove(b.trail);
                b.trail.geometry.dispose();
                trailMat.dispose();
                this.bullets.splice(i, 1);
            }
        }
    }

    handleNetworkShoot(data: { origin: number[]; direction: number[] }) {
        const origin = new THREE.Vector3().fromArray(data.origin);
        const direction = new THREE.Vector3().fromArray(data.direction);
        const farPoint = origin.clone().add(direction.clone().multiplyScalar(300));
        this.spawnBullet(origin, direction, farPoint);
        this.muzzleFlash(origin);
    }

    getAmmoState() {
        const w = this.player.getWeapon();
        return {
            ammo: w.ammo,
            maxAmmo: w.maxAmmo,
            reserve: 0,
            isReloading: w.isReloading
        };
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