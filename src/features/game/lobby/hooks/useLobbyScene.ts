//src\features\game\lobby\hooks\useLobbyScene.ts
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createCameraFromConfig } from '../../camera/createCamera';
import { CAMERA_CONFIG } from '../../camera/config';
import { CollisionSystem } from '../../map/CollisionSystem';
import { TracerSystem } from '../../mechanics/shooting/models/TracerSystem';
import { HitEffect } from '../../mechanics/shooting/models/HitEffect';
import { createAtmosphericEnvironment, createPortal, LobbyAnimatables } from '../LobbyEnvironment';

export function useLobbyScene(containerRef: React.RefObject<HTMLDivElement | null>) {
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const collisionSystemRef = useRef<CollisionSystem | null>(null);
    const tracerSystemRef = useRef<TracerSystem | null>(null);
    const hitEffectRef = useRef<HitEffect | null>(null);
    const animatablesRef = useRef<LobbyAnimatables | null>(null);
    const isInitializedRef = useRef(false);
    const [sceneReady, setSceneReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current || isInitializedRef.current) return;
        isInitializedRef.current = true;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2a2a4e);
        scene.fog = new THREE.FogExp2(0x2a2a4e, 0.015);
        sceneRef.current = scene;

        const camera = createCameraFromConfig(CAMERA_CONFIG);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene.add(new THREE.AmbientLight(0x8080c0, 0.6));
        scene.add(new THREE.HemisphereLight(0xa0a0ff, 0x404080, 0.5));

        const moonLight = new THREE.DirectionalLight(0xc0c0ff, 0.8);
        moonLight.position.set(50, 100, 50);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(2048, 2048);
        scene.add(moonLight);

        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(150, 64),
            new THREE.MeshStandardMaterial({ color: 0x3a3a5e, metalness: 0.1, roughness: 0.8 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        const env = createAtmosphericEnvironment(scene);
        const portal = createPortal(scene);
        animatablesRef.current = { ...env, portalRing: portal.portalRing, portalInnerRing: portal.innerRing, portalSphere: portal.sphere };

        collisionSystemRef.current = new CollisionSystem(10);
        tracerSystemRef.current = new TracerSystem(scene);
        hitEffectRef.current = new HitEffect(scene);

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        setSceneReady(true);

        return () => {
            isInitializedRef.current = false;
            window.removeEventListener('resize', handleResize);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
            }
            if (tracerSystemRef.current) {
                tracerSystemRef.current.dispose();
                tracerSystemRef.current = null;
            }
            if (hitEffectRef.current) {
                hitEffectRef.current.dispose();
                hitEffectRef.current = null;
            }
            sceneRef.current = null;
            cameraRef.current = null;
            collisionSystemRef.current = null;
            setSceneReady(false);
        };
    }, [containerRef]);

    return {
        sceneRef,
        cameraRef,
        rendererRef,
        collisionSystemRef,
        tracerSystemRef,
        hitEffectRef,
        animatablesRef,
        sceneReady,
    };
}