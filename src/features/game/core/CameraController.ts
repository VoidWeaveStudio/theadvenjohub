// src/features/game/core/CameraController.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CollisionGrid } from "../world/CollisionGrid";
import type { CameraBounds, CoverProbe } from "../world/Location";

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 20000;

const OUTDOOR_DISTANCE = 6;
const INDOOR_DISTANCE = 2.9;
const OUTDOOR_HEIGHT = 2.5;
const INDOOR_HEIGHT = 1.5;
const OUTDOOR_HFOV = 88;
const INDOOR_HFOV = 76;
const AIM_HFOV = 66;
const MIN_VFOV = 32;
const MAX_VFOV = 70;
const INDOOR_MAX_PITCH = Math.PI / 6;
const COVER_RANGE = 4.5;
const INDOOR_BLEND_SPEED = 3.5;

const STEP_ABSORB_MIN = 0.12;
const STEP_ABSORB_MAX = 1.2;
const STEP_ABSORB_LIMIT = 0.9;
const STEP_DECAY = 8;

export class CameraController {
    private static readonly _cameraWorld = new THREE.Vector3();
    private static readonly _rayDirection = new THREE.Vector3();
    private static readonly _querySize = new THREE.Vector3();
    private static readonly _intersection = new THREE.Vector3();

    public camera: THREE.PerspectiveCamera;
    public yawObject: THREE.Object3D;
    public pitchObject: THREE.Object3D;

    private target: THREE.Object3D | null = null;
    private distance: number = OUTDOOR_DISTANCE;
    private currentDistance: number = OUTDOOR_DISTANCE;
    private heightOffset: number = OUTDOOR_HEIGHT;
    private pitch: number = 0;
    private yaw: number = 0;

    private minPitch: number = -Math.PI / 3;
    private maxPitch: number = Math.PI / 3;
    private sensitivity: number = 0.002;

    private horizontalFov: number = OUTDOOR_HFOV;
    private currentFov: number = MAX_VFOV;
    private isAiming: boolean = false;

    private coverProbe: CoverProbe | null = null;
    private cameraBounds: CameraBounds | null = null;
    private indoorBlend: number = 0;

    private collisionGrid: CollisionGrid | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private cameraOffset: number = 0.3;
    private lerpSpeed: number = 10;

    private stepOffset: number = 0;
    private previousTargetY: number | null = null;
    private absorbSteps: boolean = false;

