// src/features/game/world/building/EditorCamera.ts
import * as THREE from "three";

const MIN_DISTANCE = 6;
const MAX_DISTANCE = 180;
const MIN_PITCH = -1.45;
const MAX_PITCH = -0.14;
const PAN_FACTOR = 0.6;
const MIN_PAN_SPEED = 7;
const MAX_PAN_SPEED = 75;
const BOOST_FACTOR = 2.6;
const BOUND_MARGIN = 12;
const YAW_BLEND = 12;
const DEFAULT_YAW = Math.PI * 0.25;
const DEFAULT_PITCH = -0.9;
const DEFAULT_DISTANCE = 34;

export class EditorCamera {
    public readonly camera: THREE.PerspectiveCamera;
    public readonly focus = new THREE.Vector3();

    private yaw = DEFAULT_YAW;
    private targetYaw = DEFAULT_YAW;
    private pitch = DEFAULT_PITCH;
    private distance = DEFAULT_DISTANCE;
    private targetDistance = DEFAULT_DISTANCE;
    private bound = 50;

    private panForward = 0;
    private panRight = 0;
    private panUp = 0;
    private boosted = false;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 6000);
    }

    public setBounds(plotSize: number) {
        this.bound = plotSize / 2 + BOUND_MARGIN;
    }

    public setAspect(aspect: number) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    public reset(focusY: number) {
        this.focus.set(0, focusY, 0);
        this.yaw = DEFAULT_YAW;
        this.targetYaw = DEFAULT_YAW;
        this.pitch = DEFAULT_PITCH;
        this.distance = DEFAULT_DISTANCE;
        this.targetDistance = DEFAULT_DISTANCE;
        this.panForward = 0;
        this.panRight = 0;
        this.panUp = 0;
        this.boosted = false;
    }

    public setFocusHeight(y: number) {
        this.focus.y = y;
    }

    public setPan(forward: number, right: number, up: number, boosted: boolean) {
        this.panForward = forward;
        this.panRight = right;
        this.panUp = up;
        this.boosted = boosted;
    }

    public stopPan() {
        this.panForward = 0;
        this.panRight = 0;
        this.panUp = 0;
        this.boosted = false;
    }

    public orbit(deltaX: number, deltaY: number) {
        this.targetYaw -= deltaX * 0.005;
        this.yaw = this.targetYaw;
        this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * 0.004, MIN_PITCH, MAX_PITCH);
    }

    public rotateStep(direction: number) {
        this.targetYaw += direction * (Math.PI / 4);
    }

    public zoom(delta: number) {
        this.targetDistance = THREE.MathUtils.clamp(
            this.targetDistance * (delta > 0 ? 1.12 : 1 / 1.12),
            MIN_DISTANCE,
            MAX_DISTANCE
        );
    }

    public getYaw(): number {
        return this.yaw;
    }

    private applyPan(delta: number) {
        const length = Math.hypot(this.panForward, this.panRight);
        if (length < 0.001 && this.panUp === 0) return;

        const speed = THREE.MathUtils.clamp(this.distance * PAN_FACTOR, MIN_PAN_SPEED, MAX_PAN_SPEED)
            * (this.boosted ? BOOST_FACTOR : 1)
            * delta;

        if (length > 0.001) {
            const forward = this.panForward / length;
            const right = this.panRight / length;
            const sin = Math.sin(this.yaw);
            const cos = Math.cos(this.yaw);

            this.focus.x += (right * cos - forward * sin) * speed;
            this.focus.z += (-right * sin - forward * cos) * speed;

            this.focus.x = THREE.MathUtils.clamp(this.focus.x, -this.bound, this.bound);
            this.focus.z = THREE.MathUtils.clamp(this.focus.z, -this.bound, this.bound);
        }

        if (this.panUp !== 0) {
            this.targetDistance = THREE.MathUtils.clamp(
                this.targetDistance - this.panUp * speed,
                MIN_DISTANCE,
                MAX_DISTANCE
            );
        }
    }

    public update(delta: number) {
        this.applyPan(delta);

        const blend = Math.min(1, YAW_BLEND * delta);
        this.yaw += (this.targetYaw - this.yaw) * blend;
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
