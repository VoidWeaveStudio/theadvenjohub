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

    constructor() {
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
    }

    setTarget(target: THREE.Object3D) {
        this.target = target;

        if (target) {
            const targetPos = target.position.clone();
            targetPos.y += this.heightOffset;
            this.yawObject.position.copy(targetPos);
        }
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
        if (!this.target) return;

        const mouseMovement = inputManager.consumeMouseMovement();
        this.yaw -= mouseMovement.x * this.sensitivity;
        this.pitch -= mouseMovement.y * this.sensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

        this.yawObject.rotation.y = this.yaw;
        this.pitchObject.rotation.x = this.pitch;

        const targetPos = this.target.position.clone();
        targetPos.y += this.heightOffset;
        this.yawObject.position.copy(targetPos);
    }

    resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
}