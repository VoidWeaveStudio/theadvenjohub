// src/features/game/world/building/EditorCamera.ts
import * as THREE from "three";

const MIN_DISTANCE = 8;
const MAX_DISTANCE = 160;
const MIN_PITCH = -1.45;
const MAX_PITCH = -0.22;

export class EditorCamera {
    public readonly camera: THREE.PerspectiveCamera;
    public readonly focus = new THREE.Vector3();

    private yaw = Math.PI * 0.25;
    private pitch = -0.95;
    private distance = 34;
    private targetDistance = 34;
    private bound = 50;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 4000);
    }

    public setBounds(plotSize: number) {
        this.bound = plotSize / 2;
    }

    public setAspect(aspect: number) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    public reset(focusY: number) {
        this.focus.set(0, focusY, 0);
        this.yaw = Math.PI * 0.25;
        this.pitch = -0.95;
        this.distance = 34;
        this.targetDistance = 34;
    }

    public setFocusHeight(y: number) {
        this.focus.y = y;
    }

    public pan(forward: number, right: number) {
        const speed = this.distance * 0.035;
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);

        this.focus.x += (forward * sin + right * cos) * speed;
        this.focus.z += (forward * -cos + right * sin) * speed;

        this.focus.x = THREE.MathUtils.clamp(this.focus.x, -this.bound, this.bound);
        this.focus.z = THREE.MathUtils.clamp(this.focus.z, -this.bound, this.bound);
    }

    public orbit(deltaX: number, deltaY: number) {
        this.yaw -= deltaX * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * 0.004, MIN_PITCH, MAX_PITCH);
    }

    public rotateStep(direction: number) {
        this.yaw += direction * (Math.PI / 4);
    }

    public zoom(delta: number) {
        this.targetDistance = THREE.MathUtils.clamp(
            this.targetDistance * (delta > 0 ? 1.12 : 1 / 1.12),
            MIN_DISTANCE,
            MAX_DISTANCE
        );
    }

    public update(delta: number) {
        this.distance += (this.targetDistance - this.distance) * Math.min(1, 10 * delta);

        const horizontal = Math.cos(this.pitch) * this.distance;
        this.camera.position.set(
            this.focus.x + Math.sin(this.yaw) * horizontal,
            this.focus.y - Math.sin(this.pitch) * this.distance,
            this.focus.z + Math.cos(this.yaw) * horizontal
        );
        this.camera.lookAt(this.focus);
    }
}
