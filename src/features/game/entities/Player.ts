// src/features/game/entities/Player.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { CameraController } from "../core/CameraController";
import { Weapon } from "./Weapon";
import { CollisionGrid } from "../world/CollisionGrid";
import { HeightProvider, FlightZone } from "../world/Location";
import { CharacterAnimator } from "./CharacterAnimator";
import { scaleAndCenterModel, alignModelToGround, findBoneFirst, findBoneLast, reparentPreservingWorldScale } from "./characterModel";
import { SoundManager } from "../core/SoundManager";
import { CosmeticRig } from "./CosmeticRig";
import { CosmeticId } from "../data/cosmetics";
import { findPaintableMesh, clonePaintableMaterial, applySkinTextureUrl } from "./characterPaint";
import { EnergyWisp } from "./EnergyWisp";

export type PlayerState = 'idle' | 'walk' | 'sprint' | 'jump';

export class Player extends Entity {
    private speed: number = 7;
    private sprintMultiplier: number = 1.6;
    private weapon: Weapon;
    private time: number = 0;

    private velocityY: number = 0;
    private isGrounded: boolean = true;
    private jumpCooldown: number = 0;

    private baseY: number = 0;
    private lastFootstepSign: number = 0;

    private readonly GRAVITY = 22;
    private readonly JUMP_FORCE = 8.5;
    private readonly JUMP_COOLDOWN_TIME = 0.15;

    private inputManager!: InputManager;
    private camera!: CameraController;
    private terrain: HeightProvider | null = null;
    private collisionGrid: CollisionGrid | null = null;

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
    private shield: THREE.Mesh | null = null;
    private posedAnimation: string | null = null;
    private movementLocked: boolean = false;

    private flightMode: boolean = false;
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
    private static readonly _nextPos = new THREE.Vector3();
    private static readonly _checkPos = new THREE.Vector3();
    private static readonly _surfacePos = new THREE.Vector3();
    private static readonly _UP = new THREE.Vector3(0, 1, 0);
    private static readonly _playerBox = new THREE.Box3();
    private static readonly _playerSize = new THREE.Vector3(0.8, 2, 0.8);

    private static readonly HALF_HEIGHT = Player._playerSize.y * 0.5;

    public health: number = 100;
    public maxHealth: number = 100;

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

