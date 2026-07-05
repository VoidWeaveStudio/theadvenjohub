// src/features/game/entities/Player.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { CameraController } from "../core/CameraController";
import { Weapon } from "./Weapon";
import { TerrainChunkManager } from "../world/TerrainChunkManager";
import { CollisionGrid } from "../world/CollisionGrid";

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

    private readonly GRAVITY = 22;
    private readonly JUMP_FORCE = 8.5;
    private readonly JUMP_COOLDOWN_TIME = 0.15;

    private inputManager!: InputManager;
    private camera!: CameraController;
    private terrain: TerrainChunkManager | null = null;
    private collisionGrid: CollisionGrid | null = null;

    private mixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationAction> = new Map();
    private currentAnimation: string = 'idle';

    private head: THREE.Object3D | null = null;
    private neck: THREE.Object3D | null = null;
    private rightHand: THREE.Object3D | null = null;
    private hips: THREE.Object3D | null = null;

    private isShooting: boolean = false;

    private static readonly _moveDir = new THREE.Vector3();
    private static readonly _step = new THREE.Vector3();
    private static readonly _nextPos = new THREE.Vector3();
    private static readonly _playerBox = new THREE.Box3();
    private static readonly _playerSize = new THREE.Vector3(0.8, 2, 0.8);

    private static readonly HALF_HEIGHT = Player._playerSize.y * 0.5;

    public health: number = 100;
    public maxHealth: number = 100;

    constructor() {
        super("local-player");
        this.weapon = new Weapon();
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("player");
        if (!data) {
            throw new Error("Player model not found. Cannot initialize game.");
        }

        const box = new THREE.Box3().setFromObject(data.scene);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 1.8;
        const scale = targetHeight / size.y;
        data.scene.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(data.scene);
        data.scene.position.set(
            -(scaledBox.min.x + scaledBox.max.x) / 2,
            -scaledBox.min.y,
            -(scaledBox.min.z + scaledBox.max.z) / 2
        );

        data.scene.rotation.y = Math.PI / 2;

        this.mesh.add(data.scene);

        data.scene.traverse((child: THREE.Object3D) => {
            const name = child.name.toLowerCase();

            if (!this.rightHand) {
                if (name === 'handr' ||
                    (name.includes('right') && name.includes('hand')) ||
                    name === 'r_hand' || name === 'rhand' ||
                    name.includes('righthand') || name.includes('rightarm')) {
                    this.rightHand = child;
                }
            }

            if (!this.hips) {
                if (name === 'hips' || name === 'pelvis' || name.includes('hips')) {
                    this.hips = child;
                }
            }

            if (name.includes('head')) this.head = child;
            else if (name.includes('neck')) this.neck = child;
        });

        this.mixer = new THREE.AnimationMixer(data.scene);

        if (data.animations && data.animations.length > 0) {
            const animMapping: Record<string, string> = {
                'idle': 'idle',
                'walk': 'walk',
                'run': 'run',
                'jump': 'jump'
            };

            for (const clip of data.animations) {
                for (const [key, value] of Object.entries(animMapping)) {
                    if (clip.name.toLowerCase().includes(key)) {
                        const action = this.mixer.clipAction(clip);
                        action.setEffectiveTimeScale(1);
                        action.setEffectiveWeight(1);
                        this.animations.set(value, action);
                        break;
                    }
                }
            }
        }

        this.playAnimation('idle');

        this.weapon.create(this.mesh, resourceManager);

        if (this.rightHand) {
            this.mesh.remove(this.weapon.mesh);
            this.rightHand.add(this.weapon.mesh);
        }

        this.mesh.position.set(0, 0, 0);
        this.baseY = 0;
        scene.add(this.mesh);
    }

    private playAnimation(name: string) {
        if (this.currentAnimation === name) return;

        const nextAction = this.animations.get(name);
        const currentAction = this.animations.get(this.currentAnimation);

        if (nextAction) {
            if (currentAction) {
                currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            this.currentAnimation = name;
        }
    }

    setDependencies(inputManager: InputManager, camera: CameraController) {
        this.inputManager = inputManager;
        this.camera = camera;
    }

    setTerrain(terrain: TerrainChunkManager) {
        this.terrain = terrain;
        this.baseY = terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = this.baseY;
    }

    setCollisionGrid(grid: CollisionGrid) {
        this.collisionGrid = grid;
    }

    setWeaponVisible(visible: boolean) {
        this.weapon.mesh.visible = visible;
    }

    public setHealth(health: number) {
        this.health = Math.max(0, Math.min(this.maxHealth, health));
    }

    public takeDamage(damage: number) {
        this.health = Math.max(0, this.health - damage);
    }

    private getSurfaceHeight(x: number, z: number): number {
        const terrainHeight = this.terrain?.getHeightAt(x, z) || 0;
        let platformHeight = -Infinity;

        if (this.collisionGrid) {
            const centerY = this.baseY + Player.HALF_HEIGHT;
            const platformCheck = this.collisionGrid.checkPlatformBelow(
                new THREE.Vector3(x, centerY, z),
                Player._playerSize.y,
                2.5
            );

            if (platformCheck.found) {
                platformHeight = platformCheck.platformY;
            }
        }

        return Math.max(terrainHeight, platformHeight);
    }

    update(delta: number) {
        if (!this.inputManager || !this.camera) return;

        this.time += delta;
        if (this.jumpCooldown > 0) this.jumpCooldown -= delta;

        const moveDir = Player._moveDir.set(0, 0, 0);
        if (this.inputManager.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager.isKeyPressed("KeyD")) moveDir.x += 1;

        const isSprinting = this.inputManager.isKeyPressed("ShiftLeft") || this.inputManager.isKeyPressed("ShiftRight");
        const currentSpeed = this.speed * (isSprinting ? this.sprintMultiplier : 1);

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

        this.isShooting = this.inputManager.isMousePressed(0);
        const isInteracting = this.inputManager.isKeyJustPressed("KeyE");
        const shouldFaceLookDirection = this.isShooting || isInteracting;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.getYaw());
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            this.rotateToAngle(targetAngle, delta);

            const step = Player._step.copy(moveDir).multiplyScalar(currentSpeed * delta);
            const nextPos = Player._nextPos.copy(this.mesh.position).add(step);

            let blocked = false;
            if (this.collisionGrid) {
                const centerY = this.baseY + Player.HALF_HEIGHT;
                const checkPos = new THREE.Vector3(nextPos.x, centerY, nextPos.z);
                blocked = this.collisionGrid.checkCollisionHorizontal(checkPos, Player._playerSize);
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

        if (!this.isGrounded) {
            this.playAnimation('jump');
        } else if (moved) {
            this.playAnimation(isSprinting ? 'run' : 'walk');
        } else {
            this.playAnimation('idle');
        }

        let bobOffset = 0;
        if (this.isGrounded) {
            if (moved) {
                const bobFreq = isSprinting ? 14 : 10;
                const bobAmp = isSprinting ? 0.08 : 0.05;
                bobOffset = Math.abs(Math.sin(this.time * bobFreq)) * bobAmp;
            } else {
                bobOffset = Math.sin(this.time * 2) * 0.02;
            }
        }

        this.mesh.position.y = this.baseY + bobOffset;

        this.updateHeadRotation();

        if (this.hips) {
            this.hips.rotation.x = 0;
            this.hips.rotation.z = 0;
            this.hips.position.x = 0;
            this.hips.position.z = 0;
        }

        if (this.mixer) {
            this.mixer.update(delta);
        }

        this.weapon.update(delta);
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
        const moveDir = new THREE.Vector3();
        if (this.inputManager?.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager?.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager?.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager?.isKeyPressed("KeyD")) moveDir.x += 1;
        const isSprinting = this.inputManager?.isKeyPressed("ShiftLeft") || this.inputManager?.isKeyPressed("ShiftRight");

        if (!this.isGrounded) return 'jump';
        if (moveDir.lengthSq() > 0) {
            return isSprinting ? 'sprint' : 'walk';
        }
        return 'idle';
    }

    public isJumping(): boolean {
        return !this.isGrounded;
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