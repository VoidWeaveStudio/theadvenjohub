// src/features/game/hooks/useLobbyController.ts

import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { ProceduralAnimationData } from '../models/PlayerAnimator';
import { usePlayerController } from './usePlayerController';

import { LOBBY_CAMERA_CONFIG, LOBBY_MOVEMENT_CONFIG } from '../config/gameConfig';

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

export function useLobbyController(props: UseLobbyControllerProps) {
    const {
        containerRef, cameraRef, playerModelRef, socket, soundManagerRef,
        isChatOpenRef, bounds, interaction,
        onLockChange, onExit, onChatToggle, onNearInteractionChange,
        onProceduralDataUpdate,
    } = props;

    return usePlayerController({
        containerRef,
        cameraRef,
        playerModelRef,
        socket,
        soundManagerRef,
        isChatOpenRef,
        bounds,
        interaction,
        onLockChange,
        onExit,
        onChatToggle,
        onNearInteractionChange,
        onProceduralDataUpdate,
        cameraConfig: {
            heightOffset: LOBBY_CAMERA_CONFIG.heightOffset,
        },
        movementConfig: {
            speed: LOBBY_MOVEMENT_CONFIG.speed,
            rotationSmoothness: LOBBY_MOVEMENT_CONFIG.rotationSmoothness,
        },
    });
}