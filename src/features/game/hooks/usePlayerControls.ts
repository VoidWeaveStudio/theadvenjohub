//src\features\game\hooks\usePlayerControls.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { checkCollision } from '../map/collision';
import { GRAVITY, JUMP_FORCE, MAX_PITCH, MOVE_SPEED, MOUSE_SENSITIVITY, PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants';

interface UsePlayerControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    socket: Socket | null;
    collisionBoxes: CollisionBox[];
    gameStatusRef: React.MutableRefObject<'waiting' | 'playing' | 'ended'>;
    onLockChange: (locked: boolean) => void;
    onExit: () => void;
    startAutoFire: () => void;
    stopAutoFire: () => void;
    reload: () => void;
    isMouseDownRef: React.MutableRefObject<boolean>;
}

export function usePlayerControls({
    containerRef,
    cameraRef,
    socket,
    collisionBoxes,
    gameStatusRef,
    onLockChange,
    onExit,
    startAutoFire,
    stopAutoFire,
    reload,
    isMouseDownRef
}: UsePlayerControlsProps) {
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);
    const footstepTimerRef = useRef(0);
    const soundManagerRef = useRef<any>(null);
    const lastMoveTimeRef = useRef(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.code);

            if (e.code === 'Escape') {
                stopAutoFire();
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
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;

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
            if (!locked) {
                stopAutoFire();
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isLockedRef.current || !cameraRef.current) return;

            cameraRef.current.rotation.y -= e.movementX * MOUSE_SENSITIVITY;
            cameraRef.current.rotation.x -= e.movementY * MOUSE_SENSITIVITY;
            cameraRef.current.rotation.x = Math.max(
                -MAX_PITCH,
                Math.min(MAX_PITCH, cameraRef.current.rotation.x)
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
    }, [containerRef, cameraRef, socket, collisionBoxes, gameStatusRef, onLockChange, onExit, startAutoFire, stopAutoFire, reload, isMouseDownRef]);

    const updateMovement = (deltaTime: number) => {
        if (!cameraRef.current) return;

        if (!isOnGroundRef.current) {
            velocityYRef.current += GRAVITY;
            cameraRef.current.position.y += velocityYRef.current;

            if (cameraRef.current.position.y <= PLAYER_HEIGHT) {
                cameraRef.current.position.y = PLAYER_HEIGHT;
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
            moveDirection.applyQuaternion(cameraRef.current.quaternion);
            moveDirection.y = 0;
            moveDirection.normalize();

            const newX = cameraRef.current.position.x + moveDirection.x * MOVE_SPEED;
            const newZ = cameraRef.current.position.z + moveDirection.z * MOVE_SPEED;

            if (!checkCollision(newX, cameraRef.current.position.z, collisionBoxes, PLAYER_RADIUS)) {
                cameraRef.current.position.x = newX;
            }

            if (!checkCollision(cameraRef.current.position.x, newZ, collisionBoxes, PLAYER_RADIUS)) {
                cameraRef.current.position.z = newZ;
            }

            footstepTimerRef.current += deltaTime;
            if (footstepTimerRef.current > 0.35 && isOnGroundRef.current) {
                soundManagerRef.current?.playFootstep();
                footstepTimerRef.current = 0;
            }

            const now = Date.now();
            if (socket?.connected && now - lastMoveTimeRef.current > 50) {
                socket.emit('playerMove', {
                    position: [
                        cameraRef.current.position.x,
                        cameraRef.current.position.y,
                        cameraRef.current.position.z
                    ],
                    rotation: [
                        cameraRef.current.rotation.x,
                        cameraRef.current.rotation.y,
                        0
                    ]
                });
                lastMoveTimeRef.current = now;
            }
        }
    };

    return {
        keysRef,
        isLockedRef,
        velocityYRef,
        isOnGroundRef,
        footstepTimerRef,
        soundManagerRef,
        updateMovement
    };
}