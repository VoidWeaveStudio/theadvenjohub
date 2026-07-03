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

    private frameCount: number = 0;

    constructor() {
        super("local-player");
        this.weapon = new Weapon();
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        console.log("👤 [Player] Creating player mesh...");
        
        const data = resourceManager.getModel("player");
        if (data) {
            console.log("   - Player model loaded, adding to mesh");
            this.mesh.add(data.scene);
            
            if (data.animations.length > 0) {
                console.log(`   - Found ${data.animations.length} animations`);
                this.mixer = new THREE.AnimationMixer(data.scene);
                for (const clip of data.animations) {
                    this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
                    console.log(`   - Animation: ${clip.name}`);
                }
                if (this.actions["idle"]) {
                    this.actions["idle"].play();
                    this.currentAnim = "idle";
                    console.log("   - Playing idle animation");
                }
            } else {
                console.log("   - No animations found");
            }
        } else {
            console.warn("   - Player model not found, using placeholder");
        }

        this.weapon.create(this.mesh, resourceManager);
        
        this.mesh.position.set(0, 0, 0);
        console.log(`📍 [Player] Initial position: (${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z})`);
        
        scene.add(this.mesh);
        console.log("✅ [Player] Player created and added to scene");
    }

    setDependencies(inputManager: InputManager, camera: CameraController, colliders: THREE.Box3[]) {
        console.log("🔗 [Player] Setting dependencies...");
        this.inputManager = inputManager;
        this.camera = camera;
        this.colliders = colliders;
        console.log(`   - Colliders count: ${colliders.length}`);
        console.log("✅ [Player] Dependencies set");
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
        if (!this.inputManager || !this.camera) {
            if (this.frameCount === 0) {
                console.error("❌ [Player] Dependencies not set! inputManager:", !!this.inputManager, "camera:", !!this.camera);
            }
            return;
        }

        this.frameCount++;
        this.time += delta;

        const moveDir = Player._moveDir.set(0, 0, 0);
        if (this.inputManager.isKeyPressed("KeyW")) moveDir.z -= 1;
        if (this.inputManager.isKeyPressed("KeyS")) moveDir.z += 1;
        if (this.inputManager.isKeyPressed("KeyA")) moveDir.x -= 1;
        if (this.inputManager.isKeyPressed("KeyD")) moveDir.x += 1;

        if (this.frameCount % 60 === 0) {
            console.log(`📊 [Player] Frame ${this.frameCount}:`);
            console.log(`   - Position: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.y.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
            console.log(`   - MoveDir: (${moveDir.x.toFixed(2)}, ${moveDir.y.toFixed(2)}, ${moveDir.z.toFixed(2)})`);
            console.log(`   - Camera yaw: ${this.camera.getYaw().toFixed(2)}`);
            console.log(`   - Delta: ${delta.toFixed(4)}`);
            console.log(`   - Colliders: ${this.colliders.length}`);
        }

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
            let collisionIndex = -1;
            for (let i = 0; i < this.colliders.length; i++) {
                if (this.colliders[i].intersectsBox(playerBox)) {
                    blocked = true;
                    collisionIndex = i;
                    break;
                }
            }

            if (this.frameCount % 60 === 0 && moveDir.lengthSq() > 0) {
                console.log(`   - Step: (${step.x.toFixed(2)}, ${step.y.toFixed(2)}, ${step.z.toFixed(2)})`);
                console.log(`   - NextPos: (${nextPos.x.toFixed(2)}, ${nextPos.y.toFixed(2)}, ${nextPos.z.toFixed(2)})`);
                console.log(`   - Blocked: ${blocked}${collisionIndex >= 0 ? ` (collider ${collisionIndex})` : ''}`);
            }

            if (!blocked) {
                this.mesh.position.copy(nextPos);
                moved = true;
            } else {
                if (this.frameCount % 60 === 0) {
                    console.warn(`⚠️ [Player] Movement blocked by collider ${collisionIndex}`);
                }
            }
        }

        if (moved) {
            const bobFreq = isSprinting ? 14 : 10;
            const bobAmp = isSprinting ? 0.08 : 0.05;
            this.mesh.position.y = Math.abs(Math.sin(this.time * bobFreq)) * bobAmp;
            this.playAnimation(isSprinting ? "run" : "walk");
        } else {
            this.mesh.position.y = Math.sin(this.time * 2) * 0.02;
            this.playAnimation("idle");
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