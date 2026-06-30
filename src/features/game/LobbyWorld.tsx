// src/features/game/LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Socket } from "socket.io-client";

import { LobbyUI } from "./components/LobbyUI";
import { UsernameSprite } from "./utils/UsernameSprite";
import { VoiceChat } from "./components/VoiceChat";
import { TextChat } from "./components/TextChat";
import { Reticle } from "./components/Reticle";

import { PlayerModelLoader } from "./models/PlayerModelLoader";
import { PlayerAnimator, ProceduralAnimationData } from "./models/PlayerAnimator";
import { PlayerAnimationData } from "./types";

import { useLobbyController } from "./hooks/useLobbyController";
import { useLobbySocket, LobbyPlayerData, QueueStatus } from "./hooks/network/useLobbySocket";
import {
    createAtmosphericEnvironment,
    createPortal,
    updateLobbyAnimations,
    LobbyAnimatables,
} from "./lobby/LobbyEnvironment";

import { PLAYER_HEIGHT } from "./constants";

import { SoundManager } from './SoundManager';

interface Queues {
    '5v5': QueueStatus;
    'ffa': QueueStatus;
}

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
}

const PORTAL_POSITION = new THREE.Vector3(0, 3, -15);
const PORTAL_INTERACT_RADIUS = 6;

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
    const frameCountRef = useRef(0);
    const isChatOpenRef = useRef(false);
    const soundManagerRef = useRef<SoundManager | null>(null);

    const [players, setPlayers] = useState<LobbyPlayerData[]>([]);
    const [queues, setQueues] = useState<Queues>({
        '5v5': { count: 0, max: 10 },
        'ffa': { count: 0, max: 20 },
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
                if (isMounted) setModelLoaded(true);
            })
            .catch(err => console.warn('⚠️ Player model preload failed:', err));

        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!modelLoaded) return;
        if (!sceneRef.current) {
            console.warn(`⏳ [LobbyWorld] Scene not ready yet, waiting...`);
            return;
        }
        if (myPlayerModelRef.current) {
            console.log(`⚠️ [LobbyWorld] My player model already exists`);
            return;
        }

        console.log(`🎮 [LobbyWorld] Creating my player model`);
        const cloned = PlayerModelLoader.getModelClone();
        if (!cloned) {
            console.error(`❌ [LobbyWorld] Failed to clone model`);
            return;
        }

        const groundOffset = PlayerModelLoader.getGroundOffset();
        console.log(`📍 [LobbyWorld] Ground offset from loader: ${groundOffset.toFixed(4)}`);

        const animator = new PlayerAnimator(cloned);
        cloned.userData.animator = animator;
        cloned.position.set(0, groundOffset, 0);

        console.log(`📊 [LobbyWorld] Model initial position: (${cloned.position.x.toFixed(2)}, ${cloned.position.y.toFixed(2)}, ${cloned.position.z.toFixed(2)})`);
        console.log(`📊 [LobbyWorld] Model bounding box minY: ${new THREE.Box3().setFromObject(cloned).min.y.toFixed(4)}`);

        sceneRef.current.add(cloned);
        myPlayerModelRef.current = cloned;
        console.log(`✅ [LobbyWorld] My player model added to scene at y=${groundOffset.toFixed(4)}`);

    }, [modelLoaded]);

    const controller = useLobbyController({
        containerRef,
        cameraRef,
        playerModelRef: myPlayerModelRef,
        socket,
        soundManagerRef,
        isChatOpenRef,
        bounds: { maxRadius: 45, groundLevel: 0 },
        interaction: {
            position: PORTAL_POSITION,
            radius: PORTAL_INTERACT_RADIUS,
            onActivate: () => {
                if (!queueMode) setShowModeSelect(true);
            },
        },
        onLockChange: setIsLocked,
        onExit: () => {
            if (showModeSelect) {
                setShowModeSelect(false);
                return;
            }
            onExit();
        },
        onChatToggle: (open) => {
            setIsChatOpen(open);
            if (open && document.pointerLockElement) {
                document.exitPointerLock();
            }
        },
        onNearInteractionChange: setNearPortal,
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
            setQueues(data.queues as Queues);
            setQueuePosition(data.queuePosition);
            setQueueMode(data.queueMode);

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
            const playerData = playersRef.current.get(data.id);
            if (playerData) {
                playerData.group.position.set(data.position.x, 0, data.position.z);
                playerData.group.rotation.set(0, data.rotation.y, 0);

                const prevPos = playerData.group.userData.lastPosition;
                if (prevPos) {
                    const dist = playerData.group.position.distanceTo(prevPos);
                    playerData.animData.isMoving = dist > 0.01;
                }
                playerData.group.userData.lastPosition = playerData.group.position.clone();
            }
        },
        onPlayerUsernameChanged: (data: { id: string; username: string }) => {
            setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, username: data.username } : p));
            updatePlayerUsername(data.id, data.username);
        },
        onQueuesStatusUpdate: (newQueues: any) => setQueues(newQueues as Queues),
        onJoinedQueue: (data: { mode: string; position: number }) => {
            setQueueMode(data.mode);
            setQueuePosition(data.position);
            setShowModeSelect(false);
        },
        onQueuePositionUpdate: (data: { position: number }) => setQueuePosition(data.position),
        onLeftQueue: () => {
            setQueuePosition(null);
            setQueueMode(null);
        },
        onGameStarted: (data: any) => onEnterGame(data.roomId, data.mode, data.players),
        onQueueError: (message: string) => alert(message),
    });

    useLobbySocket(socket, wallet, currentUsername, socketHandlers.current);

    useEffect(() => {
        if (!containerRef.current) return;

        console.log(`🎬 [LobbyWorld] Initializing lobby scene`);

        if (rendererRef.current) {
            if (containerRef.current.contains(rendererRef.current.domElement)) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            rendererRef.current.dispose();
            rendererRef.current = null;
        }
        if (sceneRef.current) {
            sceneRef.current = null;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2a2a4e);
        scene.fog = new THREE.FogExp2(0x2a2a4e, 0.02);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            500,
        );
        camera.position.set(0, 2.5, 6);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const ambientLight = new THREE.AmbientLight(0x8080c0, 0.6);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xa0a0ff, 0x404080, 0.5);
        scene.add(hemiLight);

        const moonLight = new THREE.DirectionalLight(0xc0c0ff, 0.8);
        moonLight.position.set(50, 100, 50);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(2048, 2048);
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 200;
        moonLight.shadow.bias = -0.0001;
        const d = 50;
        moonLight.shadow.camera.left = -d;
        moonLight.shadow.camera.right = d;
        moonLight.shadow.camera.top = d;
        moonLight.shadow.camera.bottom = -d;
        scene.add(moonLight);

        const groundGeo = new THREE.CircleGeometry(80, 64);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a5e,
            metalness: 0.1,
            roughness: 0.8,
            side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        const env = createAtmosphericEnvironment(scene);
        const portal = createPortal(scene);

        animatablesRef.current = {
            ...env,
            portalRing: portal.portalRing,
            portalInnerRing: portal.innerRing,
            portalSphere: portal.sphere,
        };

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            const width = window.innerWidth;
            const height = window.innerHeight;
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        startTimeRef.current = performance.now();
        lastTimeRef.current = performance.now();

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            lastTimeRef.current = currentTime;
            frameCountRef.current++;

            if (myPlayerModelRef.current && frameCountRef.current < 10) {
                console.log(` [LobbyWorld] Frame ${frameCountRef.current}: BEFORE update - player Y: ${myPlayerModelRef.current.position.y.toFixed(4)}`);
            }

            controller.update(deltaTime);

            if (myPlayerModelRef.current && frameCountRef.current < 10) {
                console.log(`📊 [LobbyWorld] Frame ${frameCountRef.current}: AFTER update - player Y: ${myPlayerModelRef.current.position.y.toFixed(4)}`);
            }

            playersRef.current.forEach((playerData) => {
                if (playerData.animator) {
                    const data: ProceduralAnimationData = {
                        isMoving: playerData.animData.isMoving,
                        moveSpeed: playerData.animData.isMoving ? 1 : 0,
                        strafeInput: 0,
                        isDead: playerData.animData.isDead,
                        isShooting: playerData.animData.isShooting,
                        isReloading: playerData.animData.isReloading,
                    };
                    playerData.animator.update(deltaTime, data);
                }
            });

            if (animatablesRef.current) {
                updateLobbyAnimations(
                    animatablesRef.current,
                    elapsedTime,
                    frameCountRef.current,
                );
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

        return () => {
            console.log(`🗑️ [LobbyWorld] Cleaning up lobby scene`);
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            playersRef.current.forEach((playerData) => {
                if (sceneRef.current) {
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
                        mat.map?.dispose();
                        mat.dispose();
                    }
                }
            });
            playersRef.current.clear();

            if (containerRef.current && rendererRef.current) {
                if (containerRef.current.contains(rendererRef.current.domElement)) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current.dispose();
                rendererRef.current = null;
            }

            sceneRef.current = null;
            cameraRef.current = null;
        };
    }, []);

    const createOtherPlayerModel = useCallback((player: LobbyPlayerData, index: number) => {
        if (!sceneRef.current) return;
        if (playersRef.current.has(player.id)) return;

        let group: THREE.Group;
        let animator: PlayerAnimator | null = null;

        if (modelLoaded) {
            const cloned = PlayerModelLoader.getModelClone();
            if (cloned) {
                group = cloned;
                animator = new PlayerAnimator(group);
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
                opacity: 0.8,
            }),
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.02;
        group.add(indicator);

        group.userData.playerId = player.id;

        const groundOffset = PlayerModelLoader.getGroundOffset();
        group.position.set(player.position.x, groundOffset, player.position.z);
        group.rotation.set(0, player.rotation.y, 0);

        sceneRef.current.add(group);

        const sprite = UsernameSprite.create(player.username, 0x00ffff);
        group.add(sprite);

        playersRef.current.set(player.id, {
            group,
            animator: animator!,
            animData: {
                walkPhase: Math.random() * Math.PI * 2,
                isMoving: false,
                isShooting: false,
                isReloading: false,
                isDead: false,
                hitFlash: 0,
                deathAnimation: 0,
            },
            sprite,
        });
    }, [modelLoaded]);

    const createFallbackModel = (): THREE.Group => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8),
            new THREE.MeshStandardMaterial({
                color: 0x00ff88,
                emissive: 0x00ff88,
                emissiveIntensity: 0.2,
                flatShading: true,
            }),
        );
        body.position.y = 0.8;
        group.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: true }),
        );
        head.position.y = 1.85;
        group.add(head);

        return group;
    };

    const removePlayerModel = useCallback((playerId: string) => {
        const playerData = playersRef.current.get(playerId);
        if (!playerData || !sceneRef.current) return;

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
            mat.map?.dispose();
            mat.dispose();
        }

        playersRef.current.delete(playerId);
    }, []);

    const updatePlayerUsername = useCallback((playerId: string, username: string) => {
        const playerData = playersRef.current.get(playerId);
        if (playerData?.sprite) {
            UsernameSprite.update(playerData.sprite, username, 0x00ffff);
        }
    }, []);

    const joinQueue = useCallback((mode: string) => {
        socket?.emit('joinQueue', { mode, wallet, username: currentUsername });
    }, [socket, wallet, currentUsername]);

    const leaveQueue = useCallback(() => {
        socket?.emit('leaveQueue');
    }, [socket]);

    const handleUsernameChange = useCallback((newUsername: string) => {
        setCurrentUsername(newUsername);
        socket?.emit('changeUsername', { username: newUsername });
    }, [socket]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <Reticle mode="default" size={24} color="#00ffff" opacity={0.6} visible={isLocked && !isChatOpen} />

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
                <ModeSelectModal
                    queues={queues}
                    onSelect={joinQueue}
                    onCancel={() => setShowModeSelect(false)}
                />
            )}

            {queueMode && (
                <QueueStatusPanel
                    mode={queueMode}
                    position={queuePosition}
                    onLeave={leaveQueue}
                />
            )}

            {nearPortal && !queueMode && !showModeSelect && (
                <PortalPrompt />
            )}
        </div>
    );
}

