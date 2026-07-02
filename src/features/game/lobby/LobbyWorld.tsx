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
import { Queues } from './types';

interface LobbyWorldProps {
    wallet: string;
    username: string;
    socket: Socket | null;
    onEnterGame: (roomId: string, mode: string, players: any[]) => void;
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

export function LobbyWorld({ wallet, username, socket, onEnterGame, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const myPlayerModelRef = useRef<THREE.Group | null>(null);
    const playersRef = useRef<Map<string, LobbyPlayerModel>>(new Map());
    const animationFrameRef = useRef<number | null>(null);
    const animatablesRef = useRef<LobbyAnimatables | null>(null);
    const lastTimeRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const isChatOpenRef = useRef(false);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const isInitializedRef = useRef(false);
    const activeMechanicRef = useRef<MechanicId>('none');
    const collisionSystemRef = useRef<CollisionSystem | null>(null);

    const [showBuildingMenu, setShowBuildingMenu] = useState(false);
    const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingPieceType | null>(null);

    const [players, setPlayers] = useState<LobbyPlayerData[]>([]);
    const [queues, setQueues] = useState<Queues>({
        '5v5': { count: 0, max: 10 },
        'ffa': { count: 0, max: 20 },
    });
    const [isLocked, setIsLocked] = useState(false);
    const [currentUsername, setCurrentUsername] = useState(username);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [sceneReady, setSceneReady] = useState(false);
    const [lobbyId, setLobbyId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [showInventory, setShowInventory] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showEmoteWheel, setShowEmoteWheel] = useState(false);
    const [playerPosition, setPlayerPosition] = useState<THREE.Vector3 | null>(null);
    const [hitKey, setHitKey] = useState(0);

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
            .catch(err => console.warn('⚠️ Player model preload failed:', err));
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
    });

    const emotes = useEmoteSystem({ playerModelRef: myPlayerModelRef });

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
            onActivate: () => {
                console.log('Portal activated');
            },
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
            console.log('📥 [LobbyWorld] onLobbyJoined:', data.players?.length, 'players');
            setLobbyId(data.lobbyId);
            setPlayers(data.players);
            setQueues(data.queues as Queues);
            data.players.forEach((player: LobbyPlayerData, index: number) => {
                if (player.id !== socket?.id) {
                    console.log('🎮 [LobbyWorld] Creating model for existing player:', player.id);
                    createOtherPlayerModel(player, index);
                }
            });
        },
        onPlayerJoined: (player: LobbyPlayerData) => {
            console.log('📥 [LobbyWorld] onPlayerJoined:', player.id);
            setPlayers((prev) => [...prev, player]);
            createOtherPlayerModel(player, playersRef.current.size);
        },
        onPlayerLeft: (playerId: string) => {
            console.log('📥 [LobbyWorld] onPlayerLeft:', playerId);
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        },
        onPlayerMoved: (data: any) => {
            const playerData = playersRef.current.get(data.id);
            if (playerData) {
                const pos = Array.isArray(data.position) ? data.position : [data.position.x, data.position.y, data.position.z];
                const rot = Array.isArray(data.rotation) ? data.rotation : [data.rotation.x, data.rotation.y, data.rotation.z];

                const groundOffset = PlayerModelLoader.getGroundOffset();

                playerData.targetPosition.set(pos[0], groundOffset, pos[2]);
                playerData.targetRotationY = rot[1];

                const dist = playerData.group.position.distanceTo(playerData.targetPosition);
                playerData.animData.isMoving = dist > 0.05;
            } else {
                console.warn('⚠️ [LobbyWorld] onPlayerMoved: player not found in map:', data.id);
            }
        },
        onPlayerUsernameChanged: (data: { id: string; username: string }) => {
            setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, username: data.username } : p));
        },
        onQueuesStatusUpdate: (newQueues: any) => setQueues(newQueues as Queues),
        onJoinedQueue: () => { },
        onQueuePositionUpdate: () => { },
        onLeftQueue: () => { },
        onGameStarted: (data: any) => onEnterGame(data.roomId, data.mode, data.players),
        onQueueError: (message: string) => alert(message),
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

            controller.update(deltaTime);

            shooting.update(deltaTime);
            building.update(deltaTime);

            if (myPlayerModelRef.current) {
                setPlayerPosition(myPlayerModelRef.current.position.clone());
            }

            playersRef.current.forEach((playerData) => {
                const lerpFactor = 1 - Math.exp(-15 * deltaTime); // 15 — коэффициент плавности
                playerData.group.position.lerp(playerData.targetPosition, lerpFactor);

                const currentRotY = playerData.group.rotation.y;
                let targetRotY = playerData.targetRotationY;

                let diff = targetRotY - currentRotY;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                playerData.group.rotation.y = currentRotY + diff * lerpFactor;

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
            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
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
    }, [isChatOpen, showMenu, showInventory, showEmoteWheel, showBuildingMenu, isInSafeZone, activeMechanic, selectedBuildingType, shooting, building, handleHotbarSelect]);

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

        playersRef.current.set(player.id, {
            group: cloned,
            animator,
            animData: { walkPhase: 0, isMoving: false, isShooting: false, isReloading: false, isDead: false, hitFlash: 0, deathAnimation: 0 },
            sprite,
            targetPosition: new THREE.Vector3(player.position.x, groundOffset, player.position.z), // <-- ДОБАВИТЬ
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
                visible={isLocked && !isChatOpen && !showMenu && !showInventory && !showEmoteWheel && !showBuildingMenu}
            />

            <LobbyUI
                username={currentUsername}
                playersCount={players.length}
                queues={queues}
                isInSafeZone={isInSafeZone}
                activeMechanic={activeMechanic}
            />

            {activeMechanic === 'shooting' && !isInSafeZone && (
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