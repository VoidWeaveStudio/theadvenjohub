// src/features/game/hooks/types.ts
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { CollisionSystem } from '../map/CollisionSystem';
import { ProceduralAnimationData } from '../models/PlayerAnimator';
import { CameraConfig, MovementConfig } from '../config/gameConfig';

export interface BasePlayerControllerConfig {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    socket: Socket | null;
    soundManagerRef: React.MutableRefObject<any>;
    isChatOpenRef: React.MutableRefObject<boolean>;
    
    collisionBoxes?: CollisionBox[];
    collisionSystem?: CollisionSystem;
    bounds?: { maxRadius: number; groundLevel: number };
    
    interaction?: { 
        position: THREE.Vector3; 
        radius: number; 
        onActivate: () => void; 
    };
    onNearInteractionChange?: (isNear: boolean) => void;
    
    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    onChatToggle: (open: boolean) => void;
    onProceduralDataUpdate?: (data: ProceduralAnimationData) => void;
    
    cameraConfig?: Partial<CameraConfig>;
    movementConfig?: Partial<MovementConfig>;
}