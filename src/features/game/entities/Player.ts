// src/features/game/entities/Player.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { CameraController } from "../core/CameraController";
import { Weapon } from "./Weapon";
import { CollisionGrid } from "../world/CollisionGrid";
import { HeightProvider, FlightZone, WaterProvider } from "../world/Location";
import { CharacterAnimator } from "./CharacterAnimator";
import { scaleAndCenterModel, alignModelToGround, findBoneFirst, findBoneLast, findHandBone, MODEL_FORWARD_OFFSET, reparentPreservingWorldScale } from "./characterModel";
import { SoundManager, SoundHandle, FootstepSurface } from "../core/SoundManager";
import { CosmeticRig } from "./CosmeticRig";
import { CosmeticId } from "../data/cosmetics";
import { findPaintableMesh, clonePaintableMaterial, applySkinTextureUrl } from "./characterPaint";
import { EnergyWisp } from "./EnergyWisp";
import { SpawnShield } from "./spawnShield";

export type PlayerState = 'idle' | 'walk' | 'sprint' | 'jump';

export class Player extends Entity {
    private speed: number = 7;
    private speedMultiplier: number = 1;
    private sprintMultiplier: number = 1.6;
    private weapon: Weapon;
    private time: number = 0;

    private velocityY: number = 0;
    private isGrounded: boolean = true;
    private jumpCooldown: number = 0;

    private baseY: number = 0;
    private visualY: number = 0;
    private lastFootstepPhase: number = -1;
    private static readonly FOOTSTEP_PHASES = [0.08, 0.58];
    private readonly STEP_SMOOTH_RATE = 15;
    private readonly STEP_SMOOTH_SNAP = 1.3;

    private readonly GRAVITY = 22;
    private readonly JUMP_FORCE = 8.5;
    private readonly JUMP_COOLDOWN_TIME = 0.15;

    private inputManager!: InputManager;
    private camera!: CameraController;
    private terrain: HeightProvider | null = null;
    private collisionGrid: CollisionGrid | null = null;
    private waterProvider: WaterProvider | null = null;
    private swimming: boolean = false;
    public footstepSurface: FootstepSurface = "soft";
    private static readonly SWIM_SUBMERSION = 0.85;
    private static readonly SWIM_SPEED_MULTIPLIER = 0.52;
    private static readonly MAX_COLLISION_STEP = 0.18;
    private static readonly MAX_COLLISION_SUBSTEPS = 12;

    private maxRadius: number | null = null;
    private bounds: { min: THREE.Vector3; max: THREE.Vector3 } | null = null;

    private animator = new CharacterAnimator();

    private head: THREE.Object3D | null = null;
    private neck: THREE.Object3D | null = null;
    private rightHand: THREE.Object3D | null = null;
    private hips: THREE.Object3D | null = null;
    private weaponEquipped: boolean = true;

    private isShooting: boolean = false;
    private readonly SHOOTING_SPEED_MULTIPLIER = 0.5;

    private dead: boolean = false;
    private paintableMaterial: THREE.Material | null = null;
    private cosmeticRig: CosmeticRig | null = null;
    private heartbeat: SoundHandle | null = null;
    private shieldActive = false;
    private shield: SpawnShield | null = null;
    private posedAnimation: string | null = null;
    private movementLocked: boolean = false;

    private flightMode: boolean = false;
    private selfHidden: boolean = false;
    private flightVelocity = new THREE.Vector3();
    private flightZone: FlightZone | null = null;
    private characterModel: THREE.Object3D | null = null;
    private wisp: EnergyWisp | null = null;
    private readonly FLIGHT_LANDING_BAND = 25;
    private readonly FLIGHT_SPEED = 42;
    private readonly FLIGHT_BOOST = 2.1;
    private readonly FLIGHT_ACCEL = 5.5;
    private readonly FLIGHT_DAMPING = 2.6;

