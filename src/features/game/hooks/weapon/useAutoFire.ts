// src/features/game/hooks/weapon/useAutoFire.ts
import { useRef, useCallback, useEffect } from 'react';
import { FIRE_RATE } from '../../constants';

export function useAutoFire(onFire: () => void) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isActiveRef = useRef(false);

    const start = useCallback((): void => {
        if (intervalRef.current || isActiveRef.current) return;
        isActiveRef.current = true;

        onFire();
        intervalRef.current = setInterval(onFire, FIRE_RATE);
    }, [onFire]);

    const stop = useCallback((): void => {
        isActiveRef.current = false;
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => stop();
    }, [stop]);

    return { start, stop, isActiveRef };
}