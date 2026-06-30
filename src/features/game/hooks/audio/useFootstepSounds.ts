// src/features/game/hooks/audio/useFootstepSounds.ts
import { useRef } from 'react';
import { SoundManager } from '../../SoundManager';

export interface FootstepConfig {
    interval?: number; 
}

export function useFootstepSounds(
    soundManagerRef: React.MutableRefObject<SoundManager | null>,
    config: FootstepConfig = {},
) {
    const { interval = 0.35 } = config;
    const timerRef = useRef(0);

    const update = (deltaTime: number, isMoving: boolean, isOnGround: boolean): void => {
        if (!isMoving || !isOnGround) {
            timerRef.current = 0;
            return;
        }

        timerRef.current += deltaTime;
        if (timerRef.current >= interval) {
            soundManagerRef.current?.playFootstep();
            timerRef.current = 0;
        }
    };

    const reset = (): void => {
        timerRef.current = 0;
    };

    return { update, reset };
}