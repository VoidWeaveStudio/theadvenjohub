//src\features\game\hooks\useShooting.ts
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { BulletPool } from '../BulletPool';
import { SoundManager } from '../SoundManager';
import { WeaponModel } from '../models/WeaponModel';
import { FIRE_RATE, MAX_AMMO, RELOAD_TIME } from '../constants';
import { PlayerAnimationData } from '../types';

interface UseShootingProps {
    socket: Socket | null;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;  // ✅ Добавлено
    bulletPoolRef: React.MutableRefObject<BulletPool | null>;
    soundManagerRef: React.MutableRefObject<SoundManager | null>;
    gameStatusRef: React.MutableRefObject<'waiting' | 'playing' | 'ended'>;
    isMouseDownRef: React.MutableRefObject<boolean>;
    playersRef: React.MutableRefObject<Map<string, THREE.Group>>;
    playerAnimationDataRef: React.MutableRefObject<Map<string, PlayerAnimationData>>;
    onAmmoChange: (ammo: number) => void;
    onReloadChange: (isReloading: boolean) => void;
}

export function useShooting({
    socket, 
    cameraRef, 
    playerModelRef,  
    bulletPoolRef, 
    soundManagerRef,
    gameStatusRef, 
    isMouseDownRef, 
    playersRef, 
    playerAnimationDataRef,
    onAmmoChange, 
    onReloadChange
}: UseShootingProps) {
    const ammoRef = useRef(MAX_AMMO);
    const isReloadingRef = useRef(false);
    const shootIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const stopAutoFire = useCallback(() => {
        if (shootIntervalRef.current) {
            clearInterval(shootIntervalRef.current);
            shootIntervalRef.current = null;
        }
        isMouseDownRef.current = false;
    }, []);

    const performShoot = useCallback(() => {
        if (
            isReloadingRef.current ||
            ammoRef.current <= 0 ||
            !cameraRef.current ||
            !socket ||
            gameStatusRef.current !== 'playing'
        ) {
            if (ammoRef.current <= 0) stopAutoFire();
            return;
        }

        const newAmmo = ammoRef.current - 1;
        ammoRef.current = newAmmo;
        onAmmoChange(newAmmo);

        soundManagerRef.current?.playShoot();

        // ✅ ИСПРАВЛЕНО: используем playerModelRef вместо cameraRef
        const origin = WeaponModel.getMuzzlePosition(playerModelRef.current);

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraRef.current.quaternion);
        direction.normalize();

        socket.emit('shoot', {
            origin,
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: 25,
        });

        bulletPoolRef.current?.fire(origin, direction);

        if (socket.id) {
            const animData = playerAnimationDataRef.current.get(socket.id);
            if (animData) {
                animData.isShooting = true;
                setTimeout(() => {
                    if (animData) animData.isShooting = false;
                }, 200);
            }
        }

        if (newAmmo <= 0) stopAutoFire();
    }, [socket, cameraRef, playerModelRef, bulletPoolRef, soundManagerRef, gameStatusRef,
        playerAnimationDataRef, onAmmoChange, stopAutoFire]);

    const startAutoFire = useCallback(() => {
        if (shootIntervalRef.current) return;
        performShoot();
        shootIntervalRef.current = setInterval(performShoot, FIRE_RATE);
    }, [performShoot]);

    const reload = useCallback(() => {
        if (isReloadingRef.current || ammoRef.current >= MAX_AMMO) return;

        isReloadingRef.current = true;
        onReloadChange(true);
        stopAutoFire();
        soundManagerRef.current?.playReload();

        if (socket?.id) {
            const animData = playerAnimationDataRef.current.get(socket.id);
            if (animData) animData.isReloading = true;
        }

        setTimeout(() => {
            ammoRef.current = MAX_AMMO;
            onAmmoChange(MAX_AMMO);
            isReloadingRef.current = false;
            onReloadChange(false);

            if (socket?.id) {
                const animData = playerAnimationDataRef.current.get(socket.id);
                if (animData) animData.isReloading = false;
            }
        }, RELOAD_TIME);
    }, [soundManagerRef, stopAutoFire, onAmmoChange, onReloadChange, socket, playerAnimationDataRef]);

    useEffect(() => {
        return () => stopAutoFire();
    }, [stopAutoFire]);

    return { ammoRef, isReloadingRef, shootIntervalRef, startAutoFire, stopAutoFire, reload };
}