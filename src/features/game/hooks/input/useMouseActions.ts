// src/features/game/hooks/input/useMouseActions.ts
import { useEffect, useRef } from 'react';

export interface MouseActions {
    containerRef: React.RefObject<HTMLDivElement | null>;
    onMouseDown?: () => void;
    onMouseUp?: () => void;
    requestPointerLock?: boolean;
    isChatOpen?: boolean;
    canAct?: () => boolean;
    isMouseDown?: React.MutableRefObject<boolean>; 
}

export function useMouseActions(config: MouseActions): void {
    const {
        containerRef,
        onMouseDown,
        onMouseUp,
        requestPointerLock = true,
        isChatOpen = false,
        canAct,
        isMouseDown, 
    } = config;

    const isMouseDownRef = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (isChatOpen) return;

            if (requestPointerLock && !document.pointerLockElement) {
                container.requestPointerLock();
                return;
            }

            if (canAct && !canAct()) return;

            isMouseDownRef.current = true;
            if (isMouseDown) isMouseDown.current = true; 
            onMouseDown?.();
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) return;
            isMouseDownRef.current = false;
            if (isMouseDown) isMouseDown.current = false;
            onMouseUp?.();
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [containerRef, onMouseDown, onMouseUp, requestPointerLock, isChatOpen, canAct, isMouseDown]);
}