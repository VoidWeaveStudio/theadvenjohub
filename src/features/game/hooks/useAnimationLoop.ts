// src/features/game/hooks/useAnimationLoop.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function useAnimationLoop(
    sceneRef: React.MutableRefObject<THREE.Scene | null>,
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
    rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>,
    updateCallback: (deltaTime: number, elapsedTime: number) => void,
) {
    useEffect(() => {
        let lastTime = 0;
        let startTime = performance.now();
        let animId = 0;

        const animate = (currentTime: number = 0) => {
            animId = requestAnimationFrame(animate);
            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const deltaTime = lastTime ? Math.min((currentTime - lastTime) / 1000, 0.1) : 0.016;
            const elapsedTime = (currentTime - startTime) / 1000;
            lastTime = currentTime;

            updateCallback(deltaTime, elapsedTime);

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animId);
        };
    }, [sceneRef, cameraRef, rendererRef, updateCallback]);
}