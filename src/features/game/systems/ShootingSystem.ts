// src/features/game/systems/ShootingSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { CameraController } from "../core/CameraController";
import { ResourceManager } from "../core/ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { OtherPlayer } from "../entities/OtherPlayer";
import type { ArsenalItem } from "../data/defusalArsenal";
import { Location } from "../world/Location";
import { CollisionGrid } from "../world/CollisionGrid";
import { ShootingEffects } from "./ShootingEffects";
import { BoltProjectiles, BoltStep, BoltStepResult } from "./BoltProjectiles";
import { SoundManager } from "../core/SoundManager";
import { SINGLE_FIRE_MODE, WEAPONS } from "../data/progression";
import { modeById, SkillMode } from "../data/skills";
import { accentForTier, WeaponKind } from "../entities/weaponTiers";

interface RaycastHit {
    id: string;
    point: THREE.Vector3;
    distance: number;
}

interface BoxHit {
    point: THREE.Vector3;
    distance: number;
}

const MIN_CONVERGENCE_DISTANCE = 2;
const HITSCAN_RANGE = 300;

function isChargedMode(modeId: string | undefined): boolean {
    if (!modeId || modeId === "single") return false;
    const mode = modeById(modeId);
    return !!mode && modeNumber(mode as unknown as SkillMode, "chargeMs", 0) > 0;
}

function modeNumber(mode: SkillMode, key: string, fallback: number): number {
    const value = mode[key];
    return typeof value === "number" ? value : fallback;
}

export class ShootingSystem extends System {
    public onShotFired?: () => void;

    public onHitPlayer?: () => void;

    private weaponEquipped: boolean = true;
    private arsenalWeapon: ArsenalItem | null = null;
    private muzzleProvider: (() => THREE.Vector3 | null) | null = null;
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
    private bolts = new BoltProjectiles();

    private weaponKind: WeaponKind = "rifle";
    private weaponTier: number = 1;
    private fireMode: SkillMode = SINGLE_FIRE_MODE as unknown as SkillMode;
    private availableModes: string[] = [];
    private boltSpeed: number = WEAPONS.staff.projectileSpeed;
    private boltRange: number = WEAPONS.staff.maxRange;
    private boltCost: number = WEAPONS.staff.boltEnergyCost;
    private energy: number = 0;
    private maxEnergy: number = 100;
    private energyRegen: number = 0;

    private nextShotAt = 0;
    private charging = false;
    private chargeStart = 0;

    public setScene(scene: THREE.Scene) {
        this.effects.setScene(scene);
        this.bolts.setScene(scene);
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
        this.bolts.setScene(scene);
    }

    public prewarm() {
        this.effects.prewarm(this.resourceManager);
    }

    public endPrewarm() {
        this.effects.endPrewarm();
    }

    public clearAllEffects() {
        this.effects.clearAllEffects();
        this.bolts.clear();
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
        if (!equipped) this.resetFiringState();
    }

    registerEnemyHitbox(id: string, hitbox: THREE.Mesh) {
        this.enemyHitboxes.set(id, hitbox);
    }

    unregisterEnemyHitbox(id: string) {
        this.enemyHitboxes.delete(id);
    }

    setWeapon(kind: WeaponKind, tier: number) {
        this.weaponKind = kind;
        this.weaponTier = tier;
    }

    setBoltStats(speed: number, range: number, cost: number) {
        if (speed > 0) this.boltSpeed = speed;
        if (range > 0) this.boltRange = range;
        if (cost > 0) this.boltCost = cost;
    }

    setEnergy(energy: number) {
        this.energy = energy;
    }

    setEnergyStats(maxEnergy: number, regenPerSecond: number) {
        if (maxEnergy > 0) this.maxEnergy = maxEnergy;
        if (regenPerSecond >= 0) this.energyRegen = regenPerSecond;
    }

    private shotEnergyCost(): number {
        if (this.weaponKind !== "staff") return 0;
        return Math.round(this.boltCost * modeNumber(this.fireMode, "manaCostMult", 1));
    }