function ModeSelectModal({
    queues,
    onSelect,
    onCancel,
}: {
    queues: Queues;
    onSelect: (mode: string) => void;
    onCancel: () => void;
}) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
            <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent mb-2">
                        SELECT MODE
                    </h2>
                    <p className="text-zinc-400 text-sm">Choose your battle mode</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => onSelect('5v5')}
                        className="w-full p-4 bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-2 border-blue-500/50 hover:border-blue-400 rounded-xl text-left transition-all"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white text-xl font-black">5 vs 5</span>
                            <span className="text-cyan-400 text-sm font-mono font-bold">
                                {queues['5v5'].count}/{queues['5v5'].max}
                            </span>
                        </div>
                        <div className="text-zinc-300 text-sm font-semibold">Team Deathmatch</div>
                        <div className="text-zinc-500 text-xs mt-1">10 players • 50 kills to win • 10 min</div>
                    </button>

                    <button
                        onClick={() => onSelect('ffa')}
                        className="w-full p-4 bg-gradient-to-br from-red-600/20 to-red-800/20 border-2 border-red-500/50 hover:border-red-400 rounded-xl text-left transition-all"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white text-xl font-black">Survival</span>
                            <span className="text-cyan-400 text-sm font-mono font-bold">
                                {queues['ffa'].count}/{queues['ffa'].max}
                            </span>
                        </div>
                        <div className="text-zinc-300 text-sm font-semibold">Free-for-All</div>
                        <div className="text-zinc-500 text-xs mt-1">20 players • 50 kills to win • 10 min</div>
                    </button>
                </div>

                <button
                    onClick={onCancel}
                    className="w-full py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                >
                    Cancel (ESC)
                </button>
            </div>
        </div>
    );
}

function QueueStatusPanel({
    mode,
    position,
    onLeave,
}: {
    mode: string;
    position: number | null;
    onLeave: () => void;
}) {
    return (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-8 py-5 rounded-2xl border border-cyan-500/40 shadow-2xl">
            <div className="text-white text-lg font-bold">
                Queue: <span className="text-cyan-400 font-black">{mode === '5v5' ? '5 vs 5' : 'Survival'}</span>
            </div>
            <div className="text-zinc-400 text-sm mt-1">
                Position: <span className="text-white font-black text-lg">#{position}</span>
            </div>
            <div className="text-zinc-500 text-xs mt-3 flex items-center gap-2">
                <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono border border-zinc-600">Q</kbd>
                <span>to leave queue</span>
            </div>
        </div>
    );
}

function PortalPrompt() {
    return (
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
    );
}