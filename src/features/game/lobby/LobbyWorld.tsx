// src/features/game/lobby/LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Socket } from "socket.io-client";

import { UsernameSprite } from "../utils/UsernameSprite";
import { VoiceChat } from "../components/VoiceChat";
import { TextChat } from "../components/TextChat";
import { Reticle } from "../components/Reticle";

import { PlayerModelLoader } from "../models/PlayerModelLoader";
import { PlayerAnimator, ProceduralAnimationData } from "../models/PlayerAnimator";
import { PlayerAnimationData } from "../types";

import { useLobbySocket, LobbyPlayerData } from "../hooks/network/useLobbySocket";
import { useBasePlayerController } from "../hooks/useBasePlayerController";

import { SoundManager } from '../SoundManager';
import { CAMERA_CONFIG } from '../camera/config';
import { createCameraFromConfig } from '../camera/createCamera';

import { useShootingSystem } from '../mechanics/shooting';
import { useBuildingSystem } from '../mechanics/building';
import { useEmoteSystem, EmoteWheel } from '../mechanics/social';
import { useSafeZone } from '../mechanics/shared/useSafeZone';
import { MechanicId } from '../mechanics/shared/types';
import { BuildingPieceType } from '../mechanics/building/types';

import { LobbyUI } from './components/LobbyUI';
import { Hotbar, HotbarItem } from './components/Hotbar';
import { Inventory } from './components/Inventory';
import { GameMenu } from './components/GameMenu';
import { WeaponHUD } from './components/WeaponHUD';
import { HitMarker } from './components/HitMarker';
import { BuildingMenu } from '../mechanics/building/components/BuildingMenu';

import { CollisionSystem } from '../map/CollisionSystem';

import {
    createAtmosphericEnvironment,
    createPortal,
    updateLobbyAnimations,
    LobbyAnimatables,
} from './LobbyEnvironment';

import { TracerSystem } from '../mechanics/shooting/models/TracerSystem';
import { HitEffect } from '../mechanics/shooting/models/HitEffect';
import { PlayerInterpolator } from '../network/PlayerInterpolator';

interface LobbyWorldProps {
    wallet: string;
    username: string;
    socket: Socket | null;
    onExit: () => void;
}

interface LobbyPlayerModel {
    group: THREE.Group;
    animator: PlayerAnimator;
    animData: PlayerAnimationData;
    sprite: THREE.Sprite;
    targetPosition: THREE.Vector3;
    targetRotationY: number;
}

const PORTAL_POSITION = new THREE.Vector3(0, 3, -15);
const PORTAL_INTERACT_RADIUS = 6;

const HOTBAR_ITEMS: HotbarItem[] = [
    { id: 'rifle', name: 'Rifle', icon: '🔫', mechanic: 'shooting' },
    { id: 'blueprint', name: 'Blueprint', icon: '📐', mechanic: 'building' },
];