    private static readonly _moveDir = new THREE.Vector3();
    private static readonly _flightForward = new THREE.Vector3();
    private static readonly _flightRight = new THREE.Vector3();
    private static readonly _flightWish = new THREE.Vector3();
    private static readonly _step = new THREE.Vector3();
    private static readonly _checkPos = new THREE.Vector3();
    private static readonly _surfacePos = new THREE.Vector3();
    private static readonly _UP = new THREE.Vector3(0, 1, 0);
    private static readonly _playerBox = new THREE.Box3();
    private static readonly _playerSize = new THREE.Vector3(0.8, 2, 0.8);

    private static readonly HALF_HEIGHT = Player._playerSize.y * 0.5;

    public health: number = 100;
    public maxHealth: number = 100;

    private memeSpeedMultiplier: number = 1;
    private memeJumpMultiplier: number = 1;
    private memeYawOffset: number = 0;
    private controlSpeedMultiplier: number = 1;
    private controlUntil: number = 0;
    private zoneSpeedMultiplier: number = 1;
    private controlImmuneUntil: number = 0;

    public setMemeMovement(options: { speedMult?: number; jumpMult?: number; yawOffset?: number }) {
        if (options.speedMult !== undefined) this.memeSpeedMultiplier = Math.max(0.1, options.speedMult);
        if (options.jumpMult !== undefined) this.memeJumpMultiplier = Math.max(0.1, options.jumpMult);
        if (options.yawOffset !== undefined) this.memeYawOffset = options.yawOffset;
    }

    public clearMemeMovement() {
        this.memeSpeedMultiplier = 1;
        this.memeJumpMultiplier = 1;
        this.memeYawOffset = 0;
    }

    public applySlow(slowPercent: number, durationMs: number) {
        if (this.isControlImmune()) return;
        this.controlSpeedMultiplier = Math.max(0.1, 1 - slowPercent / 100);
        this.controlUntil = performance.now() + durationMs;
    }

    public setZoneSlow(slowPercent: number) {
        this.zoneSpeedMultiplier = this.isControlImmune() ? 1 : Math.max(0.1, 1 - slowPercent / 100);
    }

    public setControlImmuneUntil(timestamp: number) {
        this.controlImmuneUntil = timestamp;
    }

    public clearSlow() {
        this.controlSpeedMultiplier = 1;
        this.controlUntil = 0;
        this.zoneSpeedMultiplier = 1;
    }

    private isControlImmune(): boolean {
        return performance.now() < this.controlImmuneUntil;
    }

    private slowMultiplier(): number {
        if (this.controlUntil > 0 && performance.now() >= this.controlUntil) {
            this.controlSpeedMultiplier = 1;
            this.controlUntil = 0;
        }
        return Math.min(this.controlSpeedMultiplier, this.zoneSpeedMultiplier);
    }

    public launchUpward(height: number) {
        this.velocityY = Math.sqrt(2 * this.GRAVITY * Math.max(0, height));
        this.isGrounded = false;
    }

    public applyHorizontalImpulse(direction: THREE.Vector3, distance: number) {
        const flat = Math.hypot(direction.x, direction.z);
        if (flat < 1e-4 || distance <= 0) return;

        const steps = 8;
        const dx = (direction.x / flat) * (distance / steps);
        const dz = (direction.z / flat) * (distance / steps);
        const trapped = this.collidesAt(this.mesh.position.x, this.mesh.position.z);

        for (let i = 0; i < steps; i++) {
            const nextX = this.mesh.position.x + dx;
            const nextZ = this.mesh.position.z + dz;
            if (!this.canMoveTo(nextX, nextZ, trapped)) break;

            this.mesh.position.x = nextX;
            this.mesh.position.z = nextZ;
        }

        if (this.isGrounded) this.baseY = this.getSurfaceHeight(this.mesh.position.x, this.mesh.position.z, true);
    }

    public applyCombatStats(stats: { maxHealth: number; moveSpeedMult: number; magSize: number; reloadMs: number }) {
        this.maxHealth = stats.maxHealth;
        this.speedMultiplier = Math.max(0.5, stats.moveSpeedMult);
        this.weapon.maxAmmo = stats.magSize;
        this.weapon.reloadTime = stats.reloadMs / 1000;
        if (this.weapon.ammo > this.weapon.maxAmmo) this.weapon.ammo = this.weapon.maxAmmo;
    }

