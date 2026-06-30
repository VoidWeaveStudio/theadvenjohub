// src/features/game/hooks/weapon/useAmmoSystem.ts
import { useRef, useCallback } from 'react';
import { MAX_AMMO, RELOAD_TIME } from '../../constants';

export interface AmmoSystemState {
    ammo: number;
    isReloading: boolean;
}

export function useAmmoSystem(
    onAmmoChange?: (ammo: number) => void,
    onReloadChange?: (isReloading: boolean) => void,
) {
    const ammoRef = useRef(MAX_AMMO);
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
        if (isReloadingRef.current || ammoRef.current >= MAX_AMMO) {
            return false;
        }

        isReloadingRef.current = true;
        onReloadChange?.(true);

        reloadTimerRef.current = setTimeout(() => {
            ammoRef.current = MAX_AMMO;
            isReloadingRef.current = false;
            onAmmoChange?.(MAX_AMMO);
            onReloadChange?.(false);
            reloadTimerRef.current = null;
        }, RELOAD_TIME);

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
        ammoRef.current = MAX_AMMO;
        onAmmoChange?.(MAX_AMMO);
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