    private verticalFovFor(horizontalFov: number): number {
        const aspect = this.camera.aspect > 0 ? this.camera.aspect : 1;
        const vertical = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(horizontalFov) / 2) / aspect);
        return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vertical), MIN_VFOV, MAX_VFOV);
    }

    resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.currentFov = this.verticalFovFor(this.horizontalFov);
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
    }

    constructor() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            CAMERA_NEAR,
            CAMERA_FAR
        );

        this.currentFov = this.verticalFovFor(OUTDOOR_HFOV);
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();

        this.yawObject = new THREE.Object3D();
        this.pitchObject = new THREE.Object3D();

        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);

        this.camera.position.set(0, 0, this.distance);
    }

    setTarget(target: THREE.Object3D) {
        this.target = target;

        this.stepOffset = 0;
        this.previousTargetY = null;

        if (target) {
            const targetPos = target.position.clone();
            targetPos.y += this.heightOffset;
            this.yawObject.position.copy(targetPos);
        }
    }

    setAbsorbSteps(absorb: boolean) {
        this.absorbSteps = absorb;
    }

    private smoothVerticalStep(rawY: number, delta: number): number {
        if (this.previousTargetY === null) {
            this.previousTargetY = rawY;
            return rawY;
        }

        const jump = rawY - this.previousTargetY;
        this.previousTargetY = rawY;

        const magnitude = Math.abs(jump);
        if (this.absorbSteps && magnitude > STEP_ABSORB_MIN && magnitude < STEP_ABSORB_MAX) {
            this.stepOffset = THREE.MathUtils.clamp(
                this.stepOffset - jump,
                -STEP_ABSORB_LIMIT,
                STEP_ABSORB_LIMIT
            );
        }

        this.stepOffset *= Math.exp(-delta * STEP_DECAY);
        if (Math.abs(this.stepOffset) < 0.002) this.stepOffset = 0;

        return rawY + this.stepOffset;
    }

    setCollisionGrid(grid: CollisionGrid) {
        this.collisionGrid = grid;
    }

    setCoverProbe(probe: CoverProbe | null) {
        this.coverProbe = probe;
        this.indoorBlend = 0;
    }

    setCameraBounds(bounds: CameraBounds | null) {
        this.cameraBounds = bounds;
    }

    private boundsLimitedDistance(origin: THREE.Vector3, direction: THREE.Vector3, limit: number): number {
        const bounds = this.cameraBounds;
        if (!bounds) return limit;
        if (origin.y < bounds.minY || origin.y > bounds.maxY) return limit;

        const dx = direction.x;
        const dz = direction.z;
        const flatSq = dx * dx + dz * dz;
        if (flatSq < 1e-6) return limit;

        const b = origin.x * dx + origin.z * dz;
        const c = origin.x * origin.x + origin.z * origin.z - bounds.radius * bounds.radius;
        const discriminant = b * b - flatSq * c;
        if (discriminant <= 0) return limit;

        const hit = (-b + Math.sqrt(discriminant)) / flatSq;
        if (hit <= 0) return limit;

        return Math.min(limit, hit);
    }

    private updateIndoorBlend(delta: number) {
        let wanted = 0;

        if (this.coverProbe && this.target) {
            const position = this.target.position;
            const cover = this.coverProbe(position.x, position.y, position.z);
            if (Number.isFinite(cover) && cover - position.y <= COVER_RANGE) wanted = 1;
        }

        this.indoorBlend = THREE.MathUtils.lerp(this.indoorBlend, wanted, Math.min(1, delta * INDOOR_BLEND_SPEED));
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

    isAimingState(): boolean {
        return this.isAiming;
    }

    update(delta: number, inputManager: InputManager) {
        if (!this.target) return;

        this.updateIndoorBlend(delta);

        const openHorizontalFov = THREE.MathUtils.lerp(OUTDOOR_HFOV, INDOOR_HFOV, this.indoorBlend);
        const followDistance = THREE.MathUtils.lerp(OUTDOOR_DISTANCE, INDOOR_DISTANCE, this.indoorBlend);
        const followHeight = THREE.MathUtils.lerp(OUTDOOR_HEIGHT, INDOOR_HEIGHT, this.indoorBlend);
        const pitchCeiling = THREE.MathUtils.lerp(this.maxPitch, INDOOR_MAX_PITCH, this.indoorBlend);

        this.distance = followDistance;
        this.heightOffset = followHeight;

        this.isAiming = inputManager.isMousePressed(2);
        this.horizontalFov = this.isAiming ? AIM_HFOV : openHorizontalFov;
        const targetFov = this.verticalFovFor(this.horizontalFov);
        this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, Math.min(1, delta * 10));
        if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
            this.camera.fov = this.currentFov;
            this.camera.updateProjectionMatrix();
        }

        const aimSensitivity = this.isAiming ? this.sensitivity * 0.5 : this.sensitivity;
        const mouseMovement = inputManager.consumeMouseMovement();
        this.yaw -= mouseMovement.x * aimSensitivity;
        this.pitch -= mouseMovement.y * aimSensitivity;
        this.pitch = Math.max(this.minPitch, Math.min(pitchCeiling, this.pitch));

        this.yawObject.rotation.y = this.yaw;
        this.pitchObject.rotation.x = this.pitch;

        const targetPos = this.target.position.clone();
        targetPos.y = this.smoothVerticalStep(targetPos.y + this.heightOffset, delta);
        this.yawObject.position.copy(targetPos);

        this.camera.getWorldPosition(CameraController._cameraWorld);
        const direction = CameraController._rayDirection
            .subVectors(CameraController._cameraWorld, targetPos)
            .normalize();

        let closestDistance = this.boundsLimitedDistance(targetPos, direction, this.distance);

        if (this.collisionGrid) {
            const rayDistance = this.distance + 2;

            this.raycaster.set(targetPos, direction);
            this.raycaster.far = rayDistance;

            const querySize = CameraController._querySize.setScalar(rayDistance * 2);
            const colliders = this.collisionGrid.query(targetPos, querySize);
            const intersection = CameraController._intersection;

            for (const box of colliders) {
                if (this.raycaster.ray.intersectBox(box, intersection)) {
                    const dist = targetPos.distanceTo(intersection);
                    if (dist < closestDistance) {
                        closestDistance = dist;
                    }
                }
            }
        }

        const targetDistance = Math.max(this.cameraOffset, closestDistance - this.cameraOffset);
        this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDistance, this.lerpSpeed * delta);

        this.camera.position.z = this.currentDistance;
    }
}