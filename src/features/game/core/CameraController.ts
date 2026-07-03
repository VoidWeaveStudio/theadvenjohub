//src\features\game\core\CameraController.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";

export class CameraController {
    public camera: THREE.PerspectiveCamera;
    public yawObject: THREE.Object3D;
    public pitchObject: THREE.Object3D;

    private target: THREE.Object3D | null = null;
    private distance: number = 6;
    private heightOffset: number = 2.5;
    private pitch: number = 0;
    private yaw: number = 0;

    private minPitch: number = -Math.PI / 3;
    private maxPitch: number = Math.PI / 3;
    private sensitivity: number = 0.002;

    private frameCount: number = 0;

    constructor() {
        console.log("📷 [CameraController] Initializing...");
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );

        this.yawObject = new THREE.Object3D();
        this.pitchObject = new THREE.Object3D();

        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);

        this.camera.position.set(0, 0, this.distance);
        
        console.log(`   - Distance: ${this.distance}`);
        console.log(`   - Height offset: ${this.heightOffset}`);
        console.log(`   - Sensitivity: ${this.sensitivity}`);
        console.log("✅ [CameraController] Initialized");
    }

    setTarget(target: THREE.Object3D) {
        console.log("🎯 [CameraController] Setting target...");
        this.target = target;
        console.log(`   - Target position: (${target.position.x}, ${target.position.y}, ${target.position.z})`);
        console.log("✅ [CameraController] Target set");
    }

    getYaw(): number {
        return this.yaw;
    }

    getPitch(): number {
        return this.pitch;
    }

    getForwardDirection(): THREE.Vector3 {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.pitchObject.getWorldQuaternion(new THREE.Quaternion()));
        return dir;
    }

    update(delta: number, inputManager: InputManager) {
        if (!this.target) {
            if (this.frameCount === 0) {
                console.error("❌ [CameraController] Target not set!");
            }
            return;
        }

        this.frameCount++;

        const mouseMovement = inputManager.consumeMouseMovement();
        this.yaw -= mouseMovement.x * this.sensitivity;
        this.pitch -= mouseMovement.y * this.sensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

        this.yawObject.rotation.y = this.yaw;
        this.pitchObject.rotation.x = this.pitch;

        const targetPos = this.target.position.clone();
        targetPos.y += this.heightOffset;
        this.yawObject.position.copy(targetPos);

        const offset = new THREE.Vector3(0, 0, this.distance);
        offset.applyQuaternion(this.pitchObject.getWorldQuaternion(new THREE.Quaternion()));
        this.camera.position.copy(offset);

        if (this.frameCount % 60 === 0) {
            console.log(`📷 [Camera] Frame ${this.frameCount}:`);
            console.log(`   - Target: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
            console.log(`   - Yaw: ${this.yaw.toFixed(2)}, Pitch: ${this.pitch.toFixed(2)}`);
            console.log(`   - Camera world pos: (${this.camera.getWorldPosition(new THREE.Vector3()).x.toFixed(2)}, ${this.camera.getWorldPosition(new THREE.Vector3()).y.toFixed(2)}, ${this.camera.getWorldPosition(new THREE.Vector3()).z.toFixed(2)})`);
        }
    }

    resize(width: number, height: number) {
        console.log(`📐 [CameraController] Resizing to ${width}x${height}`);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
}