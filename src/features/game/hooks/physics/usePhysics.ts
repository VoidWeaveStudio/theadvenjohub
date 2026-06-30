// src/features/game/hooks/physics/usePhysics.ts

import { useRef } from 'react';
import { PHYSICS_CONFIG, PhysicsConfig } from '../../config/gameConfig';

export type { PhysicsConfig };

export interface PhysicsState {
    velocityY: number;
    isOnGround: boolean;
    positionY: number;
}


export function usePhysics(config: Partial<PhysicsConfig> = {}) {
    const finalConfig = { ...PHYSICS_CONFIG, ...config };
    const { gravity, jumpForce, groundLevel } = finalConfig;

    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);
    const positionYRef = useRef(groundLevel);
    const initializedRef = useRef(false);


    const update = (deltaTime: number): number => {
        if (!isOnGroundRef.current) {
            velocityYRef.current += gravity * deltaTime;
            positionYRef.current += velocityYRef.current * deltaTime;

            if (positionYRef.current <= groundLevel) {
                positionYRef.current = groundLevel;
                velocityYRef.current = 0;
                isOnGroundRef.current = true;
            }
        }
        return positionYRef.current;
    };


    const jump = (): void => {
        if (isOnGroundRef.current) {
            velocityYRef.current = jumpForce;
            isOnGroundRef.current = false;
        }
    };


    const reset = (y: number = groundLevel): void => {
        positionYRef.current = y;
        velocityYRef.current = 0;
        isOnGroundRef.current = true;
        initializedRef.current = true;
    };


    const initialize = (y: number): void => {
        if (!initializedRef.current) {
            positionYRef.current = y;
            initializedRef.current = true;
        }
    };

    return {
        velocityYRef,
        isOnGroundRef,
        positionYRef,
        update,
        jump,
        reset,
        initialize,
        config: finalConfig,
    };
}