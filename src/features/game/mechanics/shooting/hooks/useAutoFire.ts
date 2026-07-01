import { useRef, useCallback, useEffect } from 'react';
import { SHOOTING_CONFIG } from '../config';

export function useAutoFire(onFire: () => void) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  const start = useCallback((): void => {
    if (intervalRef.current || isActiveRef.current) return;
    isActiveRef.current = true;
    onFire();
    intervalRef.current = setInterval(onFire, SHOOTING_CONFIG.fireRate);
  }, [onFire]);

  const stop = useCallback((): void => {
    isActiveRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, isActiveRef };
}