    setFireMode(modeId: string) {
        const resolved = modeId === "single" ? null : modeById(modeId);
        this.fireMode = (resolved ?? SINGLE_FIRE_MODE) as unknown as SkillMode;
        this.resetFiringState();
        this.player?.getWeapon().setFireRate(this.baseIntervalMs() / 1000);
    }

    setAvailableModes(modes: string[]) {
        this.availableModes = modes;
    }

    getFireModeId(): string {
        return this.fireMode.id;
    }

    getFireModeName(): string {
        return this.fireMode.name;
    }

    getChargeProgress(): number {
        const chargeMs = modeNumber(this.fireMode, "chargeMs", 0);
        if (!this.charging || chargeMs <= 0) return 0;
        return Math.min(1, (performance.now() - this.chargeStart) / chargeMs);
    }

    nextFireMode(): string | null {
        const cycle = ["single", ...this.availableModes];
        if (cycle.length < 2) return null;

        const index = cycle.indexOf(this.fireMode.id);
        return cycle[(index + 1) % cycle.length];
    }

    private resetFiringState() {
        this.charging = false;
    }

    private weaponConfig() {
        return this.weaponKind === "staff" ? WEAPONS.staff : WEAPONS.rifle;
    }

    // Inside Dust II the arsenal item owns the trigger: its own fire rate, and
    // only rifles keep firing while the button is held.
    setArsenalWeapon(item: ArsenalItem | null) {
        this.arsenalWeapon = item;
        this.nextShotAt = 0;
        this.player?.getWeapon().setFireRate(this.baseIntervalMs() / 1000);
    }

    // In first person the visible barrel is the view model's, not the hidden
    // third-person rig — tracers have to leave the gun the player can see.
    setMuzzleProvider(provider: (() => THREE.Vector3 | null) | null) {
        this.muzzleProvider = provider;
    }

    private baseIntervalMs(): number {
        if (this.arsenalWeapon) return this.arsenalWeapon.fireRateMs;
        return modeNumber(this.fireMode, "fireRateMs", this.weaponConfig().fireRateMs);
    }

    private intervalMs(): number {
        const base = this.baseIntervalMs();
        const chargeMs = modeNumber(this.fireMode, "chargeMs", 0);

        return chargeMs > 0 ? Math.max(base, chargeMs) : base;
    }

    update(delta: number) {
        const justPressed = this.inputManager.isMouseJustPressed(0);
        const justReleased = this.inputManager.isMouseJustReleased(0);
        const pressed = this.inputManager.isMousePressed(0);

        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * delta);

        const alive = !this.player.isDead();
        const canAct = alive && this.weaponEquipped;

        if (canAct) this.updateFiring(pressed, justPressed, justReleased);
        else this.resetFiringState();

        const weapon = this.player.getWeapon();
        const wantsReload = this.inputManager.isKeyJustPressed("KeyR")
            || (weapon.kind !== "staff" && weapon.ammo <= 0 && !weapon.isReloading);

        if (alive && wantsReload) {
            const wasReloading = weapon.isReloading;
            weapon.reload();
            if (!wasReloading && weapon.isReloading) this.network.sendReload();
        }

        this.effects.updateBullets(delta);
        this.effects.updateParticles(delta);
        this.bolts.update(delta, (step) => this.stepBolt(step));
        this.player.getWeapon().update(delta);
    }

    private updateFiring(pressed: boolean, justPressed: boolean, justReleased: boolean) {
        const now = performance.now();

        if (this.arsenalWeapon) {
            const trigger = this.arsenalWeapon.automatic ? pressed : justPressed;
            if (trigger && now >= this.nextShotAt) this.tryFire(now);
            return;
        }

        const chargeMs = modeNumber(this.fireMode, "chargeMs", 0);

        if (chargeMs > 0) {
            if (justPressed && now >= this.nextShotAt) {
                this.charging = true;
                this.chargeStart = now;
            }
            if (this.charging && (justReleased || !pressed)) {
                const held = now - this.chargeStart;
                this.charging = false;
                if (held >= chargeMs) this.tryFire(now);
            }
            return;
        }

        if (pressed && now >= this.nextShotAt) this.tryFire(now);
    }

    private tryFire(now: number): boolean {
        const cost = this.shotEnergyCost();
        if (cost > 0 && this.energy < cost) return false;

        const weapon = this.player.getWeapon();
        if (!weapon.shoot()) return false;

        this.nextShotAt = now + this.intervalMs();

        if (this.weaponKind === "staff") {
            this.energy = Math.max(0, this.energy - cost);
            this.fireStaff();
        } else {
            this.localShoot();
        }

        SoundManager.getInstance().play("shoot");
        return true;
    }

    private raycastHitboxes(
        hitboxes: Map<string, THREE.Mesh>,
        origin: THREE.Vector3,
        isValid: (id: string) => boolean,
        skip?: Set<string>
    ): RaycastHit | null {
        let best: RaycastHit | null = null;
        hitboxes.forEach((hitbox, id) => {
            if (skip?.has(id)) return;
            if (!isValid(id)) return;
            const box = new THREE.Box3().setFromObject(hitbox);
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                const dist = origin.distanceTo(intersectPoint);
                if (dist > this.raycaster.far) return;
                if (!best || dist < best.distance) {
                    best = { id, point: intersectPoint.clone(), distance: dist };
                }
            }
        });
        return best;
    }

    private raycastBoxes(boxes: THREE.Box3[], origin: THREE.Vector3): BoxHit | null {
        let best: BoxHit | null = null;
        for (const box of boxes) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
                const dist = origin.distanceTo(intersectPoint);
                if (dist > this.raycaster.far) continue;
                if (!best || dist < best.distance) {
                    best = { point: intersectPoint.clone(), distance: dist };
                }
            }
        }
        return best;
    }

    private staticBoxesAlong(origin: THREE.Vector3, direction: THREE.Vector3, range: number): THREE.Box3[] {
        if (this.collisionGrid) {
            const endPoint = origin.clone().add(direction.clone().multiplyScalar(range));
            const center = origin.clone().add(endPoint).multiplyScalar(0.5);
            const size = new THREE.Vector3(range, 50, range);
            return this.collisionGrid.query(center, size);
        }
        if (this.location) return this.location.colliders;
        return [];
    }

    private isLivingOtherPlayer = (id: string): boolean => {
        const op = this.otherPlayersRef?.get(id);
        return !!op && !op.isDead() && !op.isHidden();
    };

    private aimPointAlongView(cameraPos: THREE.Vector3, cameraDir: THREE.Vector3, range: number): THREE.Vector3 {
        this.raycaster.set(cameraPos, cameraDir);
        this.raycaster.far = range;

        let bestDistance = Infinity;
        let bestPoint: THREE.Vector3 | null = null;

        const playerHit = this.raycastHitboxes(this.otherPlayerHitboxes, cameraPos, this.isLivingOtherPlayer);
        if (playerHit && playerHit.distance < bestDistance) {
            bestDistance = playerHit.distance;
            bestPoint = playerHit.point;
        }

        const enemyHit = this.raycastHitboxes(this.enemyHitboxes, cameraPos, () => true);
        if (enemyHit && enemyHit.distance < bestDistance) {
            bestDistance = enemyHit.distance;
            bestPoint = enemyHit.point;
        }

        const staticHit = this.raycastBoxes(this.staticBoxesAlong(cameraPos, cameraDir, range), cameraPos);
        if (staticHit && staticHit.distance < bestDistance) {
            bestDistance = staticHit.distance;
            bestPoint = staticHit.point;
        }

        return bestPoint ?? cameraPos.clone().addScaledVector(cameraDir, range);
    }

    private spreadDirections(base: THREE.Vector3, count: number, spreadDegrees: number): THREE.Vector3[] {
        if (count <= 1) return [base.clone()];

        const axis = new THREE.Vector3(0, 1, 0);
        const cone = (spreadDegrees * Math.PI) / 180;
        const directions: THREE.Vector3[] = [];

        for (let i = 0; i < count; i++) {
            const offset = (i / (count - 1) - 0.5) * cone;
            directions.push(base.clone().applyAxisAngle(axis, offset).normalize());
        }

        return directions;
    }

    private fireStaff() {
        const cameraPos = this.camera.camera.getWorldPosition(new THREE.Vector3());
        const cameraDir = this.camera.getForwardDirection();
        const weapon = this.player.getWeapon();
        const muzzlePos = weapon.getWorldMuzzle();

        const count = Math.max(1, modeNumber(this.fireMode, "projectiles", 1));
        const spread = modeNumber(this.fireMode, "spreadDegrees", 0);
        const pierce = Math.max(0, modeNumber(this.fireMode, "pierceCount", 0));
        const charged = modeNumber(this.fireMode, "chargeMs", 0) > 0;
        const accent = accentForTier(this.weaponTier);

        const aimPoint = this.aimPointAlongView(cameraPos, cameraDir, this.boltRange);
        const aimDir = aimPoint.distanceTo(muzzlePos) < MIN_CONVERGENCE_DISTANCE
            ? cameraDir.clone()
            : aimPoint.clone().sub(muzzlePos).normalize();
        const directions = this.spreadDirections(aimDir, count, spread);

        this.onShotFired?.();
        this.network.sendShoot({
            origin: muzzlePos.toArray(),
            direction: directions[0].toArray(),
            directions: directions.map((d) => d.toArray()),
        });

        for (const direction of directions) {
            this.bolts.spawn({
                origin: muzzlePos,
                direction,
                speed: this.boltSpeed,
                maxRange: this.boltRange,
                pierce,
                accent,
                charged,
                local: true,
            });
        }

        this.effects.muzzleFlash(muzzlePos);
    }

    private stepBolt(step: BoltStep): BoltStepResult {
        const segment = step.to.clone().sub(step.from);
        const length = segment.length();
        if (length < 1e-6) return "continue";

        const direction = segment.divideScalar(length);
        this.raycaster.set(step.from, direction);
        this.raycaster.far = length;

        let closest: { point: THREE.Vector3; distance: number; id: string | null; kind: "player" | "enemy" | null } | null = null;

        const playerHit = this.raycastHitboxes(this.otherPlayerHitboxes, step.from, this.isLivingOtherPlayer, step.bolt.hitIds);
        if (playerHit) closest = { ...playerHit, kind: "player" };

        const enemyHit = this.raycastHitboxes(this.enemyHitboxes, step.from, () => true, step.bolt.hitIds);
        if (enemyHit && (!closest || enemyHit.distance < closest.distance)) {
            closest = { ...enemyHit, kind: "enemy" };
        }

        const staticHit = this.raycastBoxes(this.staticBoxesAlong(step.from, direction, length), step.from);
        if (staticHit && (!closest || staticHit.distance < closest.distance)) {
            this.effects.spawnImpactEffect(staticHit.point);
            if (step.bolt.local) this.network.sendHit({ target: null, point: staticHit.point.toArray() });
            return "stop";
        }

        if (!closest) return "continue";

        step.bolt.hitIds.add(closest.id!);
        this.effects.spawnBloodEffect(closest.point);

        if (step.bolt.local) {
            if (closest.kind === "player") {
                this.onHitPlayer?.();
                SoundManager.getInstance().play("hitmarker");
                this.network.sendHit({ target: closest.id, point: closest.point.toArray() });
            } else {
                this.network.sendEnemyHit({ target: closest.id!, point: closest.point.toArray() });
            }
        }

        if (step.bolt.pierceLeft > 0) {
            step.bolt.pierceLeft--;
            return "continue";
        }

        return "stop";
    }

    private localShoot() {
        const cameraPos = this.camera.camera.getWorldPosition(new THREE.Vector3());
        const cameraDir = this.camera.getForwardDirection();

        this.raycaster.set(cameraPos, cameraDir);
        this.raycaster.far = HITSCAN_RANGE;

        let hitPoint: THREE.Vector3 | null = null;
        let targetId: string | null = null;
        let targetType: "player" | "enemy" | null = null;
        let minDistance = Infinity;

        const playerHit = this.raycastHitboxes(this.otherPlayerHitboxes, cameraPos, this.isLivingOtherPlayer);
        if (playerHit && playerHit.distance < minDistance) {
            minDistance = playerHit.distance;
            hitPoint = playerHit.point;
            targetId = playerHit.id;
            targetType = "player";
        }

        const enemyHit = this.raycastHitboxes(this.enemyHitboxes, cameraPos, () => true);
        if (enemyHit && enemyHit.distance < minDistance) {
            minDistance = enemyHit.distance;
            hitPoint = enemyHit.point;
            targetId = enemyHit.id;
            targetType = "enemy";
        }

        const staticHit = this.raycastBoxes(this.staticBoxesAlong(cameraPos, cameraDir, HITSCAN_RANGE), cameraPos);
        if (staticHit && staticHit.distance < minDistance) {
            minDistance = staticHit.distance;
            hitPoint = staticHit.point;
            targetId = null;
            targetType = null;
        }

        const weapon = this.player.getWeapon();
        const viewMuzzle = this.muzzleProvider?.() ?? null;
        const shotOrigin = viewMuzzle ? cameraPos : weapon.getWorldMuzzle();

        const finalHitPoint = hitPoint
            ? hitPoint
            : cameraPos.clone().add(cameraDir.clone().multiplyScalar(HITSCAN_RANGE));

        // A muzzle further out than the impact would draw the tracer backwards.
        const visualOrigin = viewMuzzle && viewMuzzle.distanceTo(cameraPos) < finalHitPoint.distanceTo(cameraPos)
            ? viewMuzzle
            : shotOrigin;

        const bulletDir = finalHitPoint.clone().sub(shotOrigin).normalize();

        this.onShotFired?.();

        this.network.sendShoot({
            origin: shotOrigin.toArray(),
            direction: bulletDir.toArray(),
        });

        this.effects.spawnBullet(
            this.resourceManager,
            visualOrigin,
            finalHitPoint.clone().sub(visualOrigin).normalize(),
            finalHitPoint
        );
        this.effects.muzzleFlash(visualOrigin);

        if (hitPoint) {
            if (targetType === "player") {
                this.effects.spawnBloodEffect(hitPoint);
                this.onHitPlayer?.();
                SoundManager.getInstance().play("hitmarker");
                this.network.sendHit({
                    target: targetId,
                    point: hitPoint.toArray(),
                });
            } else if (targetType === "enemy") {
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

    handleNetworkShoot(data: {
        id?: string;
        origin: number[];
        direction: number[];
        directions?: number[][];
        weapon?: string;
        speed?: number;
        mode?: string;
    }) {
        const origin = new THREE.Vector3().fromArray(data.origin);

        if (data.weapon === "staff") {
            const shooterTier = data.id ? this.otherPlayersRef?.get(data.id)?.getWeaponTier() ?? 1 : 1;
            const directions = data.directions?.length ? data.directions : [data.direction];

            for (const raw of directions) {
                this.bolts.spawn({
                    origin,
                    direction: new THREE.Vector3().fromArray(raw),
                    speed: data.speed && data.speed > 0 ? data.speed : this.boltSpeed,
                    maxRange: this.boltRange,
                    pierce: 0,
                    accent: accentForTier(shooterTier),
                    charged: isChargedMode(data.mode),
                    local: false,
                });
            }
            this.effects.muzzleFlash(origin);
            return;
        }

        const direction = new THREE.Vector3().fromArray(data.direction);
        const farPoint = origin.clone().add(direction.clone().multiplyScalar(HITSCAN_RANGE));
        this.effects.spawnBullet(this.resourceManager, origin, direction, farPoint);
        this.effects.muzzleFlash(origin);
    }

    getAmmoState() {
        const w = this.player.getWeapon();
        return {
            ammo: w.ammo,
            maxAmmo: w.maxAmmo,
            reserve: 0,
            isReloading: w.isReloading,
            reloadProgress: w.getReloadProgress(),
        };
    }

    dispose() {
        this.effects.dispose();
        this.bolts.dispose();
    }
}