        if (this.characterModel) this.characterModel.visible = !enabled;
        this.wisp?.setActive(enabled);
    }

    public isFlying(): boolean {
        return this.flightMode;
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

        this.rightHand = findBoneFirst(data.scene, (name) =>
            name === 'handr' || name === 'hand.r' ||
            (name.includes('right') && name.includes('hand')) ||
            name === 'r_hand' || name === 'rhand' ||
            name.includes('righthand') || name.includes('rightarm')
        );
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
        if (active && !this.shield) {
            const material = new THREE.MeshBasicMaterial({
                color: 0x6fe0ff,
                transparent: true,
                opacity: 0.22,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 16), material);
            this.shield.position.y = 0.95;
            this.shield.scale.set(1, 1.25, 1);
            this.mesh.add(this.shield);
            return;
        }
        if (!active && this.shield) {
            this.shield.removeFromParent();
            this.shield.geometry.dispose();
            (this.shield.material as THREE.Material).dispose();
            this.shield = null;
        }
    }

    applyCosmetics(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        this.cosmeticRig?.apply(skinId, accessoryId);
    }

    applySkinTexture(url: string | null) {
        applySkinTextureUrl(this.paintableMaterial, url);
    }

    public setDead(dead: boolean) {
        this.dead = dead;
        if (dead) {
            this.animator.play('death', this.weaponEquipped);
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

        if (this.terrain) {
            this.baseY = this.terrain.getHeightAt(position.x, position.z, position.y);
        }
    }

    private getSurfaceHeight(x: number, z: number): number {
        const terrainHeight = this.terrain?.getHeightAt(x, z, this.baseY) || 0;
        let platformHeight = -Infinity;

        if (this.collisionGrid) {
            const centerY = this.baseY + Player.HALF_HEIGHT;
            const platformCheck = this.collisionGrid.checkPlatformBelow(
                Player._surfacePos.set(x, centerY, z),
                Player._playerSize.y,
                2.5
            );

            if (platformCheck.found) {
                platformHeight = platformCheck.platformY;
            }
        }

        return Math.max(terrainHeight, platformHeight);
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
        const currentSpeed = isFiringSlowdown
            ? this.speed * this.SHOOTING_SPEED_MULTIPLIER
            : this.speed * (isSprinting ? this.sprintMultiplier : 1);

        let moved = false;

        if (this.inputManager.isKeyJustPressed("Space") && this.isGrounded && this.jumpCooldown <= 0) {
            this.velocityY = this.JUMP_FORCE;
            this.isGrounded = false;
            this.jumpCooldown = this.JUMP_COOLDOWN_TIME;
        }

        if (!this.isGrounded) {
            this.velocityY -= this.GRAVITY * delta;
            this.baseY += this.velocityY * delta;

            const surfaceHeight = this.getSurfaceHeight(this.mesh.position.x, this.mesh.position.z);

            if (this.baseY <= surfaceHeight) {
                this.baseY = surfaceHeight;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        } else {
            const surfaceHeight = this.getSurfaceHeight(this.mesh.position.x, this.mesh.position.z);

            if (this.baseY > surfaceHeight + 0.1) {
                this.isGrounded = false;
            } else {
                this.baseY = surfaceHeight;
            }
        }

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(Player._UP, this.camera.getYaw());
            const targetAngle = this.isShooting ? this.getCameraLookAngle() : Math.atan2(moveDir.x, moveDir.z);
            this.rotateToAngle(targetAngle, delta);

            const step = Player._step.copy(moveDir).multiplyScalar(currentSpeed * delta);
            const nextPos = Player._nextPos.copy(this.mesh.position).add(step);

            let blocked = false;
            if (this.collisionGrid) {
                const centerY = this.baseY + Player.HALF_HEIGHT;
                const checkPos = Player._checkPos.set(nextPos.x, centerY, nextPos.z);
                blocked = this.collisionGrid.checkCollisionHorizontal(checkPos, Player._playerSize);
            }

            if (!blocked) {
                if (this.maxRadius !== null) {
                    const distSq = nextPos.x * nextPos.x + nextPos.z * nextPos.z;
                    if (distSq > this.maxRadius * this.maxRadius) {
                        blocked = true;
                    }
                }

                if (!blocked && this.bounds) {
                    if (nextPos.x < this.bounds.min.x || nextPos.x > this.bounds.max.x ||
                        nextPos.z < this.bounds.min.z || nextPos.z > this.bounds.max.z) {
                        blocked = true;
                    }
                }
            }

            if (!blocked) {
                this.mesh.position.x = nextPos.x;
                this.mesh.position.z = nextPos.z;

                if (this.isGrounded) {
                    const surfaceHeight = this.getSurfaceHeight(nextPos.x, nextPos.z);

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

                const footstepSign = sinValue >= 0 ? 1 : -1;
                if (footstepSign !== this.lastFootstepSign) {
                    this.lastFootstepSign = footstepSign;
                    SoundManager.getInstance().playFootstep();
                }
            } else {
                bobOffset = Math.sin(this.time * 2) * 0.02;
                this.lastFootstepSign = 0;
            }
        }

        this.mesh.position.y = this.baseY + bobOffset;

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
        if (this.inputManager.isKeyPressed("KeyC") || this.inputManager.isKeyPressed("ControlLeft")) wish.y -= 1;

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

    private rotateToAngle(targetAngle: number, delta: number) {
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

        let headYaw = this.camera.getYaw() - this.mesh.rotation.y;
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
