// src/features/game/hooks/usePlayerControls.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { checkCollision } from '../map/collision';
import { GRAVITY, JUMP_FORCE, PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants';
import { InputHistory } from '../network/InputHistory';

interface UsePlayerControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    playerModelRef: React.MutableRefObject<THREE.Group | null>;
    socket: Socket | null;
    collisionBoxes: CollisionBox[];
    gameStatusRef: React.MutableRefObject<'waiting' | 'playing' | 'ended'>;
    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    startAutoFire: () => void;
    stopAutoFire: () => void;
    reload: () => void;
    isMouseDownRef: React.MutableRefObject<boolean>;
    onChatToggle?: (open: boolean) => void;
    isChatOpenRef?: React.MutableRefObject<boolean>;
    inputHistoryRef?: React.MutableRefObject<InputHistory | null>;
}

const CAMERA_DISTANCE = 2.5;
const CAMERA_HEIGHT_OFFSET = 0.9;
const CAMERA_MIN_PHI = -1.2;
const CAMERA_MAX_PHI = 1.2;
const MOUSE_SENSITIVITY = 0.003;
const MOVE_SPEED = 0.12;
const ROTATION_LERP = 0.25;

export function usePlayerControls({
    containerRef,
    cameraRef,
    playerModelRef,
    socket,
    collisionBoxes,
    gameStatusRef,
    onLockChange,
    onExit,
    startAutoFire,
    stopAutoFire,
    reload,
    isMouseDownRef,
    onChatToggle,
    isChatOpenRef,
    inputHistoryRef
}: UsePlayerControlsProps) {
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);
    const footstepTimerRef = useRef(0);
    const soundManagerRef = useRef<any>(null);

    const lastMoveTimeRef = useRef(0);
    const lastSentPosRef = useRef<THREE.Vector3 | null>(null);

    const cameraYawRef = useRef(0);
    const cameraPitchRef = useRef(0.0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isChatOpenRef?.current && e.code !== 'Escape') return;

            keysRef.current.add(e.code);

            if (e.code === 'Escape') {
                stopAutoFire();
                if (isChatOpenRef?.current) {
                    onChatToggle?.(false);
                    return;
                }
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
                return;
            }

            if (e.code === 'Space' && isOnGroundRef.current && gameStatusRef.current === 'playing') {
                e.preventDefault();
                velocityYRef.current = JUMP_FORCE;
                isOnGroundRef.current = false;
            }

            if (e.code === 'KeyR' && gameStatusRef.current === 'playing') {
                reload();
            }

            if (e.code === 'KeyY' && gameStatusRef.current === 'playing') {
                const newState = !isChatOpenRef?.current;
                onChatToggle?.(newState);
                if (newState) {
                    stopAutoFire();
                    if (document.pointerLockElement) document.exitPointerLock();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (isChatOpenRef?.current) return;

            if (!document.pointerLockElement) {
                container.requestPointerLock();
                return;
            }

            if (gameStatusRef.current !== 'playing') return;

            isMouseDownRef.current = true;
            startAutoFire();
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) return;
            stopAutoFire();
        };

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === container;
            isLockedRef.current = locked;
            onLockChange(locked);
            if (!locked) stopAutoFire();
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isChatOpenRef?.current) return;
            if (!isLockedRef.current) return;

            cameraYawRef.current -= e.movementX * MOUSE_SENSITIVITY;
            cameraPitchRef.current -= e.movementY * MOUSE_SENSITIVITY;
            cameraPitchRef.current = Math.max(
                CAMERA_MIN_PHI,
                Math.min(CAMERA_MAX_PHI, cameraPitchRef.current)
            );
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [containerRef, cameraRef, socket, collisionBoxes, gameStatusRef, onLockChange, onExit, startAutoFire, stopAutoFire, reload, isMouseDownRef, onChatToggle, isChatOpenRef]);

    const updateThirdPersonCamera = (deltaTime: number) => {
        if (!cameraRef.current || !playerModelRef.current) return;

        const player = playerModelRef.current;
        
        const yaw = player.rotation.y;
        const pitch = cameraPitchRef.current;

        const boomPitch = 0.2;

        const offsetX = -Math.sin(yaw) * Math.cos(boomPitch) * CAMERA_DISTANCE;
        const offsetY = Math.sin(boomPitch) * CAMERA_DISTANCE;
        const offsetZ = Math.cos(yaw) * Math.cos(boomPitch) * CAMERA_DISTANCE;

        const shoulderOffsetX = Math.cos(yaw) * 0.8;
        const shoulderOffsetZ = -Math.sin(yaw) * 0.8;

        const targetX = player.position.x + offsetX + shoulderOffsetX;
        const targetY = player.position.y + CAMERA_HEIGHT_OFFSET + offsetY;
        const targetZ = player.position.z + offsetZ + shoulderOffsetZ;

        const lerpFactor = 1 - Math.exp(-12 * deltaTime);
        cameraRef.current.position.lerp(
            new THREE.Vector3(targetX, targetY, targetZ),
            lerpFactor
        );

        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        cameraRef.current.quaternion.setFromEuler(euler);
    };

    const updateMovement = (deltaTime: number) => {
        if (!cameraRef.current || !playerModelRef.current) return;
        if (isChatOpenRef?.current) return;

        const player = playerModelRef.current;

        if (!isOnGroundRef.current) {
            velocityYRef.current += GRAVITY;
            player.position.y += velocityYRef.current;

            if (player.position.y <= 0) {
                player.position.y = 0;
                velocityYRef.current = 0;
                isOnGroundRef.current = true;
            }
        }

        const moveDirection = new THREE.Vector3();

        if (keysRef.current.has('KeyW')) moveDirection.z -= 1;
        if (keysRef.current.has('KeyS')) moveDirection.z += 1;
        if (keysRef.current.has('KeyA')) moveDirection.x -= 1;
        if (keysRef.current.has('KeyD')) moveDirection.x += 1;

        const isMoving = moveDirection.length() > 0;

        if (isMoving && gameStatusRef.current === 'playing') {
            moveDirection.normalize();

            const yaw = cameraYawRef.current;
            const sin = Math.sin(yaw);
            const cos = Math.cos(yaw);

            const worldDirX = moveDirection.x * cos + moveDirection.z * sin;
            const worldDirZ = -moveDirection.x * sin + moveDirection.z * cos;

            const newX = player.position.x + worldDirX * MOVE_SPEED;
            const newZ = player.position.z + worldDirZ * MOVE_SPEED;

            const collisionX = checkCollision(newX, player.position.z, collisionBoxes, PLAYER_RADIUS);
            const collisionZ = checkCollision(player.position.x, newZ, collisionBoxes, PLAYER_RADIUS);

            if (!collisionX) player.position.x = newX;
            if (!collisionZ) player.position.z = newZ;

            const targetRotation = cameraYawRef.current;
            let currentRotation = player.rotation.y;

            let diff = targetRotation - currentRotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            player.rotation.y += diff * ROTATION_LERP;

            footstepTimerRef.current += deltaTime;
            if (footstepTimerRef.current > 0.35 && isOnGroundRef.current) {
                soundManagerRef.current?.playFootstep();
                footstepTimerRef.current = 0;
            }

            const now = Date.now();
            const currentPos = player.position;
            const lastSent = lastSentPosRef.current;
            const distMoved = lastSent ? currentPos.distanceTo(lastSent) : Infinity;

            if (socket?.connected && (now - lastMoveTimeRef.current > 100 || distMoved > 0.1)) {
                socket.emit('playerMove', {
                    position: [currentPos.x, currentPos.y, currentPos.z],
                    rotation: [0, player.rotation.y, 0]
                });
                lastMoveTimeRef.current = now;
                lastSentPosRef.current = currentPos.clone();
            }

            if (inputHistoryRef?.current) {
                inputHistoryRef.current.addInput(moveDirection, false);
            }
        } else {
            const targetRotation = cameraYawRef.current;
            let currentRotation = player.rotation.y;

            let diff = targetRotation - currentRotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) > 0.01) {
                player.rotation.y += diff * ROTATION_LERP;
            }
        }

        updateThirdPersonCamera(deltaTime);
    };

    return {
        keysRef,
        isLockedRef,
        velocityYRef,
        isOnGroundRef,
        footstepTimerRef,
        soundManagerRef,
        updateMovement,
        cameraYawRef,
        cameraPitchRef
    };
}