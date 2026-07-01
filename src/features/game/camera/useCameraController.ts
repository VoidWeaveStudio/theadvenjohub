// src/features/game/camera/useCameraController.ts
import * as THREE from 'three';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { CameraConfig } from './config';
import { CollisionSystem } from '../map/CollisionSystem';

export interface CameraControllerDeps {
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    yawRef: React.MutableRefObject<number>;
    pitchRef: React.MutableRefObject<number>;
    collisionSystem?: CollisionSystem | null;
}

export function useCameraController(config: CameraConfig) {
    const camera = new ThirdPersonCamera(config);

    const update = (deps: CameraControllerDeps, deltaTime: number): void => {
        const { cameraRef, playerModelRef, yawRef, pitchRef, collisionSystem } = deps;
        const player = playerModelRef.current;
        const cameraInstance = cameraRef.current;

        if (!player || !cameraInstance) return;

        const { cameraPosition, focusPoint } = camera.computeDesiredPosition(
            player.position,
            yawRef.current,
            pitchRef.current,
            collisionSystem ?? undefined,
        );

        camera.applyToCamera(
            cameraInstance,
            cameraPosition,
            focusPoint,
            deltaTime,
        );
    };

    return { camera, update };
}