export function LobbyWorld({ wallet, username, socket, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const myPlayerModelRef = useRef<THREE.Group | null>(null);
    const playersRef = useRef<Map<string, LobbyPlayerModel>>(new Map());
    const interpolatorsRef = useRef<Map<string, PlayerInterpolator>>(new Map());
    const animationFrameRef = useRef<number | null>(null);
    const animatablesRef = useRef<LobbyAnimatables | null>(null);
    const lastTimeRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const isChatOpenRef = useRef(false);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const isInitializedRef = useRef(false);
    const activeMechanicRef = useRef<MechanicId>('none');
    const collisionSystemRef = useRef<CollisionSystem | null>(null);
    const tracerSystemRef = useRef<TracerSystem | null>(null);
    const hitEffectRef = useRef<HitEffect | null>(null);
    const isDeadRef = useRef(false);

    const [showBuildingMenu, setShowBuildingMenu] = useState(false);
    const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingPieceType | null>(null);

    const [players, setPlayers] = useState<LobbyPlayerData[]>([]);

    const [isLocked, setIsLocked] = useState(false);
    const [currentUsername, setCurrentUsername] = useState(username);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [sceneReady, setSceneReady] = useState(false);
    const [lobbyId, setLobbyId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [myHealth, setMyHealth] = useState(100);
    const [isDead, setIsDead] = useState(false);

    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [showInventory, setShowInventory] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showEmoteWheel, setShowEmoteWheel] = useState(false);
    const [playerPosition, setPlayerPosition] = useState<THREE.Vector3 | null>(null);
    const [hitKey, setHitKey] = useState(0);

    useEffect(() => { isDeadRef.current = isDead; }, [isDead]);

    const handleHotbarSelect = useCallback((index: number) => {
        setSelectedSlot(prev => {
            if (prev === index) {
                return null;
            }
            return index;
        });
    }, []);

    useEffect(() => {
        if (selectedSlot !== 1) {
            setSelectedBuildingType(null);
            setShowBuildingMenu(false);
        }
    }, [selectedSlot]);

    useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

    useEffect(() => {
        soundManagerRef.current = new SoundManager();
        return () => {
            soundManagerRef.current?.dispose();
            soundManagerRef.current = null;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        PlayerModelLoader.preload()
            .then(() => {
                if (isMounted) {
                    setModelLoaded(true);
                }
            })
            .catch(err => {});
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!modelLoaded || !sceneReady) {
            return;
        }

        if (!sceneRef.current) {
            return;
        }

        if (myPlayerModelRef.current) {
            return;
        }

        const cloned = PlayerModelLoader.getModelClone();
        if (!cloned) {
            return;
        }

        const groundOffset = PlayerModelLoader.getGroundOffset();
        const animator = new PlayerAnimator(cloned);
        cloned.userData.animator = animator;
        cloned.position.set(0, groundOffset, 0);

        sceneRef.current.add(cloned);
        myPlayerModelRef.current = cloned;

        if (cameraRef.current) {
            cameraRef.current.position.set(
                cloned.position.x,
                cloned.position.y + CAMERA_CONFIG.heightOffset,
                cloned.position.z + CAMERA_CONFIG.distance
            );
            cameraRef.current.lookAt(cloned.position);
        }
    }, [modelLoaded, sceneReady]);

    const { isInSafeZone } = useSafeZone(playerPosition);

    const activeMechanic: MechanicId = isInSafeZone
        ? 'social'
        : selectedSlot !== null
            ? HOTBAR_ITEMS[selectedSlot]?.mechanic ?? 'none'
            : 'none';

    useEffect(() => {
        activeMechanicRef.current = activeMechanic;
    }, [activeMechanic]);

    const shooting = useShootingSystem({
        cameraRef,
        playerModelRef: myPlayerModelRef,
        sceneRef,
        soundManagerRef,
        isChatOpenRef,
        modelLoaded,
        sceneReady,
        isActive: activeMechanic === 'shooting',
        socket,
        isInGame: false,
        onHit: () => {
            setHitKey(prev => prev + 1);
        },
    });

    const building = useBuildingSystem({
        scene: sceneRef.current,
        sceneRef,
        cameraRef,
        playerModelRef: myPlayerModelRef,
        collisionSystem: collisionSystemRef.current,
        isChatOpenRef,
        modelLoaded,
        sceneReady,
        isActive: activeMechanic === 'building' && !showBuildingMenu,
        selectedType: selectedBuildingType,
        socket,
        isInGame: false,
    });

    const emotes = useEmoteSystem({
        playerModelRef: myPlayerModelRef,
        socket,
        isInGame: false,
    });

    const controller = useBasePlayerController({
        containerRef,
        cameraRef,
        playerModelRef: myPlayerModelRef,
        socket,
        soundManagerRef,
        isChatOpenRef,
        bounds: { maxRadius: 100, groundLevel: 0 },
        interaction: {
            position: PORTAL_POSITION,
            radius: PORTAL_INTERACT_RADIUS,
            onActivate: () => {},
        },
        onLockChange: setIsLocked,
        onExit: () => {
            onExit();
        },
        onChatToggle: (open) => {
            setIsChatOpen(open);
            if (open && document.pointerLockElement) document.exitPointerLock();
        },
        onProceduralDataUpdate: (data: ProceduralAnimationData) => {
            const myModel = myPlayerModelRef.current;
            if (myModel) {
                const animator = myModel.userData.animator as PlayerAnimator | undefined;
                if (animator) animator.update(1 / 60, data);
            }
        },
    });

    const socketHandlers = useRef({
        onLobbyJoined: (data: any) => {
            setLobbyId(data.lobbyId);
            setPlayers(data.players);
            data.players.forEach((player: LobbyPlayerData, index: number) => {
                if (player.id !== socket?.id) {
                    createOtherPlayerModel(player, index);
                }
            });
        },
        onPlayerJoined: (player: LobbyPlayerData) => {
            setPlayers((prev) => [...prev, player]);
            createOtherPlayerModel(player, playersRef.current.size);
        },
        onPlayerLeft: (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        },
        onPlayerMoved: (data: any) => {
            const playerId = data.id;
            const interpolator = interpolatorsRef.current.get(playerId);
            const playerData = playersRef.current.get(playerId);

            if (!interpolator || !playerData) return;

            const pos = Array.isArray(data.position)
                ? { x: data.position[0], y: data.position[1], z: data.position[2] }
                : data.position;

            const rot = Array.isArray(data.rotation)
                ? { x: data.rotation[0], y: data.rotation[1], z: data.rotation[2] }
                : data.rotation;

            const serverTime = data.serverTime || Date.now();

            interpolator.addSnapshot(serverTime, pos, rot);

            const lastPos = playerData.group.position;
            const dist = Math.sqrt(
                Math.pow(pos.x - lastPos.x, 2) +
                Math.pow(pos.z - lastPos.z, 2)
            );
            playerData.animData.isMoving = dist > 0.1;
        },
        onPlayerUsernameChanged: (data: { id: string; username: string }) => {
            setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, username: data.username } : p));
        },
        onLobbyPlayersCount: (count: number) => {},
        onPlayerShotInLobby: (data: any) => {
            const shooterData = playersRef.current.get(data.shooterId);
            if (shooterData) {
                shooterData.animData.isShooting = true;
                setTimeout(() => {
                    if (shooterData) shooterData.animData.isShooting = false;
                }, 200);

                if (sceneRef.current && tracerSystemRef.current) {
                    const shooterPos = shooterData.group.position.clone();
                    shooterPos.y += 1.5;

                    const direction = new THREE.Vector3(
                        data.direction.x,
                        data.direction.y,
                        data.direction.z
                    ).normalize();

                    const endPoint = shooterPos.clone().add(direction.multiplyScalar(100));

                    tracerSystemRef.current.createTracer(shooterPos, endPoint);

                    if (data.hitPlayerId) {
                        const targetData = playersRef.current.get(data.hitPlayerId);
                        if (targetData && hitEffectRef.current) {
                            const hitPos = targetData.group.position.clone();
                            hitPos.y += 1;
                            hitEffectRef.current.createHitEffect(hitPos, new THREE.Vector3(0, 1, 0));
                        }
                    }
                }
            }

            if (data.hitPlayerId === socket?.id) {
                setHitKey(prev => prev + 1);
            }
        },
        onPlayerHitInLobby: (data: any) => {
            const targetData = playersRef.current.get(data.targetId);
            if (targetData) {
                targetData.animData.hitFlash = 0.3;
                setTimeout(() => {
                    if (targetData) targetData.animData.hitFlash = 0;
                }, 300);
            }
            if (data.targetId === socket?.id) {
                setMyHealth(prev => Math.max(0, prev - data.damage));
            }
        },
        onPlayerHealthChanged: (data: any) => {
            if (data.targetId === socket?.id) {
                setMyHealth(data.health);
            }
        },
        onPlayerDiedInLobby: (data: any) => {
            if (data.targetId === socket?.id) {
                setIsDead(true);
            }
            const targetData = playersRef.current.get(data.targetId);
            if (targetData) {
                targetData.animData.isDead = true;
            }
        },
        onPlayerRespawnedInLobby: (data: any) => {
            if (data.targetId === socket?.id) {
                setMyHealth(100);
                setIsDead(false);
                if (myPlayerModelRef.current) {
                    const groundOffset = PlayerModelLoader.getGroundOffset();
                    myPlayerModelRef.current.position.set(data.position.x, groundOffset, data.position.z);
                    myPlayerModelRef.current.rotation.set(0, data.rotation.y, 0);
                    if (cameraRef.current) {
                        cameraRef.current.position.set(
                            data.position.x,
                            data.position.y + CAMERA_CONFIG.heightOffset,
                            data.position.z + CAMERA_CONFIG.distance
                        );
                    }
                }
            } else {
                const targetData = playersRef.current.get(data.targetId);
                if (targetData) {
                    targetData.animData.isDead = false;
                    const groundOffset = PlayerModelLoader.getGroundOffset();
                    targetData.group.position.set(data.position.x, groundOffset, data.position.z);
                    targetData.group.rotation.set(0, data.rotation.y, 0);
                    const interpolator = interpolatorsRef.current.get(data.targetId);
                    if (interpolator) {
                        interpolator.clear();
                        interpolator.addSnapshot(Date.now(), data.position, data.rotation);
                    }
                }
            }
        },
        onPlayerBuildInLobby: (data: any) => {
            if (!building.buildingManagerRef.current) {
                setTimeout(() => {
                    socketHandlers.current.onPlayerBuildInLobby(data);
                }, 100);
                return;
            }

            if (data.action === 'place') {
                const piece = building.buildingManagerRef.current.createPiece(data.pieceType);
                if (piece) {
                    building.buildingManagerRef.current.placePiece(
                        piece,
                        data.position.x,
                        data.position.y,
                        data.position.z,
                        data.rotation.y
                    );
                }
            } else if (data.action === 'remove') {
                const pieces = building.buildingManagerRef.current.getAllPieces();
                const nearestPiece = pieces.find(p => {
                    const dist = p.group.position.distanceTo(
                        new THREE.Vector3(data.position.x, data.position.y, data.position.z)
                    );
                    return dist < 2;
                });

                if (nearestPiece) {
                    building.buildingManagerRef.current.removePiece(nearestPiece.id);
                }
            }
        },
        onPlayerEmoteInLobby: (data: any) => {
            const playerData = playersRef.current.get(data.playerId);
            if (playerData) {
                playerData.animData.isShooting = true;
                setTimeout(() => {
                    if (playerData) playerData.animData.isShooting = false;
                }, 2000);
            }
        },
    });

    useLobbySocket(socket, wallet, currentUsername, socketHandlers.current);

    useEffect(() => {
        if (!containerRef.current) return;

        if (isInitializedRef.current) {
            return;
        }
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

        startTimeRef.current = performance.now();
        lastTimeRef.current = performance.now();

        setSceneReady(true);

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            lastTimeRef.current = currentTime;

            if (!isDeadRef.current) {
                controller.update(deltaTime);
                shooting.update(deltaTime);
                building.update(deltaTime);
            }

            if (myPlayerModelRef.current) {
                setPlayerPosition(myPlayerModelRef.current.position.clone());
            }

            playersRef.current.forEach((playerData, id) => {
                const interpolator = interpolatorsRef.current.get(id);
                if (!interpolator) return;

                const state = interpolator.getInterpolatedState();
                if (state) {
                    const groundOffset = PlayerModelLoader.getGroundOffset();

                    playerData.group.position.x = state.position.x;
                    playerData.group.position.y = groundOffset;
                    playerData.group.position.z = state.position.z;

                    playerData.group.rotation.y = state.rotation.y;
                }

                if (playerData.animator) {
                    playerData.animator.update(deltaTime, {
                        isMoving: playerData.animData.isMoving,
                        moveSpeed: playerData.animData.isMoving ? 1 : 0,
                        strafeInput: 0,
                    });
                }
            });

            if (animatablesRef.current) {
                updateLobbyAnimations(animatablesRef.current, elapsedTime, 0);
            }

            if (tracerSystemRef.current) {
                tracerSystemRef.current.update(deltaTime);
            }
            if (hitEffectRef.current) {
                hitEffectRef.current.update(deltaTime);
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

        return () => {
            isInitializedRef.current = false;
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            playersRef.current.forEach((pd) => {
                if (sceneRef.current) {
                    sceneRef.current.remove(pd.group);
                    pd.group.traverse((obj) => {
                        if (obj instanceof THREE.Mesh) {
                            obj.geometry?.dispose();
                            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                            else obj.material?.dispose();
                        }
                    });
                }
            });
            playersRef.current.clear();
            interpolatorsRef.current.clear();
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
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (isDead) return;

            if (e.code === 'Escape') {
                e.preventDefault();
                if (isChatOpen) return;
                if (showBuildingMenu) {
                    setShowBuildingMenu(false);
                    return;
                }
                if (showEmoteWheel) { setShowEmoteWheel(false); return; }
                if (showInventory) { setShowInventory(false); return; }
                setShowMenu(prev => !prev);
                return;
            }

            if (isChatOpen || showMenu || showInventory || showEmoteWheel || showBuildingMenu) return;

            if (e.code === 'KeyR') {
                if (activeMechanicRef.current === 'shooting' && !isInSafeZone) {
                    shooting.onReload();
                }
                return;
            }

            if (e.code === 'KeyI') {
                setShowInventory(prev => !prev);
                return;
            }

            if (e.code === 'KeyB') {
                if (!isInSafeZone) return;
                setShowEmoteWheel(prev => !prev);
                return;
            }

            if (e.code === 'Digit1') {
                handleHotbarSelect(0);
                return;
            }
            if (e.code === 'Digit2') {
                handleHotbarSelect(1);
                return;
            }

            if (e.code === 'KeyQ') {
                if (activeMechanicRef.current === 'building' && !isInSafeZone) {
                    setShowBuildingMenu(prev => !prev);
                }
                return;
            }

            if (e.code === 'KeyE') {
                if (activeMechanicRef.current === 'building' && !isInSafeZone) {
                    building.interactWithDoor();
                }
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (isDead) return;
            if (isChatOpen || showMenu || showInventory || showEmoteWheel || showBuildingMenu) return;
            if (!isInSafeZone && activeMechanic === 'shooting') {
                if (e.button === 0) shooting.onMouseDown();
            }
            if (!isInSafeZone && activeMechanic === 'building') {
                if (e.button === 0 && selectedBuildingType) {
                    building.placePiece();
                }
                if (e.button === 2) building.removePiece();
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) shooting.onMouseUp();
        };

        const handleContextMenu = (e: MouseEvent) => {
            if (activeMechanic === 'building') e.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('contextmenu', handleContextMenu);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [isChatOpen, showMenu, showInventory, showEmoteWheel, showBuildingMenu, isInSafeZone, activeMechanic, selectedBuildingType, shooting, building, handleHotbarSelect, isDead]);

    const createOtherPlayerModel = useCallback((player: LobbyPlayerData, index: number) => {
        if (!sceneRef.current || playersRef.current.has(player.id)) return;
        const cloned = PlayerModelLoader.getModelClone();
        if (!cloned) return;
        const animator = new PlayerAnimator(cloned);
        cloned.userData.animator = animator;

        const groundOffset = PlayerModelLoader.getGroundOffset();
        cloned.position.set(player.position.x, groundOffset, player.position.z);
        cloned.rotation.set(0, player.rotation.y, 0);

        sceneRef.current.add(cloned);
        const sprite = UsernameSprite.create(player.username, 0x00ffff);
        cloned.add(sprite);

        const interpolator = new PlayerInterpolator();
        interpolator.addSnapshot(Date.now(), player.position, { x: 0, y: player.rotation.y, z: 0 });
        interpolatorsRef.current.set(player.id, interpolator);

        playersRef.current.set(player.id, {
            group: cloned,
            animator,
            animData: { walkPhase: 0, isMoving: false, isShooting: false, isReloading: false, isDead: false, hitFlash: 0, deathAnimation: 0 },
            sprite,
            targetPosition: new THREE.Vector3(player.position.x, groundOffset, player.position.z),
            targetRotationY: player.rotation.y,
        });
    }, []);

    const removePlayerModel = useCallback((playerId: string) => {
        const playerData = playersRef.current.get(playerId);
        if (!playerData || !sceneRef.current) return;
        sceneRef.current.remove(playerData.group);
        playerData.group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material?.dispose();
            }
        });
        playersRef.current.delete(playerId);
        interpolatorsRef.current.delete(playerId);
    }, []);

    const handleUsernameChange = useCallback((newUsername: string) => {
        setCurrentUsername(newUsername);
        socket?.emit('changeUsername', { username: newUsername });
    }, [socket]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <Reticle
                mode="default"
                size={24}
                color="#00ffff"
                opacity={0.6}
                visible={isLocked && !isChatOpen && !showMenu && !showInventory && !showEmoteWheel && !showBuildingMenu && !isDead}
            />

            <LobbyUI
                username={currentUsername}
                playersCount={players.length}
                isInSafeZone={isInSafeZone}
                activeMechanic={activeMechanic}
            />

            {!isInSafeZone && !isDead && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 h-4 bg-black/50 rounded-full overflow-hidden border border-white/20">
                    <div 
                        className="h-full bg-red-500 transition-all duration-300" 
                        style={{ width: `${myHealth}%` }} 
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                        {myHealth} / 100
                    </div>
                </div>
            )}

            {isDead && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col z-50 pointer-events-none">
                    <div className="text-red-500 text-6xl font-bold mb-4 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">YOU DIED</div>
                    <div className="text-white text-xl">Respawning...</div>
                </div>
            )}

            {activeMechanic === 'shooting' && !isInSafeZone && !isDead && (
                <WeaponHUD
                    ammo={shooting.ammo.ammoRef.current}
                    maxAmmo={30}
                    isReloading={shooting.ammo.isReloadingRef.current}
                />
            )}

            <HitMarker hitKey={hitKey} />

            <VoiceChat socket={socket} channelId={lobbyId} myUsername={currentUsername} isChatOpenRef={isChatOpenRef} />
            <TextChat socket={socket} channelId={lobbyId} myUsername={currentUsername} mode="lobby" isOpen={isChatOpen} onToggle={setIsChatOpen} />

            <Hotbar
                items={HOTBAR_ITEMS}
                selectedSlot={selectedSlot ?? -1}
                onSelect={handleHotbarSelect}
            />

            {showInventory && (
                <Inventory items={HOTBAR_ITEMS} onClose={() => setShowInventory(false)} />
            )}

            {showMenu && (
                <GameMenu
                    username={currentUsername}
                    onUsernameChange={handleUsernameChange}
                    onExit={onExit}
                    onClose={() => setShowMenu(false)}
                />
            )}

            {showBuildingMenu && (
                <BuildingMenu
                    isOpen={showBuildingMenu}
                    onSelect={(type) => {
                        setSelectedBuildingType(type);
                        setShowBuildingMenu(false);
                    }}
                    onClose={() => {
                        setShowBuildingMenu(false);
                    }}
                />
            )}

            {showEmoteWheel && isInSafeZone && (
                <EmoteWheel
                    onSelect={(emoteId) => emotes.playEmote(emoteId)}
                    onClose={() => setShowEmoteWheel(false)}
                />
            )}
        </div>
    );
}