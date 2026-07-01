// src/features/game/hooks/useBasePlayerController.ts
import { useRef } from 'react';
import * as THREE from 'three';

import { useKeyboardInput } from './input/useKeyboardInput';
import { useMouseLook } from './input/useMouseLook';
import { usePhysics } from './physics/usePhysics';
import { useCameraController } from './camera/useCameraController';
import { useMovement } from './movement/useMovement';
import { useFootstepSounds } from './audio/useFootstepSounds';
import { usePlayerSync } from './network/usePlayerSync';
import { PlayerModelLoader } from '../models/PlayerModelLoader';
import { CAMERA_CONFIG, MOVEMENT_CONFIG, ANIMATION_CONFIG } from '../config/gameConfig';
import { BasePlayerControllerConfig } from './types';

export function useBasePlayerController(config: BasePlayerControllerConfig) {
    const keyboard = useKeyboardInput({ isChatOpen: config.isChatOpenRef.current });
    const isMouseDownRef = useRef(false);

    const mouseLook = useMouseLook({
        containerRef: config.containerRef,
        isChatOpenRef: config.isChatOpenRef,
        onLockChange: config.onLockChange,
        isMouseDown: isMouseDownRef,
    });

    const physics = usePhysics({ 
        groundLevel: config.bounds?.groundLevel ?? 0 
    });

    const cameraController = useCameraController({
        ...CAMERA_CONFIG,
        ...config.cameraConfig,
    });

    const movement = useMovement({
        ...MOVEMENT_CONFIG,
        ...config.movementConfig,
    });
    
    const footsteps = useFootstepSounds(config.soundManagerRef, { 
        interval: ANIMATION_CONFIG.footstepInterval 
    });

    const playerSync = usePlayerSync({
        socket: config.socket,
        playerRef: config.playerModelRef,
        sendInterval: 100,
        minDistance: 0.1,
    });

    const update = (deltaTime: number): void => {
        const player = config.playerModelRef.current;
        const camera = config.cameraRef.current;
        if (!player || !camera) return;

        const isChatOpen = config.isChatOpenRef.current;
        const groundOffset = PlayerModelLoader.getGroundOffset();
        
        physics.initialize(groundOffset);
        const newY = physics.update(deltaTime);
        player.position.y = newY;

        if (isChatOpen) {
            cameraController.update(
                { 
                    cameraRef: config.cameraRef, 
                    playerModelRef: config.playerModelRef, 
                    yawRef: mouseLook.yawRef, 
                    pitchRef: mouseLook.pitchRef, 
                    collisionSystem: config.collisionSystem 
                },
                deltaTime,
            );
            return;
        }

        const inputDir = movement.getInputDirection(keyboard.keys);
        const isMoving = inputDir.lengthSq() > 0;

        if (isMoving) {
            const worldDir = movement.toWorldDirection(inputDir, mouseLook.yawRef.current);
            
            if (config.bounds) {
                applyMovementWithBounds(player, worldDir, deltaTime, config.bounds);
            } else if (config.collisionBoxes && config.collisionBoxes.length > 0) {
                movement.applyMovement(player, worldDir, deltaTime, config.collisionBoxes);
            } else {
                const speed = movement.getSpeed() * deltaTime;
                player.position.x += worldDir.x * speed;
                player.position.z += worldDir.z * speed;
            }
            
            const moveYaw = Math.atan2(worldDir.x, worldDir.z);
            movement.rotateToward(player, moveYaw, deltaTime);
            
            playerSync.sendIfChanged(player.position, player.rotation);
        }

        footsteps.update(deltaTime, isMoving, physics.isOnGroundRef.current);

        if (config.onProceduralDataUpdate) {
            config.onProceduralDataUpdate({
                isMoving,
                moveSpeed: isMoving ? 1 : 0,
                strafeInput: (keyboard.keys.has('KeyA') ? -1 : 0) + (keyboard.keys.has('KeyD') ? 1 : 0),
                playerYaw: player.rotation.y,
                cameraYaw: mouseLook.yawRef.current,
                cameraPitch: mouseLook.pitchRef.current,
            });
        }

        cameraController.update(
            { 
                cameraRef: config.cameraRef, 
                playerModelRef: config.playerModelRef, 
                yawRef: mouseLook.yawRef, 
                pitchRef: mouseLook.pitchRef, 
                collisionSystem: config.collisionSystem 
            },
            deltaTime,
        );
    };

    const applyMovementWithBounds = (
        player: THREE.Group,
        worldDir: THREE.Vector3,
        deltaTime: number,
        bounds: { maxRadius: number; groundLevel: number },
    ): void => {
        if (worldDir.lengthSq() < 1e-6) return;
        worldDir.normalize();

        const speed = movement.getSpeed() * deltaTime;
        const newX = player.position.x + worldDir.x * speed;
        const newZ = player.position.z + worldDir.z * speed;

        const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
        if (distFromCenter <= bounds.maxRadius) {
            player.position.x = newX;
            player.position.z = newZ;
        } else {
            const angle = Math.atan2(newZ, newX);
            player.position.x = Math.cos(angle) * bounds.maxRadius;
            player.position.z = Math.sin(angle) * bounds.maxRadius;
        }
    };

    return {
        update,
        physics,
        camera: cameraController.camera,
        movement,
        keyboard,
        mouseLook,
        isMouseDownRef,
    };
}