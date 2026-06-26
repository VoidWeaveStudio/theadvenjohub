//src\features\game\LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { io, Socket } from "socket.io-client";

interface LobbyWorldProps {
    wallet: string;
    username: string;
    onEnterGame: (roomId: string, mode: string, players: any[]) => void;
    onExit: () => void;
}

interface QueueStatus {
    count: number;
    max: number;
}

export function LobbyWorld({ wallet, username, onEnterGame, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playersRef = useRef<Map<string, THREE.Group>>(new Map());
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const portalRef = useRef<THREE.Mesh | null>(null);

    const [players, setPlayers] = useState<any[]>([]);
    const [queues, setQueues] = useState<{ '5v5': QueueStatus; 'ffa': QueueStatus }>({
        '5v5': { count: 0, max: 10 },
        'ffa': { count: 0, max: 20 }
    });
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [queueMode, setQueueMode] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [nearPortal, setNearPortal] = useState(false);
    const [showModeSelect, setShowModeSelect] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        initThreeJS();
        initSocket();
        initControls();
        animate();

        return () => cleanup();
    }, []);

    const initThreeJS = () => {
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

        // Освещение
        const ambientLight = new THREE.AmbientLight(0x404080, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Точечный свет для портала
        const portalLight = new THREE.PointLight(0x00ffff, 2, 20);
        portalLight.position.set(0, 3, -15);
        scene.add(portalLight);

        // Пол
        const groundGeometry = new THREE.BoxGeometry(100, 1, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a4e,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        // Создаём портал
        createPortal(scene);

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };

        window.addEventListener("resize", handleResize);
    };

    const createPortal = (scene: THREE.Scene) => {
        // Арка портала (тор)
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

        // Внутренняя часть портала (полупрозрачная)
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

        // Столбы по бокам
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

        // Надпись "QUEUE" над порталом
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
    };

    const initSocket = () => {
        const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:3001";
        const socket = io(serverUrl);
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("joinLobby", { wallet, username });
        });

        socket.on("lobbyJoined", (data) => {
            setPlayers(data.players);
            setQueues(data.queues);
            setQueuePosition(data.queuePosition);
            setQueueMode(data.queueMode);

            data.players.forEach((player: any) => {
                if (player.id !== socket.id) {
                    createPlayerModel(player);
                }
            });
        });

        socket.on("playerJoinedLobby", (player: any) => {
            setPlayers((prev) => [...prev, player]);
            createPlayerModel(player);
        });

        socket.on("playerLeftLobby", (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        });

        socket.on("playerMovedInLobby", (data: any) => {
            const playerModel = playersRef.current.get(data.id);
            if (playerModel) {
                playerModel.position.set(data.position.x, data.position.y, data.position.z);
                playerModel.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            }
        });

        socket.on("queuesStatusUpdate", (newQueues: any) => {
            setQueues(newQueues);
        });

        socket.on("joinedQueue", (data: { mode: string; position: number }) => {
            setQueueMode(data.mode);
            setQueuePosition(data.position);
            setShowModeSelect(false);
        });

        socket.on("queuePositionUpdate", (data: { position: number }) => {
            setQueuePosition(data.position);
        });

        socket.on("leftQueue", () => {
            setQueuePosition(null);
            setQueueMode(null);
        });

        socket.on("gameStarted", (data: any) => {
            onEnterGame(data.roomId, data.mode, data.players);
        });
        socket.on("joinedFFAGame", (data: any) => {
            onEnterGame(data.roomId, data.mode, data.players);
        });

        socket.on("playerJoinedFFAGame", (player: any) => {
            // Игрок подключился к FFA игре
            console.log("Player joined FFA game:", player.username);
        });

        socket.on("queueError", (message: string) => {
            alert(message);
        });
    };

    const createPlayerModel = (player: any) => {
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

        group.position.set(player.position.x, player.position.y, player.position.z);
        sceneRef.current.add(group);
        playersRef.current.set(player.id, group);
    };

    const removePlayerModel = (playerId: string) => {
        const model = playersRef.current.get(playerId);
        if (model && sceneRef.current) {
            sceneRef.current.remove(model);
            playersRef.current.delete(playerId);
        }
    };

    const initControls = () => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.code);

            if (e.code === "Escape") {
                if (showModeSelect) {
                    setShowModeSelect(false);
                    return;
                }
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
            }

            if (e.code === "KeyE" && nearPortal && !queueMode) {
                setShowModeSelect(true);
            }

            if (e.code === "KeyQ" && queueMode) {
                socketRef.current?.emit("leaveQueue");
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        const handleClick = () => {
            if (!document.pointerLockElement) {
                containerRef.current?.requestPointerLock();
            }
        };

        if (containerRef.current) {
            containerRef.current.addEventListener("click", handleClick);
        }

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === containerRef.current;
            isLockedRef.current = locked;
            setIsLocked(locked);
        };

        document.addEventListener("pointerlockchange", handlePointerLockChange);

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

        document.addEventListener("mousemove", handleMouseMove);
    };

    const joinQueue = (mode: string) => {
        socketRef.current?.emit("joinQueue", { mode, wallet, username });
    };

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

            if (socketRef.current?.connected) {
                socketRef.current.emit("lobbyMove", {
                    position: {
                        x: cameraRef.current.position.x,
                        y: cameraRef.current.position.y,
                        z: cameraRef.current.position.z
                    },
                    rotation: {
                        x: cameraRef.current.rotation.x,
                        y: cameraRef.current.rotation.y,
                        z: cameraRef.current.rotation.z
                    }
                });
            }
        }

        // Анимация портала (вращение)
        if (portalRef.current) {
            portalRef.current.rotation.z += 0.01;
        }

        // Проверка близости к порталу
        const portalPosition = new THREE.Vector3(0, 3, -15);
        const distance = cameraRef.current.position.distanceTo(portalPosition);
        setNearPortal(distance < 6);

        rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    const cleanup = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        socketRef.current?.disconnect();

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

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            {/* Верхняя панель */}
            <div className="absolute top-8 left-8 bg-black/70 backdrop-blur px-4 py-3 rounded-lg">
                <div className="text-cyan-400 text-xl font-bold">TANJO LOBBY</div>
                <div className="text-zinc-400 text-sm">Players online: {players.length}</div>
            </div>

            {/* Статус очередей */}
            <div className="absolute top-8 right-8 bg-black/70 backdrop-blur px-4 py-3 rounded-lg space-y-2">
                <div className="text-white font-bold mb-2">Queues</div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-white text-sm">5v5:</span>
                    <span className="text-cyan-400 font-bold">{queues['5v5'].count}/{queues['5v5'].max}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-white text-sm">FFA:</span>
                    <span className="text-cyan-400 font-bold">{queues['ffa'].count}/{queues['ffa'].max}</span>
                </div>
            </div>

            {/* Подсказка у портала */}
            {nearPortal && !queueMode && !showModeSelect && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg animate-pulse">
                    <div className="text-cyan-400 text-lg font-bold">Press E to enter Queue</div>
                </div>
            )}

            {/* Меню выбора режима */}
            {showModeSelect && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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

            {/* Статус очереди */}
            {queueMode && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
                    <div className="text-white text-lg">
                        Queue: <span className="text-cyan-400 font-bold">{queueMode === '5v5' ? '5 vs 5' : 'Survival'}</span>
                    </div>
                    <div className="text-zinc-400 text-sm">Position: {queuePosition}</div>
                    <div className="text-zinc-500 text-xs mt-1">Press Q to leave queue</div>
                </div>
            )}

            {/* Подсказка управления */}
            <div className="absolute bottom-8 right-8 bg-black/70 backdrop-blur px-4 py-2 rounded-lg text-xs text-zinc-400">
                <div>WASD - Move</div>
                <div>E - Interact</div>
                <div>ESC - Exit</div>
            </div>

            {/* Экран захвата мыши */}
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