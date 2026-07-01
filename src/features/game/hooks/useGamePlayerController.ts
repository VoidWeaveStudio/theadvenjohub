// src/features/game/hooks/useGamePlayerController.ts
import * as THREE from 'three';
import { useBasePlayerController } from './useBasePlayerController';
import { GamePlayerControllerConfig } from './types';
import { useAmmoSystem } from './weapon/useAmmoSystem';
import { useAutoFire } from './weapon/useAutoFire';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';
import { LOBBY_CAMERA_CONFIG, LOBBY_MOVEMENT_CONFIG, WEAPON_CONFIG } from '../config/gameConfig';

export function useGamePlayerController(config: GamePlayerControllerConfig) {
    const baseController = useBasePlayerController({
        ...config,
        cameraConfig: LOBBY_CAMERA_CONFIG,
        movementConfig: LOBBY_MOVEMENT_CONFIG,
    });
    
    const ammo = useAmmoSystem(config.onAmmoChange, config.onReloadChange);

    const autoFire = useAutoFire(() => performShoot());

    function performShoot() {
        if (config.gameStatusRef.current !== 'playing') return;
        if (!ammo.consumeAmmo()) {
            autoFire.stop();
            return;
        }

        const camera = config.cameraRef.current;
        const player = config.playerModelRef.current;
        if (!camera || !player) return;

        config.soundManagerRef.current?.playShoot();

        const origin = new THREE.Vector3();
        player.getWorldPosition(origin);
        origin.y += WEAPON_CONFIG.muzzleOffsetY;

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion).normalize();

        config.socket?.emit('shoot', {
            origin: { x: origin.x, y: origin.y, z: origin.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: WEAPON_CONFIG.damage,
        });

        config.bulletPoolRef.current?.fire(origin, direction);

        if (config.socket?.id) {
            const animData = config.playerAnimationDataRef.current.get(config.socket.id);
            if (animData) {
                animData.isShooting = true;
                setTimeout(() => (animData.isShooting = false), WEAPON_CONFIG.shootingAnimationDuration);
            }
        }
    }

    useKeyboardActions({
        isChatOpen: config.isChatOpenRef.current,
        canAct: () => config.gameStatusRef.current === 'playing',
        onJump: baseController.physics.jump,
        onReload: ammo.reload,
        onToggleChat: () => {
            const newState = !config.isChatOpenRef.current;
            config.onChatToggle(newState);
            if (newState) {
                autoFire.stop();
                if (document.pointerLockElement) document.exitPointerLock();
            }
        },
        onExit: () => {
            autoFire.stop();
            config.onExit();
        },
    });

    useMouseActions({
        containerRef: config.containerRef,
        isChatOpen: config.isChatOpenRef.current,
        canAct: () => config.gameStatusRef.current === 'playing',
        isMouseDown: baseController.isMouseDownRef,
        onMouseDown: () => {
            baseController.isMouseDownRef.current = true;
            autoFire.start();
        },
        onMouseUp: () => {
            baseController.isMouseDownRef.current = false;
            autoFire.stop();
        },
    });

    const update = (deltaTime: number): void => {
        baseController.update(deltaTime);

        if (config.gameStatusRef.current !== 'playing') {
            return;
        }

        const player = config.playerModelRef.current;
        if (!player) return;

        const isMovingForward = baseController.keyboard.keys.has('KeyW');
        if (isMovingForward) {
            const targetYaw = baseController.mouseLook.yawRef.current;
            baseController.movement.rotateToward(player, targetYaw, deltaTime);
        }

        const inputDir = baseController.movement.getInputDirection(baseController.keyboard.keys);
        if (inputDir.lengthSq() > 0) {
            config.inputHistoryRef.current?.addInput(inputDir, false);
        }
    };

    return {
        ...baseController,
        update,
        ammo,
        autoFire,
    };
}