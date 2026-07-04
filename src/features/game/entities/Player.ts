//src\features\game\entities\Player.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { CameraController } from "../core/CameraController";
import { Weapon } from "./Weapon";
import { Terrain } from "../world/Terrain";

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
    private colliders: THREE.Box3[] = [];
    private terrain: Terrain | null = null;

    private head: THREE.Object3D | null = null;
    private neck: THREE.Object3D | null = null;
    private leftLeg: THREE.Object3D | null = null;
    private rightLeg: THREE.Object3D | null = null;
    private leftArm: THREE.Object3D | null = null;
    private rightArm: THREE.Object3D | null = null;
    private spine: THREE.Object3D | null = null;

    private static readonly _moveDir = new THREE.Vector3();
    private static readonly _step = new THREE.Vector3();
    private static readonly _nextPos = new THREE.Vector3();
    private static readonly _playerBox = new THREE.Box3();
    private static readonly _playerSize = new THREE.Vector3(0.8, 2, 0.8);

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

        this.mesh.add(data.scene);

        data.scene.traverse((child: THREE.Object3D) => {
            const name = child.name.toLowerCase();

            if (name.includes('head')) this.head = child;
            else if (name.includes('neck')) this.neck = child;
            else if (name.includes('leg') && name.includes('left')) this.leftLeg = child;
            else if (name.includes('leg') && name.includes('right')) this.rightLeg = child;
            else if (name.includes('arm') && name.includes('left')) this.leftArm = child;
            else if (name.includes('arm') && name.includes('right')) this.rightArm = child;
            else if (name.includes('spine') || name.includes('body')) this.spine = child;
        });

        this.weapon.create(this.mesh, resourceManager);

        let handBone: THREE.Object3D | undefined;
        data.scene.traverse((child: THREE.Object3D) => {
            const name = child.name.toLowerCase();
            if (name.includes('hand') && name.includes('right')) {
                handBone = child;
            }
        });

        if (handBone) {
            this.mesh.remove(this.weapon.mesh);
            (handBone as THREE.Object3D).add(this.weapon.mesh);
        }

        this.mesh.position.set(0, 0, 0);
        this.baseY = 0;
        scene.add(this.mesh);
    }

    setDependencies(inputManager: InputManager, camera: CameraController, colliders: THREE.Box3[]) {
        this.inputManager = inputManager;
        this.camera = camera;
        this.colliders = colliders;
    }

    setTerrain(terrain: Terrain) {
        this.terrain = terrain;
        const initialHeight = terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z);
        this.baseY = initialHeight;
        this.mesh.position.y = initialHeight;
    }

    public setHealth(health: number) {
        this.health = Math.max(0, Math.min(this.maxHealth, health));
    }

    public takeDamage(damage: number) {
        this.health = Math.max(0, this.health - damage);
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

            const terrainHeight = this.terrain?.getHeightAt(this.mesh.position.x, this.mesh.position.z) || 0;
            if (this.baseY <= terrainHeight) {
                this.baseY = terrainHeight;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        } else {
            const terrainHeight = this.terrain?.getHeightAt(this.mesh.position.x, this.mesh.position.z) || 0;
            this.baseY = terrainHeight;
        }

        const isShooting = this.inputManager.isMousePressed(0);
        const isInteracting = this.inputManager.isKeyJustPressed("KeyE");
        const shouldFaceLookDirection = isShooting || isInteracting;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.getYaw());
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            this.rotateToAngle(targetAngle, delta);

            const step = Player._step.copy(moveDir).multiplyScalar(currentSpeed * delta);
            const nextPos = Player._nextPos.copy(this.mesh.position).add(step);

            const nextTerrainHeight = this.terrain?.getHeightAt(nextPos.x, nextPos.z) || 0;
            const groundPos = new THREE.Vector3(nextPos.x, nextTerrainHeight + 1, nextPos.z);
            const playerBox = Player._playerBox.setFromCenterAndSize(groundPos, Player._playerSize);

            let blocked = false;
            for (let i = 0; i < this.colliders.length; i++) {
                if (this.colliders[i].intersectsBox(playerBox)) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) {
                this.mesh.position.x = nextPos.x;
                this.mesh.position.z = nextPos.z;
                moved = true;
            }
        } else if (shouldFaceLookDirection) {
            const targetAngle = this.getCameraLookAngle();
            this.rotateToAngle(targetAngle, delta);
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

        const currentState = this.getCurrentState(moved, isSprinting);
        this.updateProceduralAnimation(currentState, moved, isSprinting, delta);

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

    private getCurrentState(isMoving: boolean, isSprinting: boolean): PlayerState {
        if (!this.isGrounded) return 'jump';
        if (isMoving && isSprinting) return 'sprint';
        if (isMoving) return 'walk';
        return 'idle';
    }

    public getState(): PlayerState {
        const moveDir = new THREE.Vector3();
        if (this.inputManager?.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager?.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager?.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager?.isKeyPressed("KeyD")) moveDir.x += 1;
        const isSprinting = this.inputManager?.isKeyPressed("ShiftLeft") || this.inputManager?.isKeyPressed("ShiftRight");
        return this.getCurrentState(moveDir.lengthSq() > 0, !!isSprinting);
    }

    public isJumping(): boolean {
        return !this.isGrounded;
    }

    public getVelocityY(): number {
        return this.velocityY;
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

    private updateProceduralAnimation(state: PlayerState, isMoving: boolean, isSprinting: boolean, delta: number) {
        const walkSpeed = isSprinting ? 12 : 8;
        const walkAmplitude = isSprinting ? 0.8 : 0.5;
        const armAmplitude = isSprinting ? 0.6 : 0.4;

        if (state === 'jump') {
            const isRising = this.velocityY > 0;

            if (this.leftLeg) this.leftLeg.rotation.x = isRising ? -0.5 : 0.3;
            if (this.rightLeg) this.rightLeg.rotation.x = isRising ? -0.5 : 0.3;
            if (this.leftArm) {
                this.leftArm.rotation.x = isRising ? -0.8 : 0.2;
                this.leftArm.rotation.z = isRising ? -0.3 : 0;
            }
            if (this.rightArm) {
                this.rightArm.rotation.x = isRising ? -0.8 : 0.2;
                this.rightArm.rotation.z = isRising ? 0.3 : 0;
            }
            if (this.spine) this.spine.rotation.x = isRising ? -0.1 : 0.05;
        } else if (isMoving) {
            if (this.leftLeg) this.leftLeg.rotation.x = Math.sin(this.time * walkSpeed) * walkAmplitude;
            if (this.rightLeg) this.rightLeg.rotation.x = -Math.sin(this.time * walkSpeed) * walkAmplitude;
            if (this.leftArm) this.leftArm.rotation.x = -Math.sin(this.time * walkSpeed) * armAmplitude;
            if (this.rightArm) this.rightArm.rotation.x = Math.sin(this.time * walkSpeed) * (armAmplitude * 0.3);
            if (this.spine) this.spine.rotation.x = isSprinting ? 0.15 : 0.05;
        } else {
            const breathSpeed = 2;
            const breathAmplitude = 0.05;

            if (this.leftLeg) this.leftLeg.rotation.x = 0;
            if (this.rightLeg) this.rightLeg.rotation.x = 0;
            if (this.leftArm) this.leftArm.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude;
            if (this.rightArm) this.rightArm.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude;
            if (this.spine) this.spine.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude * 0.5;
        }
    }

    getWeapon(): Weapon {
        return this.weapon;
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }
}