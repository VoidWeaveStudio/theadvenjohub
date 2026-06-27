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

        const origin = WeaponModel.getMuzzlePosition(cameraRef.current);

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraRef.current.quaternion);

        const raycaster = new THREE.Raycaster();
        raycaster.set(
            new THREE.Vector3(
                cameraRef.current.position.x,
                cameraRef.current.position.y,
                cameraRef.current.position.z
            ),
            direction
        );
        
        const playerMeshes: THREE.Object3D[] = [];
        playersRef.current.forEach((model, playerId) => {
            if (playerId !== socket.id) {
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) playerMeshes.push(child);
                });
            }
        });

        const intersects = raycaster.intersectObjects(playerMeshes, true);
        let targetId: string | undefined = undefined;

        if (intersects.length > 0) {
            let current: THREE.Object3D | null = intersects[0].object;
            while (current) {
                if (current.userData?.playerId) {
                    targetId = current.userData.playerId;
                    break;
                }
                current = current.parent;
            }
        }

        socket.emit('shoot', {
            origin, 
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: 25,
            targetId
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

        const weapon = cameraRef.current.getObjectByName('weapon') as THREE.Group;
        if (weapon) {
            const body = weapon.children[0] as THREE.Mesh;
            if (body) {
                body.position.z = -0.25;
                setTimeout(() => {
                    if (body) body.position.z = -0.3; 
                }, 50);
            }
        }

        if (newAmmo <= 0) stopAutoFire();
    }, [socket, cameraRef, bulletPoolRef, soundManagerRef, gameStatusRef, playersRef, playerAnimationDataRef, onAmmoChange, stopAutoFire]);

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
            if (animData) {
                animData.isReloading = true;
            }
        }

        setTimeout(() => {
            ammoRef.current = MAX_AMMO;
            onAmmoChange(MAX_AMMO);
            isReloadingRef.current = false;
            onReloadChange(false);

            if (socket?.id) {
                const animData = playerAnimationDataRef.current.get(socket.id);
                if (animData) {
                    animData.isReloading = false;
                }
            }
        }, RELOAD_TIME);
    }, [soundManagerRef, stopAutoFire, onAmmoChange, onReloadChange, socket, playerAnimationDataRef]);

    useEffect(() => {
        return () => stopAutoFire();
    }, [stopAutoFire]);

    return { ammoRef, isReloadingRef, shootIntervalRef, startAutoFire, stopAutoFire, reload };
}