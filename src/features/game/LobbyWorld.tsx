//src\features\game\LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Socket } from "socket.io-client";
import { LobbyUI } from "./components/LobbyUI";
import { UsernameSprite } from "./utils/UsernameSprite";

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

function unpackPosition(pos: any): { x: number; y: number; z: number } {
    if (Array.isArray(pos)) return { x: pos[0], y: pos[1], z: pos[2] };
    return pos;
}

export function LobbyWorld({ wallet, username, socket, onEnterGame, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playersRef = useRef<Map<string, THREE.Group>>(new Map());
    const usernameSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map());
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const portalRef = useRef<THREE.Mesh | null>(null);
    const portalPositionRef = useRef(new THREE.Vector3(0, 3, -15));
    const lastMoveTimeRef = useRef(0);

    const nearPortalRef = useRef(false);
    const queueModeRef = useRef<string | null>(null);
    const showModeSelectRef = useRef(false);

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

    useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
    useEffect(() => { showModeSelectRef.current = showModeSelect; }, [showModeSelect]);
    useEffect(() => { nearPortalRef.current = nearPortal; }, [nearPortal]);

    const createPortal = useCallback((scene: THREE.Scene) => {
        const torusGeometry = new THREE.TorusGeometry(3, 0.3, 16, 32);
        const torusMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5,
            flatShading: true
        });
        const portal = new THREE.Mesh(torusGeometry, torusMaterial);
        portal.position.set(0, 3, -15);
        portal.castShadow = true;
        scene.add(portal);
        portalRef.current = portal;

        const innerGeometry = new THREE.CircleGeometry(2.8, 32);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const inner = new THREE.Mesh(innerGeometry, innerMaterial);
        inner.position.set(0, 3, -15);
        scene.add(inner);

        const pillarGeometry = new THREE.BoxGeometry(0.6, 6, 0.6);
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a6e,
            flatShading: true
        });

        const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        leftPillar.position.set(-3.5, 3, -15);
        leftPillar.castShadow = true;
        scene.add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        rightPillar.position.set(3.5, 3, -15);
        rightPillar.castShadow = true;
        scene.add(rightPillar);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (context) {
            context.fillStyle = '#00ffff';
            context.font = 'bold 80px Arial';
            context.textAlign = 'center';
            context.fillText('QUEUE', 256, 80);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, 7, -15);
        sprite.scale.set(8, 2, 1);
        scene.add(sprite);
    }, []);

    const createPlayerModel = useCallback((player: PlayerData) => {
        if (!sceneRef.current) return;

        const group = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.2,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            flatShading: true
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.9;
        head.castShadow = true;
        group.add(head);

        group.position.set(player.position.x, 0, player.position.z);
        sceneRef.current.add(group);
        playersRef.current.set(player.id, group);

        const usernameSprite = UsernameSprite.create(player.username, 0x00ffff);
        group.add(usernameSprite);
        usernameSpritesRef.current.set(player.id, usernameSprite);
    }, []);

    const removePlayerModel = useCallback((playerId: string) => {
        const model = playersRef.current.get(playerId);
        if (model && sceneRef.current) {
            sceneRef.current.remove(model);
            playersRef.current.delete(playerId);
        }

        const sprite = usernameSpritesRef.current.get(playerId);
        if (sprite) {
            const material = sprite.material as THREE.SpriteMaterial;
            if (material.map) material.map.dispose();
            material.dispose();
            usernameSpritesRef.current.delete(playerId);
        }
    }, []);

    const updatePlayerUsername = useCallback((playerId: string, username: string) => {
        const sprite = usernameSpritesRef.current.get(playerId);
        if (sprite) {
            UsernameSprite.update(sprite, username, 0x00ffff);
        }
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 0, 100);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 1.6, 0);
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight - 64);
        renderer.shadowMap.enabled = true;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const ambientLight = new THREE.AmbientLight(0x404080, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const portalLight = new THREE.PointLight(0x00ffff, 2, 20);
        portalLight.position.set(0, 3, -15);
        scene.add(portalLight);

        const groundGeometry = new THREE.BoxGeometry(100, 1, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a4e,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        createPortal(scene);

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
    }, [createPortal]);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            console.log("Connected to server");
            socket.emit("joinLobby", { wallet, username: currentUsername });
        };

        const handleLobbyJoined = (data: any) => {
            setPlayers(data.players);
            setQueues(data.queues);
            setQueuePosition(data.queuePosition);
            setQueueMode(data.queueMode);

            data.players.forEach((player: PlayerData) => {
                if (player.id !== socket.id) {
                    createPlayerModel(player);
                }
            });
        };

        const handlePlayerJoinedLobby = (player: PlayerData) => {
            setPlayers((prev) => [...prev, player]);
            createPlayerModel(player);
        };

        const handlePlayerLeftLobby = (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        };

        const handlePlayerMovedInLobby = (data: any) => {
            const playerModel = playersRef.current.get(data.id);
            if (playerModel) {
                const pos = unpackPosition(data.position);
                const rot = unpackPosition(data.rotation);
                playerModel.position.set(pos.x, 0, pos.z);
                playerModel.rotation.set(rot.x, rot.y, rot.z);
            }
        };

        const handlePlayerUsernameChanged = (data: { id: string; username: string }) => {
            setPlayers((prev) => prev.map(p => p.id === data.id ? { ...p, username: data.username } : p));
            updatePlayerUsername(data.id, data.username);
        };

        const handleQueuesStatusUpdate = (newQueues: any) => {
            setQueues(newQueues);
        };

        const handleJoinedQueue = (data: { mode: string; position: number }) => {
            setQueueMode(data.mode);
            setQueuePosition(data.position);
            setShowModeSelect(false);
        };

        const handleQueuePositionUpdate = (data: { position: number }) => {
            setQueuePosition(data.position);
        };

        const handleLeftQueue = () => {
            setQueuePosition(null);
            setQueueMode(null);
        };

        const handleGameStarted = (data: any) => {
            onEnterGame(data.roomId, data.mode, data.players);
        };

        const handleJoinedFFAGame = (data: any) => {
            onEnterGame(data.roomId, data.mode, data.players);
        };

        const handleQueueError = (message: string) => {
            alert(message);
        };

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
    }, [socket, wallet, currentUsername, onEnterGame, createPlayerModel, removePlayerModel, updatePlayerUsername]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.code);

            if (e.code === "Escape") {
                if (showModeSelectRef.current) {
                    setShowModeSelect(false);
                    return;
                }
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
                return;
            }

            if (e.code === "KeyE" && nearPortalRef.current && !queueModeRef.current) {
                console.log("Opening mode select menu");
                setShowModeSelect(true);
                return;
            }

            if (e.code === "KeyQ" && queueModeRef.current) {
                console.log("Leaving queue");
                socket?.emit("leaveQueue");
                return;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        const handleClick = () => {
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

            const speed = 0.2;
            const direction = new THREE.Vector3();

            if (keysRef.current.has("KeyW")) direction.z -= 1;
            if (keysRef.current.has("KeyS")) direction.z += 1;
            if (keysRef.current.has("KeyA")) direction.x -= 1;
            if (keysRef.current.has("KeyD")) direction.x += 1;

            if (direction.length() > 0) {
                direction.normalize();
                direction.applyQuaternion(cameraRef.current.quaternion);
                direction.y = 0;
                direction.normalize();

                cameraRef.current.position.add(direction.multiplyScalar(speed));

                const now = Date.now();
                if (socket?.connected && now - lastMoveTimeRef.current > 50) {
                    socket.emit("lobbyMove", {
                        position: [
                            cameraRef.current.position.x,
                            cameraRef.current.position.y,
                            cameraRef.current.position.z
                        ],
                        rotation: [
                            cameraRef.current.rotation.x,
                            cameraRef.current.rotation.y,
                            cameraRef.current.rotation.z
                        ]
                    });
                    lastMoveTimeRef.current = now;
                }
            }

            if (portalRef.current) {
                portalRef.current.rotation.z += 0.01;
            }

            if (cameraRef.current) {
                const distance = cameraRef.current.position.distanceTo(portalPositionRef.current);
                const isNear = distance < 6;

                nearPortalRef.current = isNear;
                setNearPortal(isNear);
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
            usernameSpritesRef.current.forEach((sprite) => {
                const material = sprite.material as THREE.SpriteMaterial;
                if (material.map) material.map.dispose();
                material.dispose();
            });
            usernameSpritesRef.current.clear();

            if (rendererRef.current) {
                rendererRef.current.dispose();
                if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
            }

            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
    }, []);

    const joinQueue = useCallback((mode: string) => {
        console.log("Joining queue:", mode);
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

            {showModeSelect && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
                    <div className="bg-zinc-900 border border-cyan-500/30 rounded-xl p-8 max-w-md w-full space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-cyan-400 mb-2">SELECT MODE</h2>
                            <p className="text-zinc-400 text-sm">Choose your battle mode</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => joinQueue('5v5')}
                                className="w-full p-4 bg-blue-600/20 border-2 border-blue-500/50 hover:border-blue-400 rounded-lg text-left transition-all hover:bg-blue-600/30"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-white text-xl font-bold">5 vs 5</span>
                                    <span className="text-cyan-400 text-sm">{queues['5v5'].count}/{queues['5v5'].max}</span>
                                </div>
                                <div className="text-zinc-400 text-sm">Team Deathmatch</div>
                                <div className="text-zinc-500 text-xs mt-1">10 players • 50 kills to win</div>
                            </button>

                            <button
                                onClick={() => joinQueue('ffa')}
                                className="w-full p-4 bg-red-600/20 border-2 border-red-500/50 hover:border-red-400 rounded-lg text-left transition-all hover:bg-red-600/30"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-white text-xl font-bold">Survival</span>
                                    <span className="text-cyan-400 text-sm">{queues['ffa'].count}/{queues['ffa'].max}</span>
                                </div>
                                <div className="text-zinc-400 text-sm">Free-for-All • Every man for himself</div>
                                <div className="text-zinc-500 text-xs mt-1">20 players • 50 kills to win • #1 place</div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowModeSelect(false)}
                            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
                        >
                            Cancel (ESC)
                        </button>
                    </div>
                </div>
            )}

            {queueMode && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
                    <div className="text-white text-lg">
                        Queue: <span className="text-cyan-400 font-bold">{queueMode === '5v5' ? '5 vs 5' : 'Survival'}</span>
                    </div>
                    <div className="text-zinc-400 text-sm">Position: {queuePosition}</div>
                    <div className="text-zinc-500 text-xs mt-1">Press Q to leave queue</div>
                </div>
            )}

            {!isLocked && !showModeSelect && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/70 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4 animate-pulse">
                            Click to Start
                        </div>
                        <div className="text-zinc-400 text-sm">
                            Click anywhere to capture mouse
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}