    constructor() {
        super("local-player");
        this.weapon = new Weapon();
    }

    public setMaxRadius(radius: number | null) {
        this.maxRadius = radius;
    }

    public setFlightZone(zone: FlightZone | null) {
        this.flightZone = zone;
        if (!zone && this.flightMode) this.setFlightMode(false);
    }

    private setFlightMode(enabled: boolean) {
        if (this.flightMode === enabled) return;

        this.flightMode = enabled;
        this.flightVelocity.set(0, 0, 0);

        if (enabled) {
            this.velocityY = 0;
            this.isGrounded = false;
            this.baseY = this.mesh.position.y;
        } else {
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
            this.baseY = this.mesh.position.y;
            this.isGrounded = false;
        }

        if (this.characterModel) this.characterModel.visible = !enabled && !this.selfHidden;
        this.wisp?.setActive(enabled);
    }

    public isFlying(): boolean {
        return this.flightMode;
    }

    // First person keeps the mesh around because it drives movement and the
    // camera rig, but the body must not fill the view.
    public setSelfHidden(hidden: boolean) {
        this.selfHidden = hidden;
        if (this.characterModel) this.characterModel.visible = !hidden && !this.flightMode;
    }

    public moveEffectsToScene(scene: THREE.Scene) {
        this.wisp?.moveTrailToScene(scene);
    }

    private horizontalDistanceToZone(): number {
        if (!this.flightZone) return 0;
        return Math.hypot(
            this.mesh.position.x - this.flightZone.center.x,
            this.mesh.position.z - this.flightZone.center.z
        );
    }

