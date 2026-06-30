// src/features/game/hooks/camera/useCamera.ts

import * as THREE from 'three';
import { CollisionSystem } from '../../map/CollisionSystem';
import { CAMERA_CONFIG, CameraConfig } from '../../config/gameConfig';

export type { CameraConfig };


export class ThirdPersonCamera {
    private config: CameraConfig;
    private targetPosition = new THREE.Vector3();
    private focusPoint = new THREE.Vector3();
    private tempVector = new THREE.Vector3();
    private direction = new THREE.Vector3();

    constructor(config: Partial<CameraConfig> = {}) {
        this.config = { ...CAMERA_CONFIG, ...config };
    }

    computeDesiredPosition(
        playerPosition: THREE.Vector3,
        yaw: number,
        pitch: number,
        collisionSystem?: CollisionSystem,
    ): { cameraPosition: THREE.Vector3; focusPoint: THREE.Vector3 } {
        const {
            distance, heightOffset, focusHeight,
            collisionRadius, minHeight, collisionSteps,
            enableCollision, minPitch, maxPitch
        } = this.config;

        pitch = THREE.MathUtils.clamp(pitch, minPitch, maxPitch);

        this.focusPoint.set(
            playerPosition.x,
            playerPosition.y + focusHeight,
            playerPosition.z,
        );

        this.targetPosition.set(
            playerPosition.x + Math.sin(yaw) * Math.cos(pitch) * distance,
            playerPosition.y + heightOffset + Math.sin(pitch) * distance,
            playerPosition.z + Math.cos(yaw) * Math.cos(pitch) * distance,
        );

        if (enableCollision && collisionSystem) {
            this.handleCollision(collisionSystem, collisionRadius, collisionSteps);
        }

        if (this.targetPosition.y < minHeight) {
            this.targetPosition.y = minHeight;
        }

        return {
            cameraPosition: this.targetPosition.clone(),
            focusPoint: this.focusPoint.clone(),
        };
    }

    private handleCollision(
        collisionSystem: CollisionSystem,
        collisionRadius: number,
        collisionSteps: number,
    ): void {
        this.direction.copy(this.targetPosition).sub(this.focusPoint).normalize();
        const totalDistance = this.focusPoint.distanceTo(this.targetPosition);
        let collisionDistance = totalDistance;

        for (let i = 1; i <= collisionSteps; i++) {
            const t = i / collisionSteps;
            this.tempVector.copy(this.focusPoint)
                .addScaledVector(this.direction, totalDistance * t);

            if (collisionSystem.checkCollision3D(
                this.tempVector.x,
                this.tempVector.y,
                this.tempVector.z,
                collisionRadius,
            )) {
                collisionDistance = Math.max(
                    0.5,
                    totalDistance * (t - 1 / collisionSteps) - collisionRadius,
                );
                break;
            }
        }

        if (collisionDistance < totalDistance - 0.1) {
            this.targetPosition.copy(this.focusPoint)
                .addScaledVector(this.direction, collisionDistance);
        }
    }

    applyToCamera(
        camera: THREE.PerspectiveCamera,
        cameraPosition: THREE.Vector3,
        focusPoint: THREE.Vector3,
        deltaTime: number,
    ): void {
        const lerpFactor = 1 - Math.exp(-this.config.smoothing * deltaTime);
        camera.position.lerp(cameraPosition, lerpFactor);
        camera.lookAt(focusPoint);
    }
}

export function useCamera(config: Partial<CameraConfig> = {}) {
    return new ThirdPersonCamera(config);
}