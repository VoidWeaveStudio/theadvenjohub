// src/features/game/hooks/input/useKeyboardInput.ts
import { useEffect, useRef } from 'react';

export interface KeyboardInputState {
    keys: Set<string>;
    isKeyPressed: (code: string) => boolean;
}

interface UseKeyboardInputProps {
    blockedByChat?: string[];
    isChatOpen?: boolean;
}

export function useKeyboardInput({
    blockedByChat = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'],
    isChatOpen = false,
}: UseKeyboardInputProps = {}): KeyboardInputState {
    const keysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isChatOpen && blockedByChat.includes(e.code)) {
                return;
            }
            keysRef.current.add(e.code);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        const handleBlur = () => {
            keysRef.current.clear();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isChatOpen, blockedByChat]);

    return {
        keys: keysRef.current,
        isKeyPressed: (code: string) => keysRef.current.has(code),
    };
}