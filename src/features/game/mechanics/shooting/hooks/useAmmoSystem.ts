//src\features\game\mechanics\shooting\hooks\useAmmoSystem.ts
import { useRef, useCallback } from 'react';
import { SHOOTING_CONFIG } from '../config';

export function useAmmoSystem(
  onAmmoChange?: (ammo: number) => void,
  onReloadChange?: (isReloading: boolean) => void,
) {
  const ammoRef = useRef(SHOOTING_CONFIG.maxAmmo);
  const isReloadingRef = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const consumeAmmo = useCallback((): boolean => {
    if (isReloadingRef.current || ammoRef.current <= 0) return false;
    ammoRef.current -= 1;
    onAmmoChange?.(ammoRef.current);
    return true;
  }, [onAmmoChange]);

  const reload = useCallback((): boolean => {
    if (isReloadingRef.current || ammoRef.current >= SHOOTING_CONFIG.maxAmmo) return false;
    isReloadingRef.current = true;
    onReloadChange?.(true);
    reloadTimerRef.current = setTimeout(() => {
      ammoRef.current = SHOOTING_CONFIG.maxAmmo;
      isReloadingRef.current = false;
      onAmmoChange?.(SHOOTING_CONFIG.maxAmmo);
      onReloadChange?.(false);
      reloadTimerRef.current = null;
    }, SHOOTING_CONFIG.reloadTime);
    return true;
  }, [onAmmoChange, onReloadChange]);

  const cancelReload = useCallback((): void => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    isReloadingRef.current = false;
    onReloadChange?.(false);
  }, [onReloadChange]);

  const reset = useCallback((): void => {
    cancelReload();
    ammoRef.current = SHOOTING_CONFIG.maxAmmo;
    onAmmoChange?.(SHOOTING_CONFIG.maxAmmo);
  }, [cancelReload, onAmmoChange]);

  return { ammoRef, isReloadingRef, consumeAmmo, reload, cancelReload, reset };
}