//src\features\game\systems\ShootingSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { CameraController } from "../core/CameraController";
import { ResourceManager } from "../core/ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { OtherPlayer } from "../entities/OtherPlayer";

interface Bullet {
    mesh: THREE.Mesh;
    trail: THREE.Line;
    velocity: THREE.Vector3;
    life: number;
    origin: THREE.Vector3;
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
    private collidableObjects: THREE.Object3D[] = [];

    private otherPlayerHitboxes: Map<string, THREE.Mesh> = new Map();
    private otherPlayersRef: Map<string, OtherPlayer> | null = null;

    init(
        scene: THREE.Scene,
        player: Player,
        inputManager: InputManager,
        camera: CameraController,
        resourceManager: ResourceManager,
        network: NetworkManager,
        otherPlayersRef?: Map<string, OtherPlayer>
    ) {
        this.scene = scene;
        this.player = player;
        this.inputManager = inputManager;
        this.camera = camera;
        this.resourceManager = resourceManager;
        this.network = network;
        this.otherPlayersRef = otherPlayersRef || null;
    }

    registerCollidable(obj: THREE.Object3D) {
        this.collidableObjects.push(obj);
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
        const weapon = this.player.getWeapon();
        const origin = weapon.getWorldMuzzle();
        const direction = this.camera.getForwardDirection();

        this.network.sendShoot({
            origin: origin.toArray(),
            direction: direction.toArray(),
        });

        this.spawnBullet(origin, direction);
        this.doRaycast(origin, direction);
        this.muzzleFlash(origin, direction);
    }

    private spawnBullet(origin: THREE.Vector3, direction: THREE.Vector3) {
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
        const trailMat = new THREE.LineBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.6 });
        const trail = new THREE.Line(trailGeo, trailMat);
        this.scene.add(trail);

        const speed = 120;
        this.bullets.push({
            mesh: bulletMesh,
            trail,
            velocity: direction.clone().multiplyScalar(speed),
            life: 1.5,
            origin: origin.clone(),
        });
    }

    private muzzleFlash(origin: THREE.Vector3, direction: THREE.Vector3) {
        const flash = new THREE.PointLight(0xffaa00, 3, 8);
        flash.position.copy(origin);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 60);
    }

    private doRaycast(origin: THREE.Vector3, direction: THREE.Vector3) {
        this.raycaster.set(origin, direction);
        this.raycaster.far = 300;

        const targets: THREE.Object3D[] = [];

        this.otherPlayerHitboxes.forEach((hitbox, id) => {
            const op = this.otherPlayersRef?.get(id);
            if (op && !op.isDead()) {
                targets.push(hitbox);
            }
        });
        targets.push(...this.collidableObjects);

        const hits = this.raycaster.intersectObjects(targets, true);
        if (hits.length > 0) {
            const hit = hits[0];
            const targetId = this.findPlayerIdFromHitbox(hit.object);
            const isPlayerHit = targetId !== null;

            if (isPlayerHit) {
                this.spawnBloodEffect(hit.point);
            } else {
                this.spawnImpactEffect(hit.point);
            }

            this.network.sendHit({
                target: targetId,
                point: hit.point.toArray(),
            });
        }
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

    private findPlayerIdFromHitbox(obj: THREE.Object3D): string | null {
        if (obj.userData.playerId) {
            return obj.userData.playerId;
        }

        let current: THREE.Object3D | null = obj;
        while (current) {
            if (current.userData.playerId) {
                return current.userData.playerId;
            }
            current = current.parent;
        }

        return null;
    }

    private updateBullets(delta: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            const step = b.velocity.clone().multiplyScalar(delta);

            this.raycaster.set(b.mesh.position, b.velocity.clone().normalize());
            this.raycaster.far = step.length();
            const hits = this.raycaster.intersectObjects(this.collidableObjects, true);

            if (hits.length > 0) {
                this.spawnImpactEffect(hits[0].point);
                this.scene.remove(b.mesh);
                this.scene.remove(b.trail);
                b.trail.geometry.dispose();
                this.bullets.splice(i, 1);
                continue;
            }

            b.mesh.position.add(step);
            b.life -= delta;

            const positions = b.trail.geometry.attributes.position as THREE.BufferAttribute;
            if (positions) {
                positions.setXYZ(0, b.origin.x, b.origin.y, b.origin.z);
                positions.setXYZ(1, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
                positions.needsUpdate = true;
            }

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
        this.spawnBullet(origin, direction);
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