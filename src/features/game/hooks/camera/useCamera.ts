// src/features/game/hooks/camera/useCamera.ts
import * as THREE from 'three';
import { CollisionBox } from '../../types';
import { checkCollision } from '../../map/collision';

export interface CameraConfig {
    distance?: number;
    heightOffset?: number;
    focusPointOffset?: number;
    collisionRadius?: number;
    minHeight?: number;
    smoothing?: number;
    collisionSteps?: number;
}

const DEFAULT_CAMERA: Required<CameraConfig> = {
    distance: 6.0,
    heightOffset: 2.5,
    focusPointOffset: 1.2,
    collisionRadius: 0.5,
    minHeight: 0.8,
    smoothing: 8,
    collisionSteps: 15,
};

export class ThirdPersonCamera {
    private config: Required<CameraConfig>;
    private targetPosition = new THREE.Vector3();
    private isFirstUpdate = true;

    constructor(config: CameraConfig = {}) {
        this.config = { ...DEFAULT_CAMERA, ...config };
        console.log(`📷 [ThirdPersonCamera] Initialized with config:`, this.config);
    }

    computeDesiredPosition(
        playerPosition: THREE.Vector3,
        yaw: number,
        pitch: number,
        collisionBoxes: CollisionBox[],
    ): THREE.Vector3 {
        const { distance, heightOffset, focusPointOffset, collisionRadius, minHeight, collisionSteps } = this.config;

        const focusPoint = new THREE.Vector3(
            playerPosition.x - Math.sin(yaw) * focusPointOffset,
            playerPosition.y + heightOffset * 0.8,
            playerPosition.z - Math.cos(yaw) * focusPointOffset,
        );

        const desiredPosition = new THREE.Vector3(
            playerPosition.x + Math.sin(yaw) * Math.cos(pitch) * distance,
            playerPosition.y + heightOffset + Math.sin(pitch) * distance,
            playerPosition.z + Math.cos(yaw) * Math.cos(pitch) * distance,
        );

        if (this.isFirstUpdate) {
            console.log(`📷 [ThirdPersonCamera] First update:`);
            console.log(`   Player position: (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)})`);
            console.log(`   Yaw: ${yaw.toFixed(2)} rad (${(yaw * 180 / Math.PI).toFixed(1)}°)`);
            console.log(`   Pitch: ${pitch.toFixed(2)} rad (${(pitch * 180 / Math.PI).toFixed(1)}°)`);
            console.log(`   Focus point: (${focusPoint.x.toFixed(2)}, ${focusPoint.y.toFixed(2)}, ${focusPoint.z.toFixed(2)})`);
            console.log(`   Desired camera: (${desiredPosition.x.toFixed(2)}, ${desiredPosition.y.toFixed(2)}, ${desiredPosition.z.toFixed(2)})`);
            console.log(`   Distance: ${distance.toFixed(2)}`);
            this.isFirstUpdate = false;
        }

        const direction = desiredPosition.clone().sub(focusPoint).normalize();
        const totalDistance = focusPoint.distanceTo(desiredPosition);
        let collisionDistance = totalDistance;

        for (let i = 1; i <= collisionSteps; i++) {
            const t = i / collisionSteps;
            const checkPos = focusPoint.clone().add(direction.clone().multiplyScalar(totalDistance * t));

            if (checkCollision(checkPos.x, checkPos.z, collisionBoxes, collisionRadius)) {
                collisionDistance = Math.max(0.5, totalDistance * (t - 1 / collisionSteps) - collisionRadius);
                console.warn(`⚠️ [ThirdPersonCamera] Collision detected at t=${t.toFixed(2)}, distance=${collisionDistance.toFixed(2)}`);
                break;
            }
        }

        if (collisionDistance < totalDistance - 0.1) {
            this.targetPosition.set(
                focusPoint.x + direction.x * collisionDistance,
                focusPoint.y + direction.y * collisionDistance,
                focusPoint.z + direction.z * collisionDistance,
            );
        } else {
            this.targetPosition.copy(desiredPosition);
        }

        if (this.targetPosition.y < minHeight) {
            this.targetPosition.y = minHeight;
        }

        return this.targetPosition;
    }

    applyToCamera(
        camera: THREE.PerspectiveCamera,
        targetPosition: THREE.Vector3,
        focusPoint: THREE.Vector3,
        deltaTime: number,
    ): void {
        const lerpFactor = 1 - Math.exp(-this.config.smoothing * deltaTime);
        camera.position.lerp(targetPosition, lerpFactor);
        camera.lookAt(focusPoint);
    }
}

export function useCamera(config: CameraConfig = {}) {
    return new ThirdPersonCamera(config);
}