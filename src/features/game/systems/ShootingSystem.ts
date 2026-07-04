//src\features\game\systems\ShootingSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { CameraController } from "../core/CameraController";
import { ResourceManager } from "../core/ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { OtherPlayer } from "../entities/OtherPlayer";
import { Location } from "../world/Location";

interface Bullet {
    mesh: THREE.Mesh;
    trail: THREE.Line;
    velocity: THREE.Vector3;
    life: number;
    origin: THREE.Vector3;
    hasHit: boolean;
}

export class ShootingSystem extends System {
    private scene!: THREE.Scene;
    private player!: Player;
    private inputManager!: InputManager;
    private camera!: CameraController;
    private resourceManager!: ResourceManager;
    private network!: NetworkManager;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private bullets: Bullet[] = [];
    private otherPlayerHitboxes: Map<string, THREE.Mesh> = new Map();
    private otherPlayersRef: Map<string, OtherPlayer> | null = null;
    private location: Location | null = null;

    init(
        scene: THREE.Scene,
        player: Player,
        inputManager: InputManager,
        camera: CameraController,
        resourceManager: ResourceManager,
        network: NetworkManager,
        otherPlayersRef?: Map<string, OtherPlayer>,
        location?: Location
    ) {
        this.scene = scene;
        this.player = player;
        this.inputManager = inputManager;
        this.camera = camera;
        this.resourceManager = resourceManager;
        this.network = network;
        this.otherPlayersRef = otherPlayersRef || null;
        this.location = location || null;
    }

    registerOtherPlayer(id: string, hitbox: THREE.Mesh) {
        this.otherPlayerHitboxes.set(id, hitbox);
    }

    unregisterOtherPlayer(id: string) {
        this.otherPlayerHitboxes.delete(id);
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
        this.player.getWeapon().update(delta);
    }

    private localShoot() {
        const cameraPos = this.camera.camera.getWorldPosition(new THREE.Vector3());
        const cameraDir = this.camera.getForwardDirection();

        this.raycaster.set(cameraPos, cameraDir);
        this.raycaster.far = 300;

        let hitPoint: THREE.Vector3 | null = null;
        let targetId: string | null = null;
        let minDistance = Infinity;

        this.otherPlayerHitboxes.forEach((hitbox, id) => {
            const op = this.otherPlayersRef?.get(id);
            if (op && !op.isDead()) {
                const box = new THREE.Box3().setFromObject(hitbox);
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                    const dist = cameraPos.distanceTo(intersectPoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        hitPoint = intersectPoint.clone();
                        targetId = id;
                    }
                }
            }
        });

        if (this.location) {
            for (const box of this.location.colliders) {
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                    const dist = cameraPos.distanceTo(intersectPoint);
                    if (dist < minDistance) {
                        minDistance = dist;
                        hitPoint = intersectPoint.clone();
                        targetId = null;
                    }
                }
            }
        }

        if (!hitPoint) {
            hitPoint = cameraPos.clone().add(cameraDir.clone().multiplyScalar(300));
        }

        const weapon = this.player.getWeapon();
        const muzzlePos = weapon.getWorldMuzzle();

        const bulletDir = hitPoint.clone().sub(muzzlePos).normalize();

        this.network.sendShoot({
            origin: muzzlePos.toArray(),
            direction: bulletDir.toArray(),
        });

        this.spawnBullet(muzzlePos, bulletDir, hitPoint);
        this.muzzleFlash(muzzlePos, bulletDir);

        const isPlayerHit = targetId !== null;
        if (isPlayerHit) {
            this.spawnBloodEffect(hitPoint);
        } else {
            this.spawnImpactEffect(hitPoint);
        }

        this.network.sendHit({
            target: targetId,
            point: hitPoint.toArray(),
        });
    }

    private spawnBullet(origin: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3) {
        const data = this.resourceManager.getModel("bullet");
        if (!data) {
            throw new Error("Bullet model not found. Cannot spawn bullet.");
        }

        const bulletMesh = data.scene as unknown as THREE.Mesh;
        bulletMesh.position.copy(origin);
        this.scene.add(bulletMesh);

        const trailGeo = new THREE.BufferGeometry().setFromPoints([
            origin.clone(),
            origin.clone(),
        ]);
        const trailMat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.6
        });
        const trail = new THREE.Line(trailGeo, trailMat);
        this.scene.add(trail);

        const distanceToHit = origin.distanceTo(hitPoint);
        const speed = 120;
        const timeToHit = distanceToHit / speed;

        this.bullets.push({
            mesh: bulletMesh,
            trail,
            velocity: direction.clone().multiplyScalar(speed),
            life: timeToHit,
            origin: origin.clone(),
            hasHit: false,
        });
    }

    private muzzleFlash(origin: THREE.Vector3, direction: THREE.Vector3) {
        const flash = new THREE.PointLight(0xffaa00, 3, 8);
        flash.position.copy(origin);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 60);
    }

    private spawnBloodEffect(point: THREE.Vector3) {
        for (let i = 0; i < 5; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            particle.position.copy(point);
            this.scene.add(particle);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );

            const animate = () => {
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 0.1;
                particle.scale.multiplyScalar(0.95);
                if (particle.scale.x > 0.1) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                }
            };
            animate();
        }
    }

    private spawnImpactEffect(point: THREE.Vector3) {
        const impact = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        impact.position.copy(point);
        this.scene.add(impact);
        setTimeout(() => {
            this.scene.remove(impact);
            impact.geometry.dispose();
        }, 300);
    }

    private updateBullets(delta: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            if (b.hasHit) {
                continue;
            }

            const step = b.velocity.clone().multiplyScalar(delta);
            const nextPos = b.mesh.position.clone().add(step);

            const distanceTraveled = b.origin.distanceTo(nextPos);
            const maxDistance = b.velocity.length() * b.life;

            if (distanceTraveled >= maxDistance) {
                this.spawnImpactEffect(nextPos);

                this.scene.remove(b.mesh);
                this.scene.remove(b.trail);
                b.trail.geometry.dispose();
                this.bullets.splice(i, 1);
                continue;
            }

            b.mesh.position.copy(nextPos);

            const positions = b.trail.geometry.attributes.position as THREE.BufferAttribute;
            if (positions) {
                positions.setXYZ(0, b.origin.x, b.origin.y, b.origin.z);
                positions.setXYZ(1, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
                positions.needsUpdate = true;
            }

            b.life -= delta;

            if (b.life <= 0) {
                this.scene.remove(b.mesh);
                this.scene.remove(b.trail);
                b.trail.geometry.dispose();
                this.bullets.splice(i, 1);
            }
        }
    }

    handleNetworkShoot(data: { origin: number[]; direction: number[] }) {
        const origin = new THREE.Vector3().fromArray(data.origin);
        const direction = new THREE.Vector3().fromArray(data.direction);
        const farPoint = origin.clone().add(direction.clone().multiplyScalar(300));
        this.spawnBullet(origin, direction, farPoint);
        this.muzzleFlash(origin, direction);
    }

    getAmmoState() {
        const w = this.player.getWeapon();
        return { ammo: w.ammo, maxAmmo: w.maxAmmo, reserve: w.reserveAmmo };
    }

    dispose() {
        this.bullets.forEach((b) => {
            this.scene.remove(b.mesh);
            this.scene.remove(b.trail);
        });
        this.bullets = [];
    }
}