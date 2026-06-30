//src\features\game\hooks\useLobbyController.ts
import { useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';

import { useKeyboardInput } from './input/useKeyboardInput';
import { useMouseLook } from './input/useMouseLook';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';

import { usePhysics } from './physics/usePhysics';
import { useCamera } from './camera/useCamera';
import { useMovement, PlayerMovement } from './movement/useMovement';
import { useFootstepSounds } from './audio/useFootstepSounds';
import { usePlayerSync } from './network/usePlayerSync';

import { ProceduralAnimationData } from '../models/PlayerAnimator';

export interface LobbyBounds {
    maxRadius: number;
    groundLevel: number;
}

export interface LobbyInteraction {
    position: THREE.Vector3;
    radius: number;
    onActivate: () => void;
}

interface UseLobbyControllerProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    socket: Socket | null;
    soundManagerRef: React.MutableRefObject<any>;
    isChatOpenRef: React.MutableRefObject<boolean>;

    bounds?: LobbyBounds;
    interaction?: LobbyInteraction;

    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    onChatToggle: (open: boolean) => void;
    onNearInteractionChange?: (isNear: boolean) => void;
    onProceduralDataUpdate?: (data: ProceduralAnimationData) => void;
}

const DEFAULT_BOUNDS: LobbyBounds = {
    maxRadius: 45,
    groundLevel: 0,
};

export function useLobbyController(props: UseLobbyControllerProps) {
    const {
        containerRef, cameraRef, playerModelRef, socket, soundManagerRef,
        isChatOpenRef, bounds = DEFAULT_BOUNDS, interaction,
        onLockChange, onExit, onChatToggle, onNearInteractionChange,
        onProceduralDataUpdate,
    } = props;

    const keyboard = useKeyboardInput({ isChatOpen: isChatOpenRef.current });

    const isMouseDownRef = useRef(false);

    const mouseLook = useMouseLook({
        containerRef,
        isChatOpenRef, 
        onLockChange,
        isMouseDown: isMouseDownRef,
    });

    const physics = usePhysics({ groundLevel: bounds.groundLevel });

    const camera = useCamera({
        distance: 6.0,
        heightOffset: 2.5,
        focusPointOffset: 1.2,
        smoothing: 8,
    });

    const movement = useMovement({ speed: 5, rotationSmoothness: 12 });
    const footsteps = useFootstepSounds(soundManagerRef, { interval: 0.4 });

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

        const newY = physics.update(deltaTime);
        player.position.y = newY;

        if (isChatOpen) {
            updateCameraOnly(player, camera_, deltaTime);
            return;
        }

        const inputDir = movement.getInputDirection(keyboard.keys);
        const isMoving = inputDir.lengthSq() > 0;

        if (isMoving) {
            const worldDir = movement.toWorldDirection(inputDir, mouseLook.yawRef.current);
            applyMovementWithBounds(player, worldDir, deltaTime, bounds);
            movement.rotateToward(player, mouseLook.yawRef.current, deltaTime);

            playerSync.sendIfChanged(player.position, player.rotation);
        } else {
            movement.rotateToward(player, mouseLook.yawRef.current, deltaTime);
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
            const aimDirection = new THREE.Vector3(
                -Math.sin(mouseLook.yawRef.current),
                -Math.sin(mouseLook.pitchRef.current),
                -Math.cos(mouseLook.yawRef.current),
            ).normalize();

            onProceduralDataUpdate({
                isMoving,
                moveSpeed: isMoving ? 1 : 0,
                strafeInput: (keyboard.keys.has('KeyA') ? -1 : 0) + (keyboard.keys.has('KeyD') ? 1 : 0),
                aimDirection,
            });
        }

        updateCameraOnly(player, camera_, deltaTime);
    };

    const updateCameraOnly = (
        player: THREE.Group,
        camera_: THREE.PerspectiveCamera,
        deltaTime: number,
    ): void => {
        const targetPos = camera.computeDesiredPosition(
            player.position,
            mouseLook.yawRef.current,
            mouseLook.pitchRef.current,
            [],
        );

        const focusPoint = new THREE.Vector3(
            player.position.x,
            player.position.y + 1.0,
            player.position.z,
        );

        camera.applyToCamera(camera_, targetPos, focusPoint, deltaTime);
    };

    const applyMovementWithBounds = (
        player: THREE.Group,
        worldDir: THREE.Vector3,
        deltaTime: number,
        bounds: LobbyBounds,
    ): void => {
        if (worldDir.lengthSq() < 1e-6) return;
        worldDir.normalize();

        const speed = 5 * deltaTime;
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
        camera,
        movement,
        keyboard,
        mouseLook,
        isNearInteraction: isNearInteractionRef.current,
    };
}