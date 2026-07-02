// src/features/game/hooks/network/usePlayerSync.ts
import { useEffect, useRef } from 'react';
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

    const sendIfChanged = (position: THREE.Vector3, rotation: THREE.Euler): void => {
        if (!socket?.connected || !playerRef.current) return;

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

    return { sendIfChanged };
}