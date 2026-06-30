// src/features/game/hooks/physics/usePhysics.ts
import { useRef } from 'react';

export interface PhysicsState {
    velocityY: number;
    isOnGround: boolean;
    positionY: number;
}

export interface PhysicsConfig {
    gravity?: number;
    jumpForce?: number;
    groundLevel?: number;
}

const DEFAULT_PHYSICS: Required<PhysicsConfig> = {
    gravity: -20.0,
    jumpForce: 8.0,
    groundLevel: 0,
};

export function usePhysics(config: PhysicsConfig = {}) {
    const { gravity, jumpForce, groundLevel } = { ...DEFAULT_PHYSICS, ...config };

    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);
    const positionYRef = useRef(groundLevel);

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
    };

    return {
        velocityYRef,
        isOnGroundRef,
        positionYRef,
        update,
        jump,
        reset,
    };
}