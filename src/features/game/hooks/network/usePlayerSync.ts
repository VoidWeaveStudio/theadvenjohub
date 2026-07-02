// src/features/game/hooks/network/usePlayerSync.ts
import { useRef } from 'react';
import { Socket } from 'socket.io-client';
import * as THREE from 'three';

interface UsePlayerSyncProps {
    socket: Socket | null;
    playerRef: React.RefObject<THREE.Group | null>;
    sendInterval?: number;
    minDistance?: number;
}

export function usePlayerSync({
    socket,
    playerRef,
    sendInterval = 100,
    minDistance = 0.1,
}: UsePlayerSyncProps) {
    const lastSendTimeRef = useRef(0);
    const lastSentPosRef = useRef<THREE.Vector3 | null>(null);
    
    const sendIfChangedRef = useRef<((position: THREE.Vector3, rotation: THREE.Euler) => void) | undefined>(undefined);

    sendIfChangedRef.current = (position: THREE.Vector3, rotation: THREE.Euler): void => {
        if (!socket?.connected || !playerRef.current) return;

        if (!isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
            console.warn('⚠️ [PlayerSync] Invalid position (NaN):', {
                x: position.x, y: position.y, z: position.z
            });
            return;
        }

        if (!isFinite(rotation.y)) {
            console.warn('⚠️ [PlayerSync] Invalid rotation (NaN):', rotation.y);
            return;
        }

        const now = Date.now();
        const lastSent = lastSentPosRef.current;
        const distMoved = lastSent ? position.distanceTo(lastSent) : Infinity;

        if (now - lastSendTimeRef.current > sendInterval || distMoved > minDistance) {
            socket.emit('playerMove', {
                position: [position.x, position.y, position.z],
                rotation: [0, rotation.y, 0],
            });
            lastSendTimeRef.current = now;
            lastSentPosRef.current = position.clone();
        }
    };

    return {
        sendIfChanged: (position: THREE.Vector3, rotation: THREE.Euler) => {
            sendIfChangedRef.current?.(position, rotation);
        }
    };
}