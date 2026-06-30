// src/features/game/hooks/input/useMouseLook.ts

import { useEffect, useRef, MutableRefObject } from 'react';
import { MOUSE_CONFIG, MouseConfig } from '../../config/gameConfig';

export interface MouseLookState {
    yawRef: MutableRefObject<number>;
    pitchRef: MutableRefObject<number>;
    isLockedRef: MutableRefObject<boolean>;
}

export interface MouseLookConfig {
    sensitivity?: number;
    minPitch?: number;
    maxPitch?: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isChatOpenRef?: MutableRefObject<boolean>;
    onLockChange?: (locked: boolean) => void;
    isMouseDown?: MutableRefObject<boolean>;
}

export type { MouseConfig };

export function useMouseLook(config: MouseLookConfig): MouseLookState {
    const {
        sensitivity = MOUSE_CONFIG.sensitivity,
        minPitch = MOUSE_CONFIG.minPitch,
        maxPitch = MOUSE_CONFIG.maxPitch,
        containerRef,
        isChatOpenRef,
        onLockChange,
        isMouseDown, 
    } = config;

    const yawRef = useRef(0);
    const pitchRef = useRef(0);
    const isLockedRef = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isChatOpenRef?.current) return; 

            if (!isLockedRef.current && !isMouseDown?.current) return;

            yawRef.current -= e.movementX * sensitivity;
            pitchRef.current += e.movementY * sensitivity;
            pitchRef.current = Math.max(minPitch, Math.min(maxPitch, pitchRef.current));
        };

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === container;
            isLockedRef.current = locked;
            onLockChange?.(locked);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('pointerlockchange', handlePointerLockChange);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
        };
    }, [containerRef, sensitivity, minPitch, maxPitch, onLockChange, isMouseDown, isChatOpenRef]);

    return {
        yawRef,
        pitchRef,
        isLockedRef,
    };
}