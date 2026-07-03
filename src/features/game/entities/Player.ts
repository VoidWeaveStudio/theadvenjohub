//src\features\game\entities\Player.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { CameraController } from "../core/CameraController";
import { Weapon } from "./Weapon";

export class Player extends Entity {
    private speed: number = 7;
    private sprintMultiplier: number = 1.6;
    private weapon: Weapon;
    private mixer: THREE.AnimationMixer | null = null;
    private actions: Record<string, THREE.AnimationAction> = {};
    private currentAnim: string = "idle";
    private time: number = 0;

    private inputManager!: InputManager;
    private camera!: CameraController;
    private colliders: THREE.Box3[] = [];

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

        if (data.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(data.scene);

            for (const clip of data.animations) {
                const key = clip.name.toLowerCase();
                this.actions[key] = this.mixer.clipAction(clip);
            }

            const idleKey = Object.keys(this.actions).find(k => k.includes("idle"));
            if (idleKey) {
                this.actions[idleKey].play();
                this.currentAnim = idleKey;
            } else {
                const firstKey = Object.keys(this.actions)[0];
                if (firstKey) {
                    this.actions[firstKey].play();
                    this.currentAnim = firstKey;
                }
            }
        }

        this.weapon.create(this.mesh, resourceManager);
        this.mesh.position.set(0, 0, 0);
        scene.add(this.mesh);
    }

    setDependencies(inputManager: InputManager, camera: CameraController, colliders: THREE.Box3[]) {
        this.inputManager = inputManager;
        this.camera = camera;
        this.colliders = colliders;
    }

    playAnimation(name: string) {
        if (!this.mixer) return;

        const next = this.actions[name.toLowerCase()];
        if (!next || this.currentAnim === name.toLowerCase()) return;

        const current = this.actions[this.currentAnim];
        if (current) current.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        this.currentAnim = name.toLowerCase();
    }

    update(delta: number) {
        if (!this.inputManager || !this.camera) return;

        this.time += delta;

        const moveDir = Player._moveDir.set(0, 0, 0);
        if (this.inputManager.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager.isKeyPressed("KeyD")) moveDir.x += 1;

        this.mesh.rotation.y = this.camera.getYaw();

        const isSprinting = this.inputManager.isKeyPressed("ShiftLeft") || this.inputManager.isKeyPressed("ShiftRight");
        const currentSpeed = this.speed * (isSprinting ? this.sprintMultiplier : 1);

        let moved = false;
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camera.getYaw());
            const step = Player._step.copy(moveDir).multiplyScalar(currentSpeed * delta);

            const nextPos = Player._nextPos.copy(this.mesh.position).add(step);
            const playerBox = Player._playerBox.setFromCenterAndSize(nextPos, Player._playerSize);

            let blocked = false;
            for (let i = 0; i < this.colliders.length; i++) {
                if (this.colliders[i].intersectsBox(playerBox)) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) {
                this.mesh.position.copy(nextPos);
                moved = true;
            }
        }

        if (moved) {
            const bobFreq = isSprinting ? 14 : 10;
            const bobAmp = isSprinting ? 0.08 : 0.05;
            this.mesh.position.y = Math.abs(Math.sin(this.time * bobFreq)) * bobAmp;
        } else {
            this.mesh.position.y = Math.sin(this.time * 2) * 0.02;
        }

        this.mixer?.update(delta);
        this.weapon.update(delta);
    }

    getWeapon(): Weapon {
        return this.weapon;
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }
}