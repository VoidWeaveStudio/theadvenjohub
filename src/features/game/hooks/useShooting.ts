import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { BulletPool } from '../BulletPool';
import { SoundManager } from '../SoundManager';
import { FIRE_RATE, MAX_AMMO, RELOAD_TIME } from '../constants';

interface UseShootingProps {
    socket: Socket | null;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    bulletPoolRef: React.MutableRefObject<BulletPool | null>;
    soundManagerRef: React.MutableRefObject<SoundManager | null>;
    gameStatusRef: React.MutableRefObject<'waiting' | 'playing' | 'ended'>;
    isMouseDownRef: React.MutableRefObject<boolean>;
    onAmmoChange: (ammo: number) => void;
    onReloadChange: (isReloading: boolean) => void;
}

export function useShooting({
    socket,
    cameraRef,
    bulletPoolRef,
    soundManagerRef,
    gameStatusRef,
    isMouseDownRef,
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
            if (ammoRef.current <= 0) {
                stopAutoFire();
            }
            return;
        }

        const newAmmo = ammoRef.current - 1;
        ammoRef.current = newAmmo;
        onAmmoChange(newAmmo);

        soundManagerRef.current?.playShoot();

        const origin = {
            x: cameraRef.current.position.x,
            y: cameraRef.current.position.y,
            z: cameraRef.current.position.z
        };

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraRef.current.quaternion);

        socket.emit('shoot', {
            origin,
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: 25
        });

        bulletPoolRef.current?.fire(origin, direction);

        if (newAmmo <= 0) {
            stopAutoFire();
        }
    }, [socket, cameraRef, bulletPoolRef, soundManagerRef, gameStatusRef, onAmmoChange, stopAutoFire]);

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

        setTimeout(() => {
            ammoRef.current = MAX_AMMO;
            onAmmoChange(MAX_AMMO);
            isReloadingRef.current = false;
            onReloadChange(false);
        }, RELOAD_TIME);
    }, [soundManagerRef, stopAutoFire, onAmmoChange, onReloadChange]);

    useEffect(() => {
        return () => {
            stopAutoFire();
        };
    }, [stopAutoFire]);

    return {
        ammoRef,
        isReloadingRef,
        shootIntervalRef,
        startAutoFire,
        stopAutoFire,
        reload
    };
}