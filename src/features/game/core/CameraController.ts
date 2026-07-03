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
        console.log("📷 [CameraController] === INIT START ===");
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );
        console.log(`   - FOV: ${this.camera.fov}`);
        console.log(`   - Aspect: ${this.camera.aspect}`);
        console.log(`   - Near: ${this.camera.near}, Far: ${this.camera.far}`);

        this.yawObject = new THREE.Object3D();
        this.pitchObject = new THREE.Object3D();
        console.log("   ✅ Yaw and pitch objects created");

        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        console.log("   ✅ Camera hierarchy: yawObject → pitchObject → camera");

        this.camera.position.set(0, 0, this.distance);
        console.log(`   - Initial camera position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
        
        console.log(`   📏 Distance: ${this.distance}`);
        console.log(`   📏 Height offset: ${this.heightOffset}`);
        console.log(`   🖱️ Sensitivity: ${this.sensitivity}`);
        console.log(`   📐 Pitch range: [${(this.minPitch * 180 / Math.PI).toFixed(1)}°, ${(this.maxPitch * 180 / Math.PI).toFixed(1)}°]`);
        console.log("📷 [CameraController] === INIT END ===");
    }

    setTarget(target: THREE.Object3D) {
        console.log("🎯 [CameraController] === SET TARGET ===");
        this.target = target;
        console.log(`   ✅ Target set: ${target.name || 'unnamed'}`);
        console.log(`   - Target position: (${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)}, ${target.position.z.toFixed(2)})`);
        console.log(`   - Target rotation: (${target.rotation.x.toFixed(2)}, ${target.rotation.y.toFixed(2)}, ${target.rotation.z.toFixed(2)})`);
        console.log("🎯 [CameraController] === TARGET READY ===");
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
        
        const oldYaw = this.yaw;
        const oldPitch = this.pitch;
        
        this.yaw -= mouseMovement.x * this.sensitivity;
        this.pitch -= mouseMovement.y * this.sensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

        if (this.frameCount % 60 === 0 && (Math.abs(this.yaw - oldYaw) > 0.01 || Math.abs(this.pitch - oldPitch) > 0.01)) {
            console.log(`📷 [Camera] Mouse input:`);
            console.log(`   - Mouse delta: (${mouseMovement.x.toFixed(2)}, ${mouseMovement.y.toFixed(2)})`);
            console.log(`   - Yaw: ${oldYaw.toFixed(2)} → ${this.yaw.toFixed(2)} (${((this.yaw - oldYaw) * 180 / Math.PI).toFixed(1)}°)`);
            console.log(`   - Pitch: ${oldPitch.toFixed(2)} → ${this.pitch.toFixed(2)} (${((this.pitch - oldPitch) * 180 / Math.PI).toFixed(1)}°)`);
        }

        this.yawObject.rotation.y = this.yaw;
        this.pitchObject.rotation.x = this.pitch;

        const targetPos = this.target.position.clone();
        targetPos.y += this.heightOffset;
        this.yawObject.position.copy(targetPos);

        const offset = new THREE.Vector3(0, 0, this.distance);
        offset.applyQuaternion(this.pitchObject.getWorldQuaternion(new THREE.Quaternion()));
        this.camera.position.copy(offset);

        if (this.frameCount % 60 === 0) {
            const cameraWorldPos = this.camera.getWorldPosition(new THREE.Vector3());
            console.log(`\n📷 [CameraController] === Frame ${this.frameCount} ===`);
            console.log(`   🎯 Target: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
            console.log(`   🔄 YawObject rotation: (${this.yawObject.rotation.x.toFixed(2)}, ${this.yawObject.rotation.y.toFixed(2)}, ${this.yawObject.rotation.z.toFixed(2)})`);
            console.log(`   🔄 PitchObject rotation: (${this.pitchObject.rotation.x.toFixed(2)}, ${this.pitchObject.rotation.y.toFixed(2)}, ${this.pitchObject.rotation.z.toFixed(2)})`);
            console.log(`   📷 Camera local pos: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
            console.log(`   📷 Camera world pos: (${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)})`);
            console.log(`   📏 Distance to target: ${cameraWorldPos.distanceTo(targetPos).toFixed(2)}`);
        }
    }

    resize(width: number, height: number) {
        console.log(`📐 [CameraController] Resizing to ${width}x${height}`);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        console.log(`   ✅ Aspect ratio: ${this.camera.aspect.toFixed(2)}`);
    }
}