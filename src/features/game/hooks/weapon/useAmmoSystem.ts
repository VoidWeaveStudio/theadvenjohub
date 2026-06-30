// src/features/game/hooks/weapon/useAmmoSystem.ts

import { useRef, useCallback } from 'react';
import { WEAPON_CONFIG } from '../../config/gameConfig';

export interface AmmoSystemState {
    ammo: number;
    isReloading: boolean;
}

export function useAmmoSystem(
    onAmmoChange?: (ammo: number) => void,
    onReloadChange?: (isReloading: boolean) => void,
) {
    const ammoRef = useRef(WEAPON_CONFIG.maxAmmo);
    const isReloadingRef = useRef(false);
    const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const consumeAmmo = useCallback((): boolean => {
        if (isReloadingRef.current || ammoRef.current <= 0) {
            return false;
        }
        ammoRef.current -= 1;
        onAmmoChange?.(ammoRef.current);
        return true;
    }, [onAmmoChange]);

    const reload = useCallback((): boolean => {
        if (isReloadingRef.current || ammoRef.current >= WEAPON_CONFIG.maxAmmo) {
            return false;
        }

        isReloadingRef.current = true;
        onReloadChange?.(true);

        reloadTimerRef.current = setTimeout(() => {
            ammoRef.current = WEAPON_CONFIG.maxAmmo;
            isReloadingRef.current = false;
            onAmmoChange?.(WEAPON_CONFIG.maxAmmo);
            onReloadChange?.(false);
            reloadTimerRef.current = null;
        }, WEAPON_CONFIG.reloadTime);

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
        ammoRef.current = WEAPON_CONFIG.maxAmmo;
        onAmmoChange?.(WEAPON_CONFIG.maxAmmo);
    }, [cancelReload, onAmmoChange]);

    return {
        ammoRef,
        isReloadingRef,
        consumeAmmo,
        reload,
        cancelReload,
        reset,
    };
}