    public setMovementBounds(min: THREE.Vector3 | null, max: THREE.Vector3 | null) {
        if (min && max) {
            this.bounds = { min, max };
        } else {
            this.bounds = null;
        }
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("player");
        if (!data) {
            throw new Error("Player model not found. Cannot initialize game.");
        }

        scaleAndCenterModel(data.scene, 1.8, 0);

        this.mesh.add(data.scene);
        this.characterModel = data.scene;

        data.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.castShadow = true;
        });

        this.wisp = new EnergyWisp({ withTrail: true, withLight: true });
        this.wisp.attach(this.mesh, scene);

        const paintableMesh = findPaintableMesh(data.scene);
        this.paintableMaterial = paintableMesh ? clonePaintableMaterial(paintableMesh) : null;
        this.cosmeticRig = new CosmeticRig(data.scene, this.paintableMaterial);

        this.rightHand = findHandBone(data.scene, "right");
        this.hips = findBoneFirst(data.scene, (name) =>
            name === 'hips' || name === 'pelvis' || name.includes('hips')
        );
        this.head = findBoneLast(data.scene, (name) => name.includes('head') && !name.endsWith('_end'));
        this.neck = findBoneLast(data.scene, (name) => !name.includes('head') && name.includes('neck') && !name.endsWith('_end'));

        this.animator.setup(data.scene, data.animations);
        this.animator.play('idle', this.weaponEquipped);
        this.animator.update(0.25);
        alignModelToGround(data.scene);

        this.weapon.create(this.mesh, resourceManager);

        if (this.rightHand) {
            reparentPreservingWorldScale(this.weapon.mesh, this.rightHand);
        }

        this.mesh.position.set(0, 0, 0);
        this.baseY = 0;
        scene.add(this.mesh);
    }

    setDependencies(inputManager: InputManager, camera: CameraController) {
        this.inputManager = inputManager;
        this.camera = camera;
    }

    setTerrain(terrain: HeightProvider | null) {
        this.terrain = terrain;
        if (this.terrain) {
            this.baseY = this.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z, this.mesh.position.y);
            this.mesh.position.y = this.baseY;
        } else {
            this.baseY = this.mesh.position.y;
        }
    }

    setCollisionGrid(grid: CollisionGrid) {
        this.collisionGrid = grid;
    }

    setWeaponVisible(visible: boolean) {
        this.weapon.mesh.visible = visible;
        this.weaponEquipped = visible;
    }

    setInvulnerableVisual(active: boolean) {
        if (!this.shield) {
            if (!active) return;
            this.shield = new SpawnShield();
            this.mesh.add(this.shield.group);
        }
        if (active !== this.shieldActive) {
            this.shieldActive = active;
            SoundManager.getInstance().play(active ? "shield-up" : "shield-break", { volume: 0.45 });
        }
        this.shield.setActive(active);
    }

    private updateHeartbeat() {
        const critical = !this.dead && this.health > 0 && this.health <= this.maxHealth * 0.25;
        if (critical === !!this.heartbeat) return;

        if (critical) {
            this.heartbeat = SoundManager.getInstance().playLoop("heartbeat-loop", { volume: 0.35 });
        } else {
            this.heartbeat?.stop(0.4);
            this.heartbeat = null;
        }
    }

    applyCosmetics(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        this.cosmeticRig?.apply(skinId, accessoryId);
    }

    getCosmeticRig(): CosmeticRig | null {
        return this.cosmeticRig;
    }

    applySkinTexture(url: string | null) {
        applySkinTextureUrl(this.paintableMaterial, url);
    }

    public setDead(dead: boolean) {
        const changed = this.dead !== dead;
        this.dead = dead;
        if (dead) {
            this.animator.play('death', this.weaponEquipped);
            if (changed) SoundManager.getInstance().play("player-death", { volume: 0.6 });
        } else if (changed) {
            SoundManager.getInstance().play("respawn", { volume: 0.5 });
        }
    }

    public isDead(): boolean {
        return this.dead;
    }

    public setHealth(health: number) {
        this.health = Math.max(0, Math.min(this.maxHealth, health));
    }

    public takeDamage(damage: number) {
        this.health = Math.max(0, this.health - damage);
    }

    public teleportTo(position: THREE.Vector3) {
        this.mesh.position.copy(position);
        this.flightVelocity.set(0, 0, 0);
        this.velocityY = 0;
        this.isGrounded = true;
        this.jumpCooldown = 0;

        this.baseY = this.terrain
            ? this.terrain.getHeightAt(position.x, position.z, position.y)
            : position.y;

        this.mesh.position.y = this.baseY;
        this.visualY = this.baseY;
    }

    private collidesAt(x: number, z: number): boolean {
        if (!this.collisionGrid) return false;

        const centerY = this.baseY + Player.HALF_HEIGHT;
        return this.collisionGrid.checkCollisionHorizontal(
            Player._checkPos.set(x, centerY, z),
            Player._playerSize
        );
    }

    private outOfBounds(x: number, z: number): boolean {
        if (this.maxRadius !== null && x * x + z * z > this.maxRadius * this.maxRadius) return true;

        if (this.bounds) {
            if (x < this.bounds.min.x || x > this.bounds.max.x) return true;
            if (z < this.bounds.min.z || z > this.bounds.max.z) return true;
        }

        return false;
    }

    private canMoveTo(x: number, z: number, trapped: boolean): boolean {
        if (this.outOfBounds(x, z)) return false;
        return trapped || !this.collidesAt(x, z);
    }

    private updateFootstepSound() {
        const phase = this.animator.getPhase();
        if (phase < 0) return;

        const previous = this.lastFootstepPhase;
        this.lastFootstepPhase = phase;
        if (previous < 0) return;

        const wrapped = phase < previous;
        const crossed = Player.FOOTSTEP_PHASES.some((mark) =>
            wrapped ? previous < mark || mark <= phase : previous < mark && mark <= phase
        );

        if (!crossed) return;

        if (this.swimming) {
            SoundManager.getInstance().play("swim", { volume: 0.35, rate: 0.9 + Math.random() * 0.2 });
        } else {
            SoundManager.getInstance().playFootstep(this.footstepSurface);
        }
    }

    private smoothVerticalY(targetY: number, delta: number): number {
        const diff = targetY - this.visualY;

        if (!this.isGrounded || Math.abs(diff) > this.STEP_SMOOTH_SNAP) {
            this.visualY = targetY;
        } else {
            this.visualY += diff * Math.min(1, delta * this.STEP_SMOOTH_RATE);
        }

        return this.visualY;
    }

    private getSurfaceHeight(
        x: number,
        z: number,
        allowStepUp: boolean = false,
        sweepUp: number = 0
    ): number {
        const terrainHeight = this.terrain?.getHeightAt(x, z, this.baseY) || 0;
        let platformHeight = -Infinity;

        const waterLevel = this.waterProvider?.(x, z) ?? null;
        const swimHeight = waterLevel !== null ? waterLevel - Player.SWIM_SUBMERSION : -Infinity;

        if (this.collisionGrid) {
            const centerY = this.baseY + Player.HALF_HEIGHT;
            const reach = allowStepUp ? CollisionGrid.STEP_UP_HEIGHT : sweepUp;
            const platformCheck = this.collisionGrid.checkPlatformBelow(
                Player._surfacePos.set(x, centerY, z),
                Player._playerSize.y,
                2.5,
                reach
            );

            if (platformCheck.found) {
                platformHeight = platformCheck.platformY;
            }
        }

        const surface = Math.max(terrainHeight, platformHeight, swimHeight);
        this.swimming = swimHeight > -Infinity && surface === swimHeight && swimHeight > terrainHeight;
        return surface;
    }

    public isSwimming(): boolean {
        return this.swimming;
    }

    setWaterProvider(provider: WaterProvider | null) {
        this.waterProvider = provider;
    }

    public playPose(name: string | null) {
        this.posedAnimation = name;
        if (name) {
            this.animator.play(name, false);
        }
    }

    public setMovementLocked(locked: boolean) {
        this.movementLocked = locked;
    }

    public hasMovementInput(): boolean {
        if (!this.inputManager) return false;
        return this.inputManager.isKeyPressed("KeyW")
            || this.inputManager.isKeyPressed("KeyA")
            || this.inputManager.isKeyPressed("KeyS")
            || this.inputManager.isKeyPressed("KeyD")
            || this.inputManager.isKeyPressed("Space");
    }

    update(delta: number, isInteracting: boolean = false) {
        this.shield?.update(delta, this.mesh.rotation.y);
        this.updateHeartbeat();
        this.cosmeticRig?.update(delta);

        if (!this.inputManager || !this.camera) return;

        if (this.dead) {
            this.animator.update(delta);
            return;
        }

        if (this.movementLocked) {
            if (this.posedAnimation) this.animator.play(this.posedAnimation, false);
            this.animator.update(delta);
            this.mesh.position.y = this.baseY;
            return;
        }

        if (this.flightMode) {
            this.updateFlight(delta);
            this.checkLanding();
            return;
        }

        this.time += delta;
        if (this.jumpCooldown > 0) this.jumpCooldown -= delta;

        const moveDir = Player._moveDir.set(0, 0, 0);
        if (this.inputManager.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager.isKeyPressed("KeyD")) moveDir.x += 1;

        const isSprinting = this.inputManager.isKeyPressed("ShiftLeft") || this.inputManager.isKeyPressed("ShiftRight");
        this.isShooting = this.inputManager.isMousePressed(0);
        const isFiringSlowdown = this.isShooting && this.weaponEquipped;
        const shouldFaceLookDirection = this.isShooting || isInteracting;
        const scaledSpeed = this.speed * this.speedMultiplier * this.memeSpeedMultiplier * this.slowMultiplier();
        const baseSpeed = isFiringSlowdown
            ? scaledSpeed * this.SHOOTING_SPEED_MULTIPLIER
            : scaledSpeed * (isSprinting ? this.sprintMultiplier : 1);
        const currentSpeed = this.swimming ? baseSpeed * Player.SWIM_SPEED_MULTIPLIER : baseSpeed;

        let moved = false;

        if (this.inputManager.isKeyJustPressed("Space") && this.isGrounded && !this.swimming && this.jumpCooldown <= 0) {
            this.velocityY = this.JUMP_FORCE * this.memeJumpMultiplier;
            this.isGrounded = false;
            this.jumpCooldown = this.JUMP_COOLDOWN_TIME;
            SoundManager.getInstance().play("jump", { volume: 0.4 });
        }

        if (!this.isGrounded) {
            const previousY = this.baseY;
            this.velocityY -= this.GRAVITY * delta;
            this.baseY += this.velocityY * delta;

            const surfaceHeight = this.getSurfaceHeight(
                this.mesh.position.x,
                this.mesh.position.z,
                false,
                Math.max(0, previousY - this.baseY)
            );

            if (this.baseY <= surfaceHeight) {
                const impact = Math.abs(this.velocityY);
                this.baseY = surfaceHeight;
                this.velocityY = 0;
                this.isGrounded = true;

                if (impact > 2.5) {
                    const landing = this.swimming ? "splash" : impact > 7 ? "land-heavy" : "land";
                    SoundManager.getInstance().play(landing, {
                        volume: Math.min(0.8, 0.25 + impact * 0.045),
                    });
                }
            }
        } else {
            const surfaceHeight = this.getSurfaceHeight(this.mesh.position.x, this.mesh.position.z, true);

            if (this.baseY > surfaceHeight + 0.1) {
                this.isGrounded = false;
            } else {
                this.baseY = surfaceHeight;
            }
        }

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(Player._UP, this.camera.getYaw());
            const facesCamera = this.isShooting || this.selfHidden;
            const targetAngle = facesCamera ? this.getCameraLookAngle() : Math.atan2(moveDir.x, moveDir.z);
            this.rotateToAngle(targetAngle, delta);

            const step = Player._step.copy(moveDir).multiplyScalar(currentSpeed * delta);
            const fromX = this.mesh.position.x;
            const fromZ = this.mesh.position.z;
            const targetX = fromX + step.x;
            const targetZ = fromZ + step.z;
            const trapped = this.collidesAt(fromX, fromZ);

            let nextX = fromX;
            let nextZ = fromZ;

            const stepLength = Math.hypot(step.x, step.z);
            const reach = Math.min(stepLength, Player.MAX_COLLISION_STEP * Player.MAX_COLLISION_SUBSTEPS);
            const substeps = Math.max(1, Math.ceil(reach / Player.MAX_COLLISION_STEP));
            const shrink = stepLength > 0 ? reach / stepLength : 1;
            const stepX = (step.x * shrink) / substeps;
            const stepZ = (step.z * shrink) / substeps;

            for (let i = 0; i < substeps; i++) {
                const tryX = nextX + stepX;
                const tryZ = nextZ + stepZ;

                if (this.canMoveTo(tryX, tryZ, trapped)) {
                    nextX = tryX;
                    nextZ = tryZ;
                    continue;
                }

                let slid = false;
                if (stepX !== 0 && this.canMoveTo(tryX, nextZ, trapped)) {
                    nextX = tryX;
                    slid = true;
                }
                if (stepZ !== 0 && this.canMoveTo(nextX, tryZ, trapped)) {
                    nextZ = tryZ;
                    slid = true;
                }
                if (!slid) break;
            }

            if (nextX !== fromX || nextZ !== fromZ) {
                this.mesh.position.x = nextX;
                this.mesh.position.z = nextZ;

                if (this.isGrounded) {
                    const surfaceHeight = this.getSurfaceHeight(nextX, nextZ, true);

                    const STEP_UP_HEIGHT = CollisionGrid.STEP_UP_HEIGHT;
                    const heightDiff = surfaceHeight - this.baseY;

                    if (heightDiff > 0 && heightDiff <= STEP_UP_HEIGHT) {
                        this.baseY = surfaceHeight;
                    } else if (heightDiff < -0.5) {
                        this.isGrounded = false;
                        this.velocityY = 0;
                    } else {
                        this.baseY = surfaceHeight;
                    }
                }

                moved = true;
            }
        } else if (shouldFaceLookDirection) {
            const targetAngle = this.getCameraLookAngle();
            this.rotateToAngle(targetAngle, delta);
        }

        const isFiring = this.isShooting && this.weaponEquipped;

        if (this.posedAnimation) {
            this.animator.play(this.posedAnimation, false);
        } else if (!this.isGrounded) {
            this.animator.play('jump', this.weaponEquipped);
        } else if (moved) {
            const moveKey = isSprinting && !this.isShooting ? 'run' : 'walk';
            this.animator.play(isFiring ? `${moveKey}-firing` : moveKey, this.weaponEquipped);
        } else {
            this.animator.play(isFiring ? 'idle-firing' : 'idle', this.weaponEquipped);
        }

        let bobOffset = 0;
        if (this.isGrounded) {
            if (moved) {
                const bobFreq = isSprinting ? 14 : 10;
                const bobAmp = isSprinting ? 0.045 : 0.03;
                const sinValue = Math.sin(this.time * bobFreq);
                bobOffset = Math.abs(sinValue) * bobAmp;

                this.updateFootstepSound();
            } else {
                bobOffset = Math.sin(this.time * 2) * 0.02;
                this.lastFootstepPhase = -1;
            }
        }

        this.mesh.position.y = this.smoothVerticalY(this.baseY + bobOffset, delta);

        this.checkTakeoff();
        this.updateHeadRotation();

        if (this.hips) {
            this.hips.rotation.x = 0;
            this.hips.rotation.z = 0;
            this.hips.position.x = 0;
            this.hips.position.z = 0;
        }

        this.animator.update(delta);
    }

    private checkTakeoff() {
        if (!this.flightZone || this.flightMode) return;
        if (this.horizontalDistanceToZone() > this.flightZone.radius) {
            this.setFlightMode(true);
        }
    }

    private checkLanding() {
        if (!this.flightZone || !this.flightMode) return;
        const zone = this.flightZone;
        if (this.horizontalDistanceToZone() > zone.radius - 1.5) return;
        if (this.mesh.position.y > zone.surfaceY + this.FLIGHT_LANDING_BAND) return;
        if (this.mesh.position.y < zone.surfaceY - this.FLIGHT_LANDING_BAND) return;

        this.setFlightMode(false);
        this.velocityY = Math.min(0, this.flightVelocity.y);
    }

    private updateFlight(delta: number) {
        this.time += delta;

        const yaw = this.camera.getYaw();
        const pitch = this.camera.getPitch();
        const cosPitch = Math.cos(pitch);

        const forward = Player._flightForward.set(
            -cosPitch * Math.sin(yaw),
            Math.sin(pitch),
            -cosPitch * Math.cos(yaw)
        );
        const right = Player._flightRight.set(Math.cos(yaw), 0, -Math.sin(yaw));

        const wish = Player._flightWish.set(0, 0, 0);
        if (this.inputManager.isKeyPressed("KeyW")) wish.add(forward);
        if (this.inputManager.isKeyPressed("KeyS")) wish.sub(forward);
        if (this.inputManager.isKeyPressed("KeyD")) wish.add(right);
        if (this.inputManager.isKeyPressed("KeyA")) wish.sub(right);
        if (this.inputManager.isKeyPressed("Space")) wish.y += 1;
        if (this.inputManager.isKeyPressed("ControlLeft")) wish.y -= 1;

        const boosting = this.inputManager.isKeyPressed("ShiftLeft") || this.inputManager.isKeyPressed("ShiftRight");
        const targetSpeed = this.FLIGHT_SPEED * (boosting ? this.FLIGHT_BOOST : 1);

        if (wish.lengthSq() > 0) {
            wish.normalize().multiplyScalar(targetSpeed);
            this.flightVelocity.lerp(wish, Math.min(1, this.FLIGHT_ACCEL * delta));
        } else {
            this.flightVelocity.multiplyScalar(Math.max(0, 1 - this.FLIGHT_DAMPING * delta));
        }

        this.mesh.position.addScaledVector(this.flightVelocity, delta);
        this.applyFlightBounds();
        this.baseY = this.mesh.position.y;

        const horizontalSpeed = Math.hypot(this.flightVelocity.x, this.flightVelocity.z);
        if (horizontalSpeed > 0.6) {
            this.rotateToAngle(Math.atan2(this.flightVelocity.x, this.flightVelocity.z), delta);
        }

        const targetTilt = THREE.MathUtils.clamp(horizontalSpeed / (this.FLIGHT_SPEED * this.FLIGHT_BOOST), 0, 1) * 0.5;
        this.mesh.rotation.x += (targetTilt - this.mesh.rotation.x) * Math.min(1, 4 * delta);

        this.wisp?.update(
            delta,
            this.flightVelocity.length() / (this.FLIGHT_SPEED * this.FLIGHT_BOOST),
            boosting,
            this.flightVelocity
        );

        this.animator.play('idle', this.weaponEquipped);
        this.animator.update(delta);
    }

    private applyFlightBounds() {
        if (!this.flightZone) return;
        const { maxRadius, minY, maxY } = this.flightZone;
        const pos = this.mesh.position;

        const dist = Math.hypot(pos.x, pos.z);
        if (dist > maxRadius) {
            const scale = maxRadius / dist;
            pos.x *= scale;
            pos.z *= scale;
            this.flightVelocity.x *= 0.2;
            this.flightVelocity.z *= 0.2;
        }

        if (pos.y > maxY) {
            pos.y = maxY;
            this.flightVelocity.y = Math.min(0, this.flightVelocity.y);
        } else if (pos.y < minY) {
            pos.y = minY;
            this.flightVelocity.y = Math.max(0, this.flightVelocity.y);
        }
    }

    private getCameraLookAngle(): number {
        const camYaw = this.camera.getYaw();
        return Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
    }

    private rotateToAngle(angle: number, delta: number) {
        const targetAngle = angle + this.memeYawOffset;
        let angleDiff = targetAngle - this.mesh.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnSpeed = 10;
        this.mesh.rotation.y += angleDiff * Math.min(1, turnSpeed * delta);
    }

    public getState(): PlayerState {
        if (this.flightMode) {
            const speed = this.flightVelocity.length();
            if (speed > this.FLIGHT_SPEED * 1.2) return 'sprint';
            return speed > 1 ? 'walk' : 'idle';
        }

        const isMoving =
            !!this.inputManager?.isKeyPressed("KeyW") ||
            !!this.inputManager?.isKeyPressed("KeyS") ||
            !!this.inputManager?.isKeyPressed("KeyA") ||
            !!this.inputManager?.isKeyPressed("KeyD");
        const isSprinting = this.inputManager?.isKeyPressed("ShiftLeft") || this.inputManager?.isKeyPressed("ShiftRight");

        if (!this.isGrounded) return 'jump';
        if (isMoving) {
            return isSprinting && !this.isShooting ? 'sprint' : 'walk';
        }
        return 'idle';
    }

    public isJumping(): boolean {
        return !this.flightMode && !this.isGrounded;
    }

    public getVelocityY(): number {
        return this.velocityY;
    }

    public getIsShooting(): boolean {
        return this.isShooting;
    }

    private updateHeadRotation() {
        if (!this.head) return;

        let headYaw = this.camera.getYaw() - this.mesh.rotation.y + MODEL_FORWARD_OFFSET;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;

        const maxHeadYaw = Math.PI * 0.5;
        const clampedYaw = Math.max(-maxHeadYaw, Math.min(maxHeadYaw, headYaw));

        this.head.rotation.y += (clampedYaw - this.head.rotation.y) * 0.3;

        const targetPitchX = -this.camera.getPitch();
        const maxPitchX = Math.PI * 0.4;
        const clampedPitchX = Math.max(-maxPitchX, Math.min(maxPitchX, targetPitchX));

        if (this.neck) {
            this.neck.rotation.x += (clampedPitchX * 0.6 - this.neck.rotation.x) * 0.3;
        }
        this.head.rotation.x += (clampedPitchX - this.head.rotation.x) * 0.3;
    }

    getWeapon(): Weapon {
        return this.weapon;
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }
}
