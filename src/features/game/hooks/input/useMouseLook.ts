// src/features/game/hooks/input/useMouseLook.ts
import { useEffect, useRef, MutableRefObject } from 'react';

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

const DEFAULT_CONFIG = {
    sensitivity: 0.003,
    minPitch: -1.2,
    maxPitch: 1.2,
};

export function useMouseLook(config: MouseLookConfig): MouseLookState {
    const {
        sensitivity = DEFAULT_CONFIG.sensitivity,
        minPitch = DEFAULT_CONFIG.minPitch,
        maxPitch = DEFAULT_CONFIG.maxPitch,
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