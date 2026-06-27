// src/features/game/hooks/usePlayerControls.ts
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
    onThirdPersonToggle?: (enabled: boolean) => void;
    playerModelRef?: React.MutableRefObject<THREE.Group | null>;
    onChatToggle?: (open: boolean) => void;
    isChatOpenRef?: React.MutableRefObject<boolean>;
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
    isMouseDownRef,
    onThirdPersonToggle,
    playerModelRef,
    onChatToggle,
    isChatOpenRef
}: UsePlayerControlsProps) {
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);
    const footstepTimerRef = useRef(0);
    const soundManagerRef = useRef<any>(null);
    const lastMoveTimeRef = useRef(0);

    const isThirdPersonRef = useRef(false);
    const thirdPersonOrbitRef = useRef({ theta: 0, phi: Math.PI / 3, radius: 4 });
    const previousMouseMovementRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isChatOpenRef?.current && e.code !== 'Escape') {
                return;
            }

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

            if (e.code === 'KeyT' && gameStatusRef.current === 'playing') {
                if (!isThirdPersonRef.current) {
                    isThirdPersonRef.current = true;
                    onThirdPersonToggle?.(true);

                    if (cameraRef.current && playerModelRef?.current) {
                        const playerPos = playerModelRef.current.position;
                        cameraRef.current.position.set(
                            playerPos.x,
                            playerPos.y + 1.5,
                            playerPos.z + 4
                        );
                    }
                }
            }

            if (e.code === 'KeyY' && gameStatusRef.current === 'playing') {
                const newState = !isChatOpenRef?.current;
                onChatToggle?.(newState);
                
                if (newState) {
                    stopAutoFire();
                    if (document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);

            if (e.code === 'KeyT') {
                if (isThirdPersonRef.current) {
                    isThirdPersonRef.current = false;
                    onThirdPersonToggle?.(false);

                    if (cameraRef.current && playerModelRef?.current) {
                        const playerPos = playerModelRef.current.position;
                        cameraRef.current.position.set(
                            playerPos.x,
                            PLAYER_HEIGHT,
                            playerPos.z
                        );
                        cameraRef.current.rotation.x = 0;
                    }
                }
            }
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
            if (!locked) {
                stopAutoFire();
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isChatOpenRef?.current) return;
            if (!isLockedRef.current || !cameraRef.current) return;

            if (isThirdPersonRef.current) {
                const sensitivity = 0.005;
                thirdPersonOrbitRef.current.theta -= e.movementX * sensitivity;
                thirdPersonOrbitRef.current.phi -= e.movementY * sensitivity;

                thirdPersonOrbitRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, thirdPersonOrbitRef.current.phi));
            } else {
                cameraRef.current.rotation.y -= e.movementX * MOUSE_SENSITIVITY;
                cameraRef.current.rotation.x -= e.movementY * MOUSE_SENSITIVITY;
                cameraRef.current.rotation.x = Math.max(
                    -MAX_PITCH,
                    Math.min(MAX_PITCH, cameraRef.current.rotation.x)
                );
            }
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
    }, [containerRef, cameraRef, socket, collisionBoxes, gameStatusRef, onLockChange, onExit, startAutoFire, stopAutoFire, reload, isMouseDownRef, onThirdPersonToggle, playerModelRef, onChatToggle, isChatOpenRef]);

    const updateMovement = (deltaTime: number) => {
        if (!cameraRef.current) return;
        
        if (isChatOpenRef?.current) return;

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

            const collisionX = checkCollision(newX, cameraRef.current.position.z, collisionBoxes, PLAYER_RADIUS);
            const collisionZ = checkCollision(cameraRef.current.position.x, newZ, collisionBoxes, PLAYER_RADIUS);

            if (!collisionX) {
                cameraRef.current.position.x = newX;
            }
            if (!collisionZ) {
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
                    position: {
                        x: cameraRef.current.position.x,
                        y: cameraRef.current.position.y,
                        z: cameraRef.current.position.z
                    },
                    rotation: {
                        x: cameraRef.current.rotation.x,
                        y: cameraRef.current.rotation.y,
                        z: cameraRef.current.rotation.z
                    }
                });
                lastMoveTimeRef.current = now;
            }
        }
    };

    const updateThirdPersonCamera = (playerPosition: THREE.Vector3) => {
        if (!isThirdPersonRef.current || !cameraRef.current) return;

        const orbit = thirdPersonOrbitRef.current;

        const x = playerPosition.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
        const y = playerPosition.y + 1.5 + orbit.radius * Math.cos(orbit.phi);
        const z = playerPosition.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);

        cameraRef.current.position.set(x, y, z);
        cameraRef.current.lookAt(playerPosition.x, playerPosition.y + 1.5, playerPosition.z);
    };

    return {
        keysRef,
        isLockedRef,
        velocityYRef,
        isOnGroundRef,
        footstepTimerRef,
        soundManagerRef,
        updateMovement,
        isThirdPersonRef,
        updateThirdPersonCamera
    };
}