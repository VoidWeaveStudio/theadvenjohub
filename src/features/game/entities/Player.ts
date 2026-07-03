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
    private lastLogTime: number = 0;

    constructor() {
        super("local-player");
        console.log("👤 [Player] Constructor called");
        this.weapon = new Weapon();
        console.log("👤 [Player] Weapon instance created");
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        console.log("👤 [Player] === CREATE START ===");

        const data = resourceManager.getModel("player");
        if (data) {
            console.log("   ✅ Player model data found");

            data.scene.position.set(0, 0, 0);
            data.scene.rotation.set(0, 0, 0);

            const box = new THREE.Box3().setFromObject(data.scene);
            const center = box.getCenter(new THREE.Vector3());
            data.scene.position.sub(center);

            const size = box.getSize(new THREE.Vector3());
            const maxHeight = 1.8;
            if (size.y > maxHeight) {
                const scale = maxHeight / size.y;
                data.scene.scale.setScalar(scale);
                console.log(`   📏 Scaled model to ${scale.toFixed(2)} (height: ${maxHeight}m)`);
            }

            this.mesh.add(data.scene);
            console.log("   ✅ Model scene added to player mesh");

            if (data.animations.length > 0) {
                console.log(`   🎬 Found ${data.animations.length} animations:`);
                this.mixer = new THREE.AnimationMixer(data.scene);

                for (const clip of data.animations) {
                    this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
                    console.log(`   - Animation registered: "${clip.name}"`);
                }

                if (this.actions["idle"]) {
                    this.actions["idle"].play();
                    this.currentAnim = "idle";
                    console.log("   ▶️ Playing idle animation");
                }
            }
        } else {
            console.warn("   ❌ Player model not found, using placeholder");
            const placeholder = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
                new THREE.MeshStandardMaterial({ color: 0x00ff00 })
            );
            placeholder.position.y = 1;
            this.mesh.add(placeholder);
        }

        this.weapon.create(this.mesh, resourceManager);

        this.mesh.position.set(0, 0, 0);
        console.log(`📍 [Player] Initial position: (${this.mesh.position.x}, ${this.mesh.position.y}, ${this.mesh.position.z})`);

        scene.add(this.mesh);
        console.log("✅ [Player] Player mesh added to scene");
        console.log("👤 [Player] === CREATE END ===");
    }

    setDependencies(inputManager: InputManager, camera: CameraController, colliders: THREE.Box3[]) {
        console.log("🔗 [Player] === SET DEPENDENCIES ===");
        this.inputManager = inputManager;
        console.log("   ✅ InputManager set");
        this.camera = camera;
        console.log("   ✅ CameraController set");
        this.colliders = colliders;
        console.log(`   ✅ Colliders set: ${colliders.length} boxes`);
        console.log("🔗 [Player] === DEPENDENCIES READY ===");
    }

    playAnimation(name: string) {
        if (!this.mixer) {
            console.warn(`⚠️ [Player] Cannot play "${name}" - mixer is null`);
            return;
        }

        const next = this.actions[name.toLowerCase()];
        if (!next) {
            console.warn(`⚠️ [Player] Animation "${name}" not found`);
            return;
        }
 
        if (this.currentAnim === name.toLowerCase()) {
            return;
        }

        console.log(`🎬 [Player] Animation transition: "${this.currentAnim}" → "${name}"`);

        const current = this.actions[this.currentAnim];
        if (current) {
            current.fadeOut(0.3);
            console.log(`   - Fading out "${this.currentAnim}"`);
        }

        next.reset().fadeIn(0.3).play();
        this.currentAnim = name.toLowerCase();
        console.log(`   ✅ Now playing "${name}"`);
    }

    update(delta: number) {
        if (!this.inputManager || !this.camera) {
            if (this.frameCount === 0) {
                console.error("❌ [Player] Dependencies not set!");
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

        this.mesh.rotation.y = this.camera.getYaw();

        if (this.frameCount % 60 === 0) {
            console.log(`\n👤 [Player] Frame ${this.frameCount}:`);
            console.log(`   📍 Mesh position: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.y.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
            console.log(`   🎯 MoveDir input: (${moveDir.x.toFixed(2)}, ${moveDir.y.toFixed(2)}, ${moveDir.z.toFixed(2)})`);
            console.log(`   📷 Camera yaw: ${(this.camera.getYaw() * 180 / Math.PI).toFixed(1)}°`);

            if (this.mesh.children.length > 0) {
                const model = this.mesh.children[0];
                console.log(`   🎭 Model position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
            }
        }

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

            if (this.frameCount % 60 === 0) {
                console.log(`   🚶 Movement:`);
                console.log(`      - Direction: (${moveDir.x.toFixed(2)}, ${moveDir.z.toFixed(2)})`);
                console.log(`      - Step: (${step.x.toFixed(3)}, ${step.z.toFixed(3)})`);
                console.log(`      - NextPos: (${nextPos.x.toFixed(2)}, ${nextPos.z.toFixed(2)})`);
                console.log(`      - Blocked: ${blocked}`);
            }

            if (!blocked) {
                this.mesh.position.copy(nextPos);
                moved = true;

                if (this.frameCount % 60 === 0) {
                    console.log(`   ✅ Player moved to: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
                }
            }
        }

        if (moved) {
            const bobFreq = isSprinting ? 14 : 10;
            const bobAmp = isSprinting ? 0.08 : 0.05;
            this.mesh.position.y = Math.abs(Math.sin(this.time * bobFreq)) * bobAmp;
        } else {
            this.mesh.position.y = Math.sin(this.time * 2) * 0.02;
        }

        this.weapon.update(delta);
    }

    getWeapon(): Weapon {
        return this.weapon;
    }

    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }
}