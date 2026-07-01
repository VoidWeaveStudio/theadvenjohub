// src/features/game/hooks/useLobbyPlayerController.ts
import { useRef } from 'react';
import * as THREE from 'three';
import { useBasePlayerController } from './useBasePlayerController';
import { LobbyPlayerControllerConfig } from './types';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';
import { LOBBY_CAMERA_CONFIG, LOBBY_MOVEMENT_CONFIG } from '../config/gameConfig';

export function useLobbyPlayerController(config: LobbyPlayerControllerConfig) {
    const baseController = useBasePlayerController({
        ...config,
        cameraConfig: {
            heightOffset: LOBBY_CAMERA_CONFIG.heightOffset,
        },
        movementConfig: {
            speed: LOBBY_MOVEMENT_CONFIG.speed,
            rotationSmoothness: LOBBY_MOVEMENT_CONFIG.rotationSmoothness,
        },
    });

    useKeyboardActions({
        isChatOpen: config.isChatOpenRef.current,
        canAct: () => true,
        onJump: baseController.physics.jump,
        onToggleChat: () => {
            const newState = !config.isChatOpenRef.current;
            config.onChatToggle(newState);
            if (newState && document.pointerLockElement) {
                document.exitPointerLock();
            }
        },
        onExit: config.onExit,
    });

    useMouseActions({
        containerRef: config.containerRef,
        isChatOpen: config.isChatOpenRef.current,
        requestPointerLock: true,
        isMouseDown: baseController.isMouseDownRef,
    });

    const isNearInteractionRef = useRef(false);

    const update = (deltaTime: number): void => {
        baseController.update(deltaTime);

        if (config.interaction) {
            const player = config.playerModelRef.current;
            if (!player) return;

            const dist = player.position.distanceTo(config.interaction.position);
            const wasNear = isNearInteractionRef.current;
            isNearInteractionRef.current = dist < config.interaction.radius;

            if (wasNear !== isNearInteractionRef.current) {
                config.onNearInteractionChange?.(isNearInteractionRef.current);
            }

            if (isNearInteractionRef.current && baseController.keyboard.keys.has('KeyE')) {
                config.interaction.onActivate();
                baseController.keyboard.keys.delete('KeyE');
            }
        }
    };

    return {
        ...baseController,
        update,
        isNearInteraction: isNearInteractionRef.current,
    };
}