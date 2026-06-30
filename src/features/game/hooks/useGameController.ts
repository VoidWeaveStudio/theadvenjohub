// src/features/game/hooks/useGameController.ts

import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { CollisionSystem } from '../map/CollisionSystem';
import { InputHistory } from '../network/InputHistory';
import { ProceduralAnimationData } from '../models/PlayerAnimator';
import { PlayerModelLoader } from '../models/PlayerModelLoader';

import { GAME_CAMERA_CONFIG, GAME_MOVEMENT_CONFIG, ANIMATION_CONFIG } from '../config/gameConfig';

import { useKeyboardInput } from './input/useKeyboardInput';
import { useMouseLook } from './input/useMouseLook';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';

import { usePhysics } from './physics/usePhysics';
import { useCameraController } from './camera/useCameraController';
import { useMovement } from './movement/useMovement';
import { useFootstepSounds } from './audio/useFootstepSounds';

import { useAmmoSystem } from './weapon/useAmmoSystem';
import { useAutoFire } from './weapon/useAutoFire';
import { usePlayerSync } from './network/usePlayerSync';

interface UseGameControllerProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    socket: Socket | null;
    collisionBoxes: CollisionBox[];
    collisionSystem: CollisionSystem;
    gameStatusRef: React.MutableRefObject<'waiting' | 'playing' | 'ended'>;
    isChatOpenRef: React.MutableRefObject<boolean>;
    isMouseDownRef: React.MutableRefObject<boolean>;
    bulletPoolRef: React.MutableRefObject<any>;
    soundManagerRef: React.MutableRefObject<any>;
    inputHistoryRef: React.MutableRefObject<InputHistory | null>;
    playerAnimationDataRef: React.MutableRefObject<Map<string, any>>;
    playersRef: React.MutableRefObject<Map<string, THREE.Group>>;

    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    onChatToggle: (open: boolean) => void;
    onAmmoChange: (ammo: number) => void;
    onReloadChange: (isReloading: boolean) => void;
    onProceduralDataUpdate: (data: ProceduralAnimationData) => void;
}

export function useGameController(props: UseGameControllerProps) {
    const {
        containerRef, cameraRef, playerModelRef, socket, collisionBoxes, collisionSystem,
        gameStatusRef, isChatOpenRef, isMouseDownRef, bulletPoolRef,
        soundManagerRef, inputHistoryRef, playerAnimationDataRef,
        onLockChange, onExit, onChatToggle, onAmmoChange, onReloadChange,
        onProceduralDataUpdate,
    } = props;

    const keyboard = useKeyboardInput({
        isChatOpen: isChatOpenRef.current,
    });

    const mouseLook = useMouseLook({
        containerRef,
        isChatOpenRef,
        onLockChange,
    });

    const physics = usePhysics();
    const cameraController = useCameraController(GAME_CAMERA_CONFIG);
    const movement = useMovement(GAME_MOVEMENT_CONFIG);
    const footsteps = useFootstepSounds(soundManagerRef, { 
        interval: ANIMATION_CONFIG.footstepInterval 
    });

    const ammo = useAmmoSystem(onAmmoChange, onReloadChange);

    const performShoot = () => {
        if (gameStatusRef.current !== 'playing') return;
        if (!ammo.consumeAmmo()) {
            autoFire.stop();
            return;
        }

        const camera_ = cameraRef.current;
        const player = playerModelRef.current;
        if (!camera_ || !player) return;

        soundManagerRef.current?.playShoot();

        const origin = new THREE.Vector3();
        player.getWorldPosition(origin);
        origin.y += 1.5;

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera_.quaternion).normalize();

        socket?.emit('shoot', {
            origin: { x: origin.x, y: origin.y, z: origin.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: 25,
        });

        bulletPoolRef.current?.fire(origin, direction);

        if (socket?.id) {
            const animData = playerAnimationDataRef.current.get(socket.id);
            if (animData) {
                animData.isShooting = true;
                setTimeout(() => (animData.isShooting = false), 200);
            }
        }
    };

    const autoFire = useAutoFire(performShoot);
    const playerSync = usePlayerSync({ socket, playerRef: playerModelRef });

    useKeyboardActions({
        isChatOpen: isChatOpenRef.current,
        canAct: () => gameStatusRef.current === 'playing',
        onJump: physics.jump,
        onReload: ammo.reload,
        onToggleChat: () => {
            const newState = !isChatOpenRef.current;
            onChatToggle(newState);
            if (newState) {
                autoFire.stop();
                if (document.pointerLockElement) document.exitPointerLock();
            }
        },
        onExit: () => {
            autoFire.stop();
            onExit();
        },
    });

    useMouseActions({
        containerRef,
        isChatOpen: isChatOpenRef.current,
        canAct: () => gameStatusRef.current === 'playing',
        onMouseDown: () => {
            isMouseDownRef.current = true;
            autoFire.start();
        },
        onMouseUp: () => {
            isMouseDownRef.current = false;
            autoFire.stop();
        },
    });

    const update = (deltaTime: number): void => {
        const player = playerModelRef.current;
        const camera_ = cameraRef.current;
        if (!player || !camera_) return;

        const isPlaying = gameStatusRef.current === 'playing';
        const isChatOpen = isChatOpenRef.current;

        const currentY = player.position.y;
        const groundOffset = PlayerModelLoader.getGroundOffset();

        physics.initialize(player.position.y);
        const newY = physics.update(deltaTime);
        player.position.y = newY;

        if (!isPlaying || isChatOpen) {
            cameraController.update(
                { cameraRef, playerModelRef, yawRef: mouseLook.yawRef, pitchRef: mouseLook.pitchRef, collisionSystem },
                deltaTime,
            );
            return;
        }

        const inputDir = movement.getInputDirection(keyboard.keys);
        const isMoving = inputDir.lengthSq() > 0;
        const isMovingForward = keyboard.keys.has('KeyW');

        let targetYaw = player.rotation.y;
        if (isMovingForward) {
            targetYaw = mouseLook.yawRef.current;
        }

        if (isMoving) {
            const worldDir = movement.toWorldDirection(inputDir, mouseLook.yawRef.current);
            movement.applyMovement(player, worldDir, deltaTime, collisionBoxes);
            movement.rotateToward(player, targetYaw, deltaTime);

            playerSync.sendIfChanged(player.position, player.rotation);
            inputHistoryRef.current?.addInput(inputDir, false);
        } else {
            movement.rotateToward(player, targetYaw, deltaTime);
        }

        footsteps.update(deltaTime, isMoving, physics.isOnGroundRef.current);

        onProceduralDataUpdate({
            isMoving,
            moveSpeed: isMoving ? 1 : 0,
            strafeInput: (keyboard.keys.has('KeyA') ? -1 : 0) + (keyboard.keys.has('KeyD') ? 1 : 0),
            playerYaw: player.rotation.y,
            cameraYaw: mouseLook.yawRef.current,
            cameraPitch: mouseLook.pitchRef.current,
        });

        cameraController.update(
            { cameraRef, playerModelRef, yawRef: mouseLook.yawRef, pitchRef: mouseLook.pitchRef, collisionSystem },
            deltaTime,
        );
    };

    return {
        update,
        physics,
        camera: cameraController.camera,
        movement,
        ammo,
        autoFire,
        keyboard,
        mouseLook,
    };
}