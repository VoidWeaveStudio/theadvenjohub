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
import { ShootingEffects } from "./ShootingEffects";
import { SoundManager } from "../core/SoundManager";

interface RaycastHit {
    id: string;
    point: THREE.Vector3;
    distance: number;
}

interface BoxHit {
    point: THREE.Vector3;
    distance: number;
}

export class ShootingSystem extends System {
    public onHitPlayer?: () => void;

    private weaponEquipped: boolean = true;
    private player!: Player;
    private inputManager!: InputManager;
    private camera!: CameraController;
    private resourceManager!: ResourceManager;
    private network!: NetworkManager;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private otherPlayerHitboxes: Map<string, THREE.Mesh> = new Map();
    private enemyHitboxes: Map<string, THREE.Mesh> = new Map();
    private otherPlayersRef: Map<string, OtherPlayer> | null = null;
    private location: Location | null = null;
    private collisionGrid: CollisionGrid | null = null;

    private effects = new ShootingEffects();

    public setScene(scene: THREE.Scene) {
        this.effects.setScene(scene);
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
        this.player = player;
        this.inputManager = inputManager;
        this.camera = camera;
        this.resourceManager = resourceManager;
        this.network = network;
        this.otherPlayersRef = otherPlayersRef || null;
        this.location = location || null;
        this.collisionGrid = collisionGrid || null;

        this.effects.init(scene);
    }

    public prewarm() {
        this.effects.prewarm(this.resourceManager);
    }

    public endPrewarm() {
        this.effects.endPrewarm();
    }

    public clearAllEffects() {
        this.effects.clearAllEffects();
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

    setWeaponEquipped(equipped: boolean) {
        this.weaponEquipped = equipped;
    }

    registerEnemyHitbox(id: string, hitbox: THREE.Mesh) {
        this.enemyHitboxes.set(id, hitbox);
    }

    unregisterEnemyHitbox(id: string) {
        this.enemyHitboxes.delete(id);
    }

    update(delta: number) {
        if (this.weaponEquipped && this.inputManager.isMousePressed(0)) {
            const weapon = this.player.getWeapon();
            if (weapon.canShoot()) {
                if (weapon.shoot()) {
                    this.localShoot();
                    SoundManager.getInstance().play('shoot');
                }
            }
        }

        if (this.weaponEquipped && this.inputManager.isKeyJustPressed("KeyR")) {
            this.player.getWeapon().reload();
        }

        this.effects.updateBullets(delta);
        this.effects.updateParticles(delta);
        this.player.getWeapon().update(delta);
    }

    private raycastHitboxes(
        hitboxes: Map<string, THREE.Mesh>,
        cameraPos: THREE.Vector3,
        isValid: (id: string) => boolean
    ): RaycastHit | null {
        let best: RaycastHit | null = null;
        hitboxes.forEach((hitbox, id) => {
            if (!isValid(id)) return;
            const box = new THREE.Box3().setFromObject(hitbox);
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                const dist = cameraPos.distanceTo(intersectPoint);
                if (!best || dist < best.distance) {
                    best = { id, point: intersectPoint.clone(), distance: dist };
                }
            }
        });
        return best;
    }

    private raycastBoxes(boxes: THREE.Box3[], cameraPos: THREE.Vector3): BoxHit | null {
        let best: BoxHit | null = null;
        for (const box of boxes) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                const dist = cameraPos.distanceTo(intersectPoint);
                if (!best || dist < best.distance) {
                    best = { point: intersectPoint.clone(), distance: dist };
                }
            }
        }
        return best;
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

        const playerHit = this.raycastHitboxes(this.otherPlayerHitboxes, cameraPos, (id) => {
            const op = this.otherPlayersRef?.get(id);
            return !!op && !op.isDead() && !op.isHidden();
        });
        if (playerHit && playerHit.distance < minDistance) {
            minDistance = playerHit.distance;
            hitPoint = playerHit.point;
            targetId = playerHit.id;
            targetType = 'player';
        }

        const enemyHit = this.raycastHitboxes(this.enemyHitboxes, cameraPos, () => true);
        if (enemyHit && enemyHit.distance < minDistance) {
            minDistance = enemyHit.distance;
            hitPoint = enemyHit.point;
            targetId = enemyHit.id;
            targetType = 'enemy';
        }

        let staticBoxes: THREE.Box3[];
        if (this.collisionGrid) {
            const endPoint = cameraPos.clone().add(cameraDir.clone().multiplyScalar(300));
            const center = cameraPos.clone().add(endPoint).multiplyScalar(0.5);
            const size = new THREE.Vector3(300, 50, 300);
            staticBoxes = this.collisionGrid.query(center, size);
        } else if (this.location) {
            staticBoxes = this.location.colliders;
        } else {
            staticBoxes = [];
        }

        const staticHit = this.raycastBoxes(staticBoxes, cameraPos);
        if (staticHit && staticHit.distance < minDistance) {
            minDistance = staticHit.distance;
            hitPoint = staticHit.point;
            targetId = null;
            targetType = null;
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

        this.effects.spawnBullet(this.resourceManager, muzzlePos, bulletDir, finalHitPoint);
        this.effects.muzzleFlash(muzzlePos);

        if (hitPoint) {
            if (targetType === 'player') {
                this.effects.spawnBloodEffect(hitPoint);
                this.onHitPlayer?.();
                SoundManager.getInstance().play('hitmarker');
                this.network.sendHit({
                    target: targetId,
                    point: hitPoint.toArray(),
                });
            } else if (targetType === 'enemy') {
                this.effects.spawnBloodEffect(hitPoint);
                this.network.sendEnemyHit({
                    target: targetId!,
                    point: hitPoint.toArray(),
                });
            } else {
                this.effects.spawnImpactEffect(hitPoint);
                this.network.sendHit({
                    target: null,
                    point: hitPoint.toArray(),
                });
            }
        }
    }

    handleNetworkShoot(data: { origin: number[]; direction: number[] }) {
        const origin = new THREE.Vector3().fromArray(data.origin);
        const direction = new THREE.Vector3().fromArray(data.direction);
        const farPoint = origin.clone().add(direction.clone().multiplyScalar(300));
        this.effects.spawnBullet(this.resourceManager, origin, direction, farPoint);
        this.effects.muzzleFlash(origin);
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
        this.effects.dispose();
    }
}
