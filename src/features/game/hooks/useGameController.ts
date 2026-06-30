//src\features\game\hooks\useGameController.ts
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { InputHistory } from '../network/InputHistory';
import { ProceduralAnimationData } from '../models/PlayerAnimator';

import { useKeyboardInput } from './input/useKeyboardInput';
import { useMouseLook } from './input/useMouseLook';
import { useKeyboardActions } from './input/useKeyboardActions';
import { useMouseActions } from './input/useMouseActions';

import { usePhysics } from './physics/usePhysics';
import { useCamera, ThirdPersonCamera } from './camera/useCamera';
import { useMovement, PlayerMovement } from './movement/useMovement';
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
        containerRef, cameraRef, playerModelRef, socket, collisionBoxes,
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
    const camera = useCamera();
    const movement = useMovement();
    const footsteps = useFootstepSounds(soundManagerRef);

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

        const newY = physics.update(deltaTime);
        player.position.y = newY;

        if (!isPlaying || isChatOpen) {
            updateCameraOnly(player, camera_, deltaTime);
            return;
        }

        const inputDir = movement.getInputDirection(keyboard.keys);
        const isMoving = inputDir.lengthSq() > 0;

        if (isMoving) {
            const worldDir = movement.toWorldDirection(inputDir, mouseLook.yawRef.current);
            movement.applyMovement(player, worldDir, deltaTime, collisionBoxes);
            movement.rotateToward(player, mouseLook.yawRef.current, deltaTime);

            playerSync.sendIfChanged(player.position, player.rotation);

            inputHistoryRef.current?.addInput(inputDir, false);
        } else {
            movement.rotateToward(player, mouseLook.yawRef.current, deltaTime);
        }

        footsteps.update(deltaTime, isMoving, physics.isOnGroundRef.current);

        const aimDirection = new THREE.Vector3(
            -Math.sin(mouseLook.yawRef.current),
            -Math.sin(mouseLook.pitchRef.current),
            -Math.cos(mouseLook.yawRef.current),
        ).normalize();

        onProceduralDataUpdate({
            isMoving,
            moveSpeed: isMoving ? 1 : 0,
            strafeInput: (keyboard.keys.has('KeyA') ? -1 : 0) + (keyboard.keys.has('KeyD') ? 1 : 0),
            aimDirection,
        });

        updateCameraOnly(player, camera_, deltaTime);
    };

    const updateCameraOnly = (
        player: THREE.Group,
        camera_: THREE.PerspectiveCamera,
        deltaTime: number,
    ): void => {
        const targetPos = camera.computeDesiredPosition(
            player.position,
            mouseLook.yawRef.current,
            mouseLook.pitchRef.current,
            collisionBoxes,
        );
        const focusPoint = new THREE.Vector3(
            player.position.x,
            player.position.y + 1.6,
            player.position.z,
        );
        camera.applyToCamera(camera_, targetPos, focusPoint, deltaTime);
    };

    return {
        update,
        physics,
        camera,
        movement,
        ammo,
        autoFire,
        keyboard,
        mouseLook,
    };
}