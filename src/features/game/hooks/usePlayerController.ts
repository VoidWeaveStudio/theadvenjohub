// src/features/game/hooks/usePlayerController.ts

import { useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';

import { useKeyboardInput } from './input/useKeyboardInput';
import { useMouseLook } from './input/useMouseLook';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';

import { usePhysics } from './physics/usePhysics';
import { useCameraController } from './camera/useCameraController';
import { useMovement } from './movement/useMovement';
import { useFootstepSounds } from './audio/useFootstepSounds';
import { usePlayerSync } from './network/usePlayerSync';

import { CollisionBox } from '../types';
import { CollisionSystem } from '../map/CollisionSystem';
import { ProceduralAnimationData } from '../models/PlayerAnimator';
import { PlayerModelLoader } from '../models/PlayerModelLoader';

import { CAMERA_CONFIG, MOVEMENT_CONFIG, ANIMATION_CONFIG } from '../config/gameConfig';



export interface PlayerControllerConfig {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    socket: Socket | null;
    soundManagerRef: React.MutableRefObject<any>;
    isChatOpenRef: React.MutableRefObject<boolean>;
    
    collisionBoxes?: CollisionBox[];
    collisionSystem?: CollisionSystem;
    bounds?: { maxRadius: number; groundLevel: number };
    interaction?: { position: THREE.Vector3; radius: number; onActivate: () => void };
    
    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    onChatToggle: (open: boolean) => void;
    onNearInteractionChange?: (isNear: boolean) => void;
    onProceduralDataUpdate?: (data: ProceduralAnimationData) => void;
    

    movementSpeed?: number;

    cameraConfig?: Partial<typeof CAMERA_CONFIG>;
    

    movementConfig?: Partial<typeof MOVEMENT_CONFIG>;
}

export function usePlayerController(config: PlayerControllerConfig) {
    const {
        containerRef, cameraRef, playerModelRef, socket, soundManagerRef,
        isChatOpenRef, collisionBoxes = [], collisionSystem, bounds, interaction,
        onLockChange, onExit, onChatToggle, onNearInteractionChange, onProceduralDataUpdate,
        movementSpeed, cameraConfig, movementConfig,
    } = config;

    const keyboard = useKeyboardInput({ isChatOpen: isChatOpenRef.current });
    const isMouseDownRef = useRef(false);

    const mouseLook = useMouseLook({
        containerRef,
        isChatOpenRef,
        onLockChange,
        isMouseDown: isMouseDownRef,
    });

    const physics = usePhysics({ 
        groundLevel: bounds?.groundLevel ?? 0 
    });

    const cameraController = useCameraController({
        ...CAMERA_CONFIG,
        ...cameraConfig,
    });

    const movement = useMovement({
        ...MOVEMENT_CONFIG,
        ...movementConfig,
        speed: movementConfig?.speed ?? movementSpeed ?? MOVEMENT_CONFIG.speed,
    });
    
    const footsteps = useFootstepSounds(soundManagerRef, { 
        interval: ANIMATION_CONFIG.footstepInterval 
    });

    const playerSync = usePlayerSync({
        socket,
        playerRef: playerModelRef,
        sendInterval: 100,
        minDistance: 0.1,
    });

    useKeyboardActions({
        isChatOpen: isChatOpenRef.current,
        canAct: () => true,
        onJump: physics.jump,
        onToggleChat: () => {
            const newState = !isChatOpenRef.current;
            onChatToggle(newState);
            if (newState && document.pointerLockElement) {
                document.exitPointerLock();
            }
        },
        onExit,
    });

    useMouseActions({
        containerRef,
        isChatOpen: isChatOpenRef.current,
        requestPointerLock: true,
        isMouseDown: isMouseDownRef,
    });

    const isNearInteractionRef = useRef(false);

    const update = (deltaTime: number): void => {
        const player = playerModelRef.current;
        const camera_ = cameraRef.current;
        if (!player || !camera_) return;

        const isChatOpen = isChatOpenRef.current;
        const groundOffset = PlayerModelLoader.getGroundOffset();
        
        physics.initialize(groundOffset);
        const newY = physics.update(deltaTime);
        player.position.y = newY;

        if (isChatOpen) {
            cameraController.update(
                { cameraRef, playerModelRef, yawRef: mouseLook.yawRef, pitchRef: mouseLook.pitchRef, collisionSystem },
                deltaTime,
            );
            return;
        }

        const inputDir = movement.getInputDirection(keyboard.keys);
        const isMoving = inputDir.lengthSq() > 0;

        if (isMoving) {
            const worldDir = movement.toWorldDirection(inputDir, mouseLook.yawRef.current);
            
            if (bounds) {
                applyMovementWithBounds(player, worldDir, deltaTime, bounds);
            } else if (collisionBoxes.length > 0) {
                movement.applyMovement(player, worldDir, deltaTime, collisionBoxes);
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

        if (interaction) {
            const dist = player.position.distanceTo(interaction.position);
            const wasNear = isNearInteractionRef.current;
            isNearInteractionRef.current = dist < interaction.radius;

            if (wasNear !== isNearInteractionRef.current) {
                onNearInteractionChange?.(isNearInteractionRef.current);
            }

            if (isNearInteractionRef.current && keyboard.keys.has('KeyE')) {
                interaction.onActivate();
                keyboard.keys.delete('KeyE');
            }
        }

        if (onProceduralDataUpdate) {
            onProceduralDataUpdate({
                isMoving,
                moveSpeed: isMoving ? 1 : 0,
                strafeInput: (keyboard.keys.has('KeyA') ? -1 : 0) + (keyboard.keys.has('KeyD') ? 1 : 0),
                playerYaw: player.rotation.y,
                cameraYaw: mouseLook.yawRef.current,
                cameraPitch: mouseLook.pitchRef.current,
            });
        }

        cameraController.update(
            { cameraRef, playerModelRef, yawRef: mouseLook.yawRef, pitchRef: mouseLook.pitchRef, collisionSystem },
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
        isNearInteraction: isNearInteractionRef.current,
    };
}