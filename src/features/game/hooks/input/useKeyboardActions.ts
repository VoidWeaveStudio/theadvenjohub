// src/features/game/hooks/input/useKeyboardActions.ts
import { useEffect } from 'react';

export interface KeyboardActions {
    onJump?: () => void;
    onReload?: () => void;
    onToggleChat?: () => void;
    onExit?: () => void;
    canAct?: () => boolean;
    isChatOpen?: boolean;
}

export function useKeyboardActions(actions: KeyboardActions): void {
    const { onJump, onReload, onToggleChat, onExit, canAct, isChatOpen } = actions;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;

            if (e.code === 'Escape') {
                if (isChatOpen) {
                    onToggleChat?.();
                } else {
                    if (document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                    onExit?.();
                }
                return;
            }

            if (isChatOpen) return;
            if (canAct && !canAct()) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    onJump?.();
                    break;
                case 'KeyR':
                    onReload?.();
                    break;
                case 'KeyY':
                    onToggleChat?.();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onJump, onReload, onToggleChat, onExit, canAct, isChatOpen]);
}