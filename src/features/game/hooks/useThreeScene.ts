// src/features/game/hooks/useThreeScene.ts
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface ThreeSceneConfig {
    containerRef: React.RefObject<HTMLDivElement | null>;
    backgroundColor: number;
    fogColor: number;
    fogNear?: number;
    fogFar?: number;
    fogDensity?: number;
    cameraFov?: number;
    cameraNear?: number;
    cameraFar?: number;
    cameraPosition?: { x: number; y: number; z: number };
}

export function useThreeScene(config: ThreeSceneConfig) {
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    useEffect(() => {
        if (!config.containerRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(config.backgroundColor);
        
        if (config.fogDensity) {
            scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
        } else {
            scene.fog = new THREE.Fog(config.fogColor, config.fogNear ?? 0, config.fogFar ?? 1000);
        }
        
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            config.cameraFov ?? 75,
            window.innerWidth / window.innerHeight,
            config.cameraNear ?? 0.1,
            config.cameraFar ?? 1000,
        );
        
        if (config.cameraPosition) {
            camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
        }
        
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance',
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        config.containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };
        
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            
            if (sceneRef.current) {
                disposeThreeObject(sceneRef.current);
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current.forceContextLoss();
                if (config.containerRef.current && rendererRef.current.domElement.parentNode === config.containerRef.current) {
                    config.containerRef.current.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current = null;
            }

            sceneRef.current = null;
            cameraRef.current = null;
        };
    }, [
        config.containerRef, 
        config.backgroundColor, 
        config.fogColor, 
        config.fogNear, 
        config.fogFar, 
        config.fogDensity, 
        config.cameraFov, 
        config.cameraNear, 
        config.cameraFar,
        config.cameraPosition
    ]);

    return { sceneRef, cameraRef, rendererRef };
}

function disposeThreeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                    m.dispose();
                    if ('map' in m && m.map) m.map.dispose();
                });
            } else if (child.material) {
                child.material.dispose();
                if ('map' in child.material && child.material.map) child.material.map.dispose();
            }
        }
    });
}