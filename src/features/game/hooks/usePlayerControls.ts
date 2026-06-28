// src/features/game/hooks/usePlayerControls.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { CollisionBox } from '../types';
import { checkCollision } from '../map/collision';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants';
import { InputHistory } from '../network/InputHistory';
import { ProceduralAnimationData } from '../models/PlayerAnimator';

const CAMERA_DISTANCE = 2.5;
const CAMERA_HEIGHT_OFFSET = 1.6;
const CAMERA_MIN_PHI = -1.2;
const CAMERA_MAX_PHI = 1.2;
const MOUSE_SENSITIVITY = 0.003;
const MOVE_SPEED = 7.0;
const ROTATION_SMOOTHNESS = 15.0;
const GRAVITY = -20.0;
const JUMP_FORCE = 8.0;
const CAMERA_COLLISION_RADIUS = 0.3;
const FOCUS_POINT_OFFSET = 0.8;

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
    onProceduralDataUpdate?: (data: ProceduralAnimationData) => void;
}

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
    inputHistoryRef,
    onProceduralDataUpdate
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
            cameraPitchRef.current += e.movementY * MOUSE_SENSITIVITY;
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
        const yaw = cameraYawRef.current;
        const pitch = cameraPitchRef.current;

        const focusDistance = 10;
        const focusPoint = new THREE.Vector3();
        focusPoint.x = cameraRef.current.position.x - Math.sin(yaw) * Math.cos(pitch) * focusDistance;
        focusPoint.y = cameraRef.current.position.y - Math.sin(pitch) * focusDistance;
        focusPoint.z = cameraRef.current.position.z - Math.cos(yaw) * Math.cos(pitch) * focusDistance;

        const offsetX = Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE;
        const offsetY = Math.sin(pitch) * CAMERA_DISTANCE;
        const offsetZ = Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE;

        let targetX = player.position.x + Math.cos(yaw) * FOCUS_POINT_OFFSET + offsetX;
        let targetY = player.position.y + CAMERA_HEIGHT_OFFSET + offsetY;
        let targetZ = player.position.z - Math.sin(yaw) * FOCUS_POINT_OFFSET + offsetZ;

        const desiredPosition = new THREE.Vector3(targetX, targetY, targetZ);
        const direction = desiredPosition.clone().sub(focusPoint).normalize();
        const distance = focusPoint.distanceTo(desiredPosition);

        let collisionDistance = distance;
        const rayOrigin = focusPoint.clone();

        const steps = 10;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const checkPos = rayOrigin.clone().add(direction.clone().multiplyScalar(distance * t));

            const hasCollision = checkCollision(
                checkPos.x,
                checkPos.z,
                collisionBoxes,
                CAMERA_COLLISION_RADIUS
            );

            if (hasCollision) {
                collisionDistance = distance * (t - 1 / steps) - CAMERA_COLLISION_RADIUS;
                break;
            }
        }

        if (collisionDistance < distance) {
            targetX = focusPoint.x + direction.x * collisionDistance;
            targetY = focusPoint.y + direction.y * collisionDistance;
            targetZ = focusPoint.z + direction.z * collisionDistance;
        }

        const lerpFactor = 1 - Math.exp(-12 * deltaTime);
        cameraRef.current.position.lerp(
            new THREE.Vector3(targetX, targetY, targetZ),
            lerpFactor
        );

        cameraRef.current.lookAt(focusPoint);
    };

    const updateMovement = (deltaTime: number) => {
        if (!cameraRef.current || !playerModelRef.current) return;
        if (isChatOpenRef?.current) return;

        const player = playerModelRef.current;

        if (!isOnGroundRef.current) {
            // v = v0 + a*t
            velocityYRef.current += GRAVITY * deltaTime;
            player.position.y += velocityYRef.current * deltaTime;

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

        const strafeInput = (keysRef.current.has('KeyA') ? -1 : 0) +
            (keysRef.current.has('KeyD') ? 1 : 0);

        const aimDirection = new THREE.Vector3(
            -Math.sin(cameraYawRef.current),
            -Math.sin(cameraPitchRef.current),
            -Math.cos(cameraYawRef.current)
        ).normalize();

        if (onProceduralDataUpdate) {
            onProceduralDataUpdate({
                isMoving: isMoving && gameStatusRef.current === 'playing',
                moveSpeed: isMoving ? 1 : 0,
                strafeInput: strafeInput,
                aimDirection: aimDirection
            });
        }

        if (isMoving && gameStatusRef.current === 'playing') {
            moveDirection.normalize();

            const yaw = cameraYawRef.current;
            const sin = Math.sin(yaw);
            const cos = Math.cos(yaw);

            const worldDirX = moveDirection.x * cos + moveDirection.z * sin;
            const worldDirZ = -moveDirection.x * sin + moveDirection.z * cos;

            const newX = player.position.x + worldDirX * MOVE_SPEED * deltaTime;
            const newZ = player.position.z + worldDirZ * MOVE_SPEED * deltaTime;

            const collisionX = checkCollision(newX, player.position.z, collisionBoxes, PLAYER_RADIUS);
            const collisionZ = checkCollision(player.position.x, newZ, collisionBoxes, PLAYER_RADIUS);

            if (!collisionX) player.position.x = newX;
            if (!collisionZ) player.position.z = newZ;

            const targetRotation = cameraYawRef.current;
            let currentRotation = player.rotation.y;

            let diff = targetRotation - currentRotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const rotationLerp = 1 - Math.exp(-ROTATION_SMOOTHNESS * deltaTime);
            player.rotation.y += diff * rotationLerp;

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
                const rotationLerp = 1 - Math.exp(-ROTATION_SMOOTHNESS * deltaTime);
                player.rotation.y += diff * rotationLerp;
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