// src/features/game/LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Socket } from "socket.io-client";
import { LobbyUI } from "./components/LobbyUI";
import { UsernameSprite } from "./utils/UsernameSprite";
import { PlayerModelLoader } from './models/PlayerModelLoader';
import { PlayerAnimator } from './models/PlayerAnimator';
import { PlayerAnimationData } from './types';
import { VoiceChat } from './components/VoiceChat';
import { TextChat } from './components/TextChat';
import { GRAVITY, JUMP_FORCE, PLAYER_HEIGHT } from './constants';

interface LobbyWorldProps {
    wallet: string;
    username: string;
    socket: Socket | null;
    onEnterGame: (roomId: string, mode: string, players: any[]) => void;
    onExit: () => void;
}

interface QueueStatus {
    count: number;
    max: number;
}

interface PlayerData {
    id: string;
    username: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

interface LobbyPlayerModel {
    group: THREE.Group;
    animator: PlayerAnimator;
    animData: PlayerAnimationData;
    sprite: THREE.Sprite;
}

function unpackPosition(pos: any): { x: number; y: number; z: number } {
    if (Array.isArray(pos)) return { x: pos[0], y: pos[1], z: pos[2] };
    return pos;
}


function createAtmosphericEnvironment(scene: THREE.Scene): {
    crystals: THREE.Mesh[];
    particles: THREE.Points;
    stars: THREE.Points;
    platformRing: THREE.Mesh;
    innerRing: THREE.Mesh;
} {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 500;
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
        const radius = 200 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 20;
        starsPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));

    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.2,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 40;
    const particlesPositions = new Float32Array(particlesCount * 3);
    const particlesColors = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount; i++) {
        particlesPositions[i * 3] = (Math.random() - 0.5) * 60;
        particlesPositions[i * 3 + 1] = Math.random() * 12 + 1;
        particlesPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;

        const colorChoice = Math.random();
        if (colorChoice < 0.33) {
            particlesColors[i * 3] = 0.5;
            particlesColors[i * 3 + 1] = 1;
            particlesColors[i * 3 + 2] = 1;
        } else if (colorChoice < 0.66) {
            particlesColors[i * 3] = 0.7;
            particlesColors[i * 3 + 1] = 0.5;
            particlesColors[i * 3 + 2] = 1;
        } else {
            particlesColors[i * 3] = 0.5;
            particlesColors[i * 3 + 1] = 0.7;
            particlesColors[i * 3 + 2] = 1;
        }
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particlesColors, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);


    const columnPositions = [
        { x: -25, z: -25 }, { x: 25, z: -25 },
        { x: -25, z: 25 }, { x: 25, z: 25 },
        { x: -35, z: 0 }, { x: 35, z: 0 },
        { x: 0, z: -35 }, { x: 0, z: 35 }
    ];

    const columnGeometries: THREE.BufferGeometry[] = [];
    const crystals: THREE.Mesh[] = [];

    const columnMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a6e,
        metalness: 0.5,
        roughness: 0.5,
        flatShading: true
    });

    columnPositions.forEach((pos, i) => {
        const columnGeo = new THREE.CylinderGeometry(0.9, 1.1, 11, 8);
        columnGeo.translate(pos.x, 5.5, pos.z);
        columnGeometries.push(columnGeo);

        const crystalGeometry = new THREE.OctahedronGeometry(0.6, 0);
        const crystalColor = i % 2 === 0 ? 0x00ffff : 0xff66ff;
        const crystalMaterial = new THREE.MeshStandardMaterial({
            color: crystalColor,
            emissive: crystalColor,
            emissiveIntensity: 2.5,
            metalness: 0.8,
            roughness: 0.2,
            flatShading: true
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        crystal.position.set(pos.x, 11.5, pos.z);
        scene.add(crystal);
        crystals.push(crystal);
    });

    if (columnGeometries.length > 0) {
        const mergedColumns = mergeGeometries(columnGeometries, false);
        const columnsMesh = new THREE.Mesh(mergedColumns, columnMaterial);
        columnsMesh.castShadow = false;
        columnsMesh.receiveShadow = true;
        scene.add(columnsMesh);
        columnGeometries.forEach(g => g.dispose());
    }

    const platformGeometry = new THREE.CylinderGeometry(15, 16, 0.5, 24);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a5e,
        metalness: 0.6,
        roughness: 0.4,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(0, -0.25, 0);
    platform.receiveShadow = true;
    scene.add(platform);

    const ringGeometry = new THREE.TorusGeometry(15.5, 0.15, 6, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 1.5,
        flatShading: true
    });
    const platformRing = new THREE.Mesh(ringGeometry, ringMaterial);
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = 0.1;
    scene.add(platformRing);

    const innerRingGeometry = new THREE.TorusGeometry(8, 0.1, 6, 24);
    const innerRingMaterial = new THREE.MeshStandardMaterial({
        color: 0xff66ff,
        emissive: 0xff66ff,
        emissiveIntensity: 1.2,
        flatShading: true
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.06;
    scene.add(innerRing);

    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const lineGeometry = new THREE.BoxGeometry(0.1, 0.05, 6);
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            flatShading: true
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(Math.cos(angle) * 11, 0.08, Math.sin(angle) * 11);
        line.rotation.y = angle + Math.PI / 2;
        scene.add(line);
    }

    scene.fog = new THREE.Fog(0x2a2a4e, 10, 120);

    const mountainGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const distance = 100 + Math.random() * 20;
        const height = 25 + Math.random() * 20;

        const mountainGeometry = new THREE.ConeGeometry(18, height, 4);
        mountainGeometry.translate(
            Math.cos(angle) * distance,
            height / 2 - 5,
            Math.sin(angle) * distance
        );
        mountainGeometries.push(mountainGeometry);
    }

    if (mountainGeometries.length > 0) {
        const mergedMountains = mergeGeometries(mountainGeometries, false);
        const mountainMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a3e,
            flatShading: true
        });
        const mountainsMesh = new THREE.Mesh(mergedMountains, mountainMaterial);
        scene.add(mountainsMesh);
        mountainGeometries.forEach(g => g.dispose());
    }

    return { crystals, particles, stars, platformRing, innerRing };
}


function createPortal(scene: THREE.Scene): {
    group: THREE.Group;
    portalRing: THREE.Mesh;
    innerRing: THREE.Mesh;
    sphere: THREE.Mesh;
} {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, -15);

    const baseGeometry = new THREE.CylinderGeometry(4, 4.5, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a6e,
        metalness: 0.6,
        roughness: 0.4,
        flatShading: true
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.25;
    base.receiveShadow = true;
    portalGroup.add(base);

    const torusGeometry = new THREE.TorusGeometry(3, 0.3, 8, 32);
    const torusMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 2,
        metalness: 0.8,
        roughness: 0.2,
        flatShading: true
    });
    const portalRing = new THREE.Mesh(torusGeometry, torusMaterial);
    portalRing.position.y = 3.5;
    portalGroup.add(portalRing);

    const innerTorusGeometry = new THREE.TorusGeometry(2.3, 0.15, 8, 32);
    const innerTorusMaterial = new THREE.MeshStandardMaterial({
        color: 0xff66ff,
        emissive: 0xff66ff,
        emissiveIntensity: 1.5,
        metalness: 0.8,
        roughness: 0.2,
        flatShading: true
    });
    const innerRing = new THREE.Mesh(innerTorusGeometry, innerTorusMaterial);
    innerRing.position.y = 3.5;
    portalGroup.add(innerRing);

    const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x66ffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.y = 3.5;
    portalGroup.add(sphere);

    const pillarGeometry = new THREE.BoxGeometry(0.8, 7, 0.8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a6e,
        metalness: 0.5,
        roughness: 0.5,
        flatShading: true
    });

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-3.5, 3.5, 0);
    portalGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(3.5, 3.5, 0);
    portalGroup.add(rightPillar);

    const glowGeometry = new THREE.BoxGeometry(0.2, 5, 0.2);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 2,
        flatShading: true
    });

    const leftGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    leftGlow.position.set(-3.5, 3.5, 0.4);
    portalGroup.add(leftGlow);

    const rightGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    rightGlow.position.set(3.5, 3.5, 0.4);
    portalGroup.add(rightGlow);

    const archGeometry = new THREE.BoxGeometry(7.8, 0.8, 0.8);
    const arch = new THREE.Mesh(archGeometry, pillarMaterial);
    arch.position.set(0, 7, 0);
    portalGroup.add(arch);

    const portalLight = new THREE.PointLight(0x66ffff, 2, 20);
    portalLight.position.set(0, 3.5, 0);
    portalGroup.add(portalLight);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createLinearGradient(0, 0, 512, 0);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#ff66ff');

        context.fillStyle = gradient;
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#00ffff';
        context.shadowBlur = 20;
        context.fillText('QUEUE', 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 9, 0);
    sprite.scale.set(8, 2, 1);
    portalGroup.add(sprite);

    scene.add(portalGroup);
    return { group: portalGroup, portalRing, innerRing, sphere };
}


export function LobbyWorld({ wallet, username, socket, onEnterGame, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playersRef = useRef<Map<string, LobbyPlayerModel>>(new Map());
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const portalPositionRef = useRef(new THREE.Vector3(0, 3, -15));
    const lastMoveTimeRef = useRef(0);
    const lastSentPosRef = useRef<THREE.Vector3 | null>(null);
    const timerRef = useRef(new THREE.Timer());
    const frameCountRef = useRef(0);


    const animatablesRef = useRef<{
        crystals: THREE.Mesh[];
        particles: THREE.Points | null;
        stars: THREE.Points | null;
        portalRing: THREE.Mesh | null;
        portalInnerRing: THREE.Mesh | null;
        portalSphere: THREE.Mesh | null;
        platformRing: THREE.Mesh | null;
        innerRing: THREE.Mesh | null;
    }>({
        crystals: [],
        particles: null,
        stars: null,
        portalRing: null,
        portalInnerRing: null,
        portalSphere: null,
        platformRing: null,
        innerRing: null
    });

    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);

    const nearPortalRef = useRef(false);
    const queueModeRef = useRef<string | null>(null);
    const showModeSelectRef = useRef(false);
    const modelLoadedRef = useRef(false);

    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [queues, setQueues] = useState<{ '5v5': QueueStatus; 'ffa': QueueStatus }>({
        '5v5': { count: 0, max: 10 },
        'ffa': { count: 0, max: 20 }
    });
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [queueMode, setQueueMode] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [nearPortal, setNearPortal] = useState(false);
    const [showModeSelect, setShowModeSelect] = useState(false);
    const [currentUsername, setCurrentUsername] = useState(username);
    const [modelLoaded, setModelLoaded] = useState(false);

    const [lobbyId, setLobbyId] = useState<string | null>(null);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const isChatOpenRef = useRef(false);

    useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
    useEffect(() => { showModeSelectRef.current = showModeSelect; }, [showModeSelect]);
    useEffect(() => { nearPortalRef.current = nearPortal; }, [nearPortal]);
    useEffect(() => { modelLoadedRef.current = modelLoaded; }, [modelLoaded]);
    useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

    useEffect(() => {
        PlayerModelLoader.preload()
            .then(() => {
                setModelLoaded(true);

                if (sceneRef.current) {
                    playersRef.current.forEach((playerData) => {
                        sceneRef.current!.remove(playerData.group);
                        playerData.group.traverse((obj) => {
                            if (obj instanceof THREE.Mesh) {
                                obj.geometry?.dispose();
                                if (obj.material instanceof THREE.Material) {
                                    obj.material.dispose();
                                }
                            }
                        });
                    });
                    playersRef.current.clear();

                    setPlayers(prev => {
                        prev.forEach((player, index) => {
                            if (player.id !== socket?.id) {
                                createRealPlayerModel(player, index);
                            }
                        });
                        return prev;
                    });
                }
            })
            .catch(err => {
                console.warn('⚠️ Player model preload failed:', err);
            });
    }, [socket?.id]);

    const createRealPlayerModel = useCallback((player: PlayerData, index: number) => {
        if (!sceneRef.current) return;

        let group: THREE.Group;
        let animator: PlayerAnimator | null = null;

        if (modelLoadedRef.current) {
            const cloned = PlayerModelLoader.getModelClone();
            if (cloned) {
                group = cloned;
                animator = new PlayerAnimator(group);
                animator.play('idle', 0);
            } else {
                group = createFallbackModel();
            }
        } else {
            group = createFallbackModel();
        }

        const indicator = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.7, 16),
            new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            })
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.02;
        group.add(indicator);

        group.userData.playerId = player.id;
        group.position.set(player.position.x, 0, player.position.z);
        group.rotation.set(0, player.rotation.y, 0);

        sceneRef.current.add(group);

        const sprite = UsernameSprite.create(player.username, 0x00ffff);
        group.add(sprite);

        const animData: PlayerAnimationData = {
            walkPhase: Math.random() * Math.PI * 2,
            isMoving: false,
            isShooting: false,
            isReloading: false,
            isDead: false,
            hitFlash: 0,
            deathAnimation: 0
        };

        playersRef.current.set(player.id, { group, animator: animator!, animData, sprite });
    }, []);

    const createFallbackModel = (): THREE.Group => {
        const group = new THREE.Group();

        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.2,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        group.add(body);

        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: true });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.85;
        group.add(head);

        return group;
    };

    const removePlayerModel = useCallback((playerId: string) => {
        const playerData = playersRef.current.get(playerId);
        if (playerData && sceneRef.current) {
            sceneRef.current.remove(playerData.group);

            playerData.group.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry?.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else if (obj.material) {
                        obj.material.dispose();
                    }
                }
            });

            if (playerData.sprite) {
                const mat = playerData.sprite.material as THREE.SpriteMaterial;
                if (mat.map) mat.map.dispose();
                mat.dispose();
            }

            playersRef.current.delete(playerId);
        }
    }, []);

    const updatePlayerUsername = useCallback((playerId: string, username: string) => {
        const playerData = playersRef.current.get(playerId);
        if (playerData && playerData.sprite) {
            UsernameSprite.update(playerData.sprite, username, 0x00ffff);
        }
    }, []);


    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2a2a4e);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        camera.position.set(0, PLAYER_HEIGHT, 0);
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight - 64);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;



        const ambientLight = new THREE.AmbientLight(0x8080c0, 0.9);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xa0a0ff, 0x404080, 0.7);
        scene.add(hemiLight);

        const moonLight = new THREE.DirectionalLight(0xc0c0ff, 0.8);
        moonLight.position.set(50, 100, 50);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 1024;
        moonLight.shadow.mapSize.height = 1024;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 150;
        moonLight.shadow.camera.left = -40;
        moonLight.shadow.camera.right = 40;
        moonLight.shadow.camera.top = 40;
        moonLight.shadow.camera.bottom = -40;
        scene.add(moonLight);

        const groundGeometry = new THREE.CircleGeometry(80, 32);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a5e,
            metalness: 0.2,
            roughness: 0.9,
            flatShading: true,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.51;
        ground.receiveShadow = true;
        scene.add(ground);

        const env = createAtmosphericEnvironment(scene);
        const portal = createPortal(scene);

        animatablesRef.current = {
            crystals: env.crystals,
            particles: env.particles,
            stars: env.stars,
            portalRing: portal.portalRing,
            portalInnerRing: portal.innerRing,
            portalSphere: portal.sphere,
            platformRing: env.platformRing,
            innerRing: env.innerRing
        };

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            socket.emit("joinLobby", { wallet, username: currentUsername });
        };

        const handleLobbyJoined = (data: any) => {
            setLobbyId(data.lobbyId);
            setPlayers(data.players);
            setQueues(data.queues);
            setQueuePosition(data.queuePosition);
            setQueueMode(data.queueMode);

            data.players.forEach((player: PlayerData, index: number) => {
                if (player.id !== socket.id) {
                    createRealPlayerModel(player, index);
                }
            });
        };

        const handlePlayerJoinedLobby = (player: PlayerData) => {
            setPlayers((prev) => [...prev, player]);
            createRealPlayerModel(player, players.length);
        };

        const handlePlayerLeftLobby = (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        };

        const handlePlayerMovedInLobby = (data: any) => {
            const playerData = playersRef.current.get(data.id);
            if (playerData) {
                const pos = unpackPosition(data.position);
                const rot = unpackPosition(data.rotation);
                playerData.group.position.set(pos.x, 0, pos.z);
                playerData.group.rotation.set(0, rot.y, 0);

                const prevPos = playerData.group.userData.lastPosition;
                if (prevPos) {
                    const dist = playerData.group.position.distanceTo(prevPos);
                    playerData.animData.isMoving = dist > 0.01;
                }
                playerData.group.userData.lastPosition = playerData.group.position.clone();
            }
        };

        const handlePlayerUsernameChanged = (data: { id: string; username: string }) => {
            setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, username: data.username } : p));
            updatePlayerUsername(data.id, data.username);
        };

        const handleQueuesStatusUpdate = (newQueues: any) => setQueues(newQueues);
        const handleJoinedQueue = (data: { mode: string; position: number }) => {
            setQueueMode(data.mode);
            setQueuePosition(data.position);
            setShowModeSelect(false);
        };
        const handleQueuePositionUpdate = (data: { position: number }) => setQueuePosition(data.position);
        const handleLeftQueue = () => { setQueuePosition(null); setQueueMode(null); };
        const handleGameStarted = (data: any) => onEnterGame(data.roomId, data.mode, data.players);
        const handleJoinedFFAGame = (data: any) => onEnterGame(data.roomId, data.mode, data.players);
        const handleQueueError = (message: string) => alert(message);

        socket.on("connect", handleConnect);
        socket.on("lobbyJoined", handleLobbyJoined);
        socket.on("playerJoinedLobby", handlePlayerJoinedLobby);
        socket.on("playerLeftLobby", handlePlayerLeftLobby);
        socket.on("playerMovedInLobby", handlePlayerMovedInLobby);
        socket.on("playerUsernameChanged", handlePlayerUsernameChanged);
        socket.on("queuesStatusUpdate", handleQueuesStatusUpdate);
        socket.on("joinedQueue", handleJoinedQueue);
        socket.on("queuePositionUpdate", handleQueuePositionUpdate);
        socket.on("leftQueue", handleLeftQueue);
        socket.on("gameStarted", handleGameStarted);
        socket.on("joinedFFAGame", handleJoinedFFAGame);
        socket.on("queueError", handleQueueError);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("lobbyJoined", handleLobbyJoined);
            socket.off("playerJoinedLobby", handlePlayerJoinedLobby);
            socket.off("playerLeftLobby", handlePlayerLeftLobby);
            socket.off("playerMovedInLobby", handlePlayerMovedInLobby);
            socket.off("playerUsernameChanged", handlePlayerUsernameChanged);
            socket.off("queuesStatusUpdate", handleQueuesStatusUpdate);
            socket.off("joinedQueue", handleJoinedQueue);
            socket.off("queuePositionUpdate", handleQueuePositionUpdate);
            socket.off("leftQueue", handleLeftQueue);
            socket.off("gameStarted", handleGameStarted);
            socket.off("joinedFFAGame", handleJoinedFFAGame);
            socket.off("queueError", handleQueueError);
        };
    }, [socket, wallet, currentUsername, onEnterGame, createRealPlayerModel, removePlayerModel, updatePlayerUsername]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isChatOpenRef.current && e.code !== 'Escape') return;

            keysRef.current.add(e.code);

            if (e.code === "Escape") {
                if (showModeSelectRef.current) {
                    setShowModeSelect(false);
                    return;
                }
                if (isChatOpenRef.current) {
                    setIsChatOpen(false);
                    return;
                }
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
                return;
            }

            if (e.code === 'Space' && isOnGroundRef.current) {
                e.preventDefault();
                velocityYRef.current = JUMP_FORCE;
                isOnGroundRef.current = false;
            }

            if (e.code === 'KeyY' && !queueModeRef.current) {
                const newState = !isChatOpenRef.current;
                setIsChatOpen(newState);
                if (newState && document.pointerLockElement) {
                    document.exitPointerLock();
                }
            }

            if (e.code === "KeyE" && nearPortalRef.current && !queueModeRef.current) {
                setShowModeSelect(true);
                return;
            }

            if (e.code === "KeyQ" && queueModeRef.current) {
                socket?.emit("leaveQueue");
                return;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        const handleClick = () => {
            if (isChatOpenRef.current || showModeSelectRef.current) return;
            if (!document.pointerLockElement) {
                container.requestPointerLock();
            }
        };

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === container;
            isLockedRef.current = locked;
            setIsLocked(locked);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isChatOpenRef.current) return;
            if (!isLockedRef.current || !cameraRef.current) return;

            const sensitivity = 0.002;
            cameraRef.current.rotation.y -= e.movementX * sensitivity;
            cameraRef.current.rotation.x -= e.movementY * sensitivity;

            const maxPitch = Math.PI / 2 - 0.01;
            cameraRef.current.rotation.x = Math.max(
                -maxPitch,
                Math.min(maxPitch, cameraRef.current.rotation.x)
            );
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        container.addEventListener("click", handleClick);
        document.addEventListener("pointerlockchange", handlePointerLockChange);
        document.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            container.removeEventListener("click", handleClick);
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, [socket, onExit]);


    useEffect(() => {
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            timerRef.current.update();
            const deltaTime = Math.min(timerRef.current.getDelta(), 0.1);
            const elapsedTime = timerRef.current.getElapsed();
            frameCountRef.current++;
            const frame = frameCountRef.current;

            if (!isChatOpenRef.current) {
                if (!isOnGroundRef.current) {
                    velocityYRef.current += GRAVITY;
                    cameraRef.current.position.y += velocityYRef.current;

                    if (cameraRef.current.position.y <= PLAYER_HEIGHT) {
                        cameraRef.current.position.y = PLAYER_HEIGHT;
                        velocityYRef.current = 0;
                        isOnGroundRef.current = true;
                    }
                }

                const speed = 0.15;
                const direction = new THREE.Vector3();

                if (keysRef.current.has("KeyW")) direction.z -= 1;
                if (keysRef.current.has("KeyS")) direction.z += 1;
                if (keysRef.current.has("KeyA")) direction.x -= 1;
                if (keysRef.current.has("KeyD")) direction.x += 1;

                const isMoving = direction.length() > 0;

                if (isMoving) {
                    direction.normalize();
                    direction.applyQuaternion(cameraRef.current.quaternion);
                    direction.y = 0;
                    direction.normalize();

                    cameraRef.current.position.add(direction.clone().multiplyScalar(speed));

                    const distFromCenter = Math.sqrt(
                        cameraRef.current.position.x ** 2 +
                        cameraRef.current.position.z ** 2
                    );
                    if (distFromCenter > 45) {
                        const angle = Math.atan2(
                            cameraRef.current.position.z,
                            cameraRef.current.position.x
                        );
                        cameraRef.current.position.x = Math.cos(angle) * 45;
                        cameraRef.current.position.z = Math.sin(angle) * 45;
                    }

                    const now = Date.now();
                    const currentPos = cameraRef.current.position;
                    const lastSent = lastSentPosRef.current;
                    const distMoved = lastSent ? currentPos.distanceTo(lastSent) : Infinity;

                    if (socket?.connected && (now - lastMoveTimeRef.current > 100 || distMoved > 0.1)) {
                        socket.emit("lobbyMove", {
                            position: [currentPos.x, currentPos.y, currentPos.z],
                            rotation: [
                                cameraRef.current.rotation.x,
                                cameraRef.current.rotation.y,
                                cameraRef.current.rotation.z
                            ]
                        });
                        lastMoveTimeRef.current = now;
                        lastSentPosRef.current = currentPos.clone();
                    }
                }
            }


            const anim = animatablesRef.current;

            if (anim.portalRing) anim.portalRing.rotation.z = elapsedTime * 0.5;
            if (anim.portalInnerRing) anim.portalInnerRing.rotation.z = -elapsedTime * 0.8;
            if (anim.portalSphere) {
                const scale = 1 + Math.sin(elapsedTime * 2) * 0.1;
                anim.portalSphere.scale.set(scale, scale, scale);
            }

            for (let i = 0; i < anim.crystals.length; i++) {
                const crystal = anim.crystals[i];
                crystal.rotation.y = elapsedTime * 1.5;
                crystal.rotation.x = Math.sin(elapsedTime * 2) * 0.3;
            }

            if (anim.platformRing) anim.platformRing.rotation.z = elapsedTime * 0.2;
            if (anim.innerRing) anim.innerRing.rotation.z = -elapsedTime * 0.3;

            if (anim.particles && frame % 3 === 0) {
                const positions = anim.particles.geometry.attributes.position.array as Float32Array;
                const count = positions.length / 3;
                for (let i = 0; i < count; i++) {
                    positions[i * 3 + 1] += Math.sin(elapsedTime + i) * 0.01;
                    positions[i * 3] += Math.cos(elapsedTime * 0.5 + i) * 0.006;

                    if (positions[i * 3 + 1] > 16) positions[i * 3 + 1] = 1;
                    if (positions[i * 3 + 1] < 1) positions[i * 3 + 1] = 15;
                }
                anim.particles.geometry.attributes.position.needsUpdate = true;
            }

            if (anim.stars && frame % 2 === 0) {
                anim.stars.rotation.y = elapsedTime * 0.01;
            }

            playersRef.current.forEach((playerData) => {
                if (playerData.animator) {
                    playerData.animator.update(deltaTime);

                    if (playerData.animData.isMoving) {
                        playerData.animator.play('running');
                    } else {
                        playerData.animator.play('idle');
                    }
                }
            });

            if (cameraRef.current) {
                const distance = cameraRef.current.position.distanceTo(portalPositionRef.current);
                const isNear = distance < 6;

                if (nearPortalRef.current !== isNear) {
                    nearPortalRef.current = isNear;
                    setNearPortal(isNear);
                }
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [socket]);

    useEffect(() => {
        return () => {
            playersRef.current.forEach((playerData) => {
                if (sceneRef.current) sceneRef.current.remove(playerData.group);
                playerData.group.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else if (obj.material) {
                            obj.material.dispose();
                        }
                    }
                });
                if (playerData.sprite) {
                    const mat = playerData.sprite.material as THREE.SpriteMaterial;
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                }
            });
            playersRef.current.clear();

            if (sceneRef.current) {
                sceneRef.current.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else if (obj.material) {
                            obj.material.dispose();
                        }
                    }
                    if (obj instanceof THREE.Points) {
                        obj.geometry?.dispose();
                        if (obj.material instanceof THREE.Material) {
                            obj.material.dispose();
                        }
                    }
                });
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current.forceContextLoss();
                if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current = null;
            }

            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
    }, []);

    const joinQueue = useCallback((mode: string) => {
        socket?.emit("joinQueue", { mode, wallet, username: currentUsername });
    }, [socket, wallet, currentUsername]);

    const handleUsernameChange = useCallback((newUsername: string) => {
        setCurrentUsername(newUsername);
        socket?.emit("changeUsername", { username: newUsername });
    }, [socket]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <LobbyUI
                username={currentUsername}
                onUsernameChange={handleUsernameChange}
                playersCount={players.length}
                queues={queues}
            />

            <VoiceChat
                socket={socket}
                channelId={lobbyId}
                myUsername={currentUsername}
                isChatOpenRef={isChatOpenRef}
            />

            <TextChat
                socket={socket}
                channelId={lobbyId}
                myUsername={currentUsername}
                mode="lobby"
                isOpen={isChatOpen}
                onToggle={setIsChatOpen}
            />

            {showModeSelect && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto z-50">
                    <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

                        <div className="relative text-center">
                            <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent mb-2">
                                SELECT MODE
                            </h2>
                            <p className="text-zinc-400 text-sm">Choose your battle mode</p>
                        </div>

                        <div className="relative space-y-3">
                            <button
                                onClick={() => joinQueue('5v5')}
                                className="group w-full p-4 bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-2 border-blue-500/50 hover:border-blue-400 rounded-xl text-left transition-all hover:from-blue-600/30 hover:to-blue-800/30"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-white text-xl font-black">5 vs 5</span>
                                    <span className="text-cyan-400 text-sm font-mono font-bold">{queues['5v5'].count}/{queues['5v5'].max}</span>
                                </div>
                                <div className="text-zinc-300 text-sm font-semibold">Team Deathmatch</div>
                                <div className="text-zinc-500 text-xs mt-1">10 players • 50 kills to win • 10 min</div>
                            </button>

                            <button
                                onClick={() => joinQueue('ffa')}
                                className="group w-full p-4 bg-gradient-to-br from-red-600/20 to-red-800/20 border-2 border-red-500/50 hover:border-red-400 rounded-xl text-left transition-all hover:from-red-600/30 hover:to-red-800/30"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-white text-xl font-black">Survival</span>
                                    <span className="text-cyan-400 text-sm font-mono font-bold">{queues['ffa'].count}/{queues['ffa'].max}</span>
                                </div>
                                <div className="text-zinc-300 text-sm font-semibold">Free-for-All • Every man for himself</div>
                                <div className="text-zinc-500 text-xs mt-1">20 players • 50 kills to win • 10 min</div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowModeSelect(false)}
                            className="relative w-full py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                        >
                            Cancel (ESC)
                        </button>
                    </div>
                </div>
            )}

            {queueMode && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-8 py-5 rounded-2xl border border-cyan-500/40 shadow-2xl">
                    <div className="text-white text-lg font-bold">
                        Queue: <span className="text-cyan-400 font-black">{queueMode === '5v5' ? '5 vs 5' : 'Survival'}</span>
                    </div>
                    <div className="text-zinc-400 text-sm mt-1">
                        Position: <span className="text-white font-black text-lg">#{queuePosition}</span>
                    </div>
                    <div className="text-zinc-500 text-xs mt-3 flex items-center gap-2">
                        <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono border border-zinc-600">Q</kbd>
                        <span>to leave queue</span>
                    </div>
                </div>
            )}

            {nearPortal && !queueMode && !showModeSelect && (
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600/90 via-blue-600/90 to-purple-600/90 backdrop-blur-xl px-8 py-4 rounded-2xl border border-cyan-400/50 shadow-2xl animate-pulse">
                    <div className="text-white text-lg font-black flex items-center gap-3">
                        <span className="text-3xl">🌀</span>
                        <div>
                            <div className="text-xs text-cyan-200 uppercase tracking-wider">Ready to fight?</div>
                            <div>
                                Press <kbd className="px-2 py-0.5 bg-black/30 rounded text-white font-mono mx-1 border border-white/20">E</kbd> to enter queue
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isLocked && !showModeSelect && !isChatOpen && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="text-center bg-gradient-to-br from-black/80 via-zinc-900/80 to-black/80 backdrop-blur-xl p-10 rounded-2xl border border-cyan-500/30 shadow-2xl">
                        <div className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent mb-4 animate-pulse">
                            Click to Enter
                        </div>
                        <div className="text-zinc-300 text-sm">
                            Click anywhere to capture mouse
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}