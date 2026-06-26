//src\features\game\LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { io, Socket } from "socket.io-client";

interface LobbyWorldProps {
    wallet: string;
    username: string;
    onEnterGame: (roomId: string, players: any[]) => void;
    onExit: () => void;
}

interface GameRoomStatus {
    id: string;
    playersCount: number;
    status: string;
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
    const doorsRef = useRef<Map<string, { mesh: THREE.Mesh; label: THREE.Sprite }>>(new Map());

    const [players, setPlayers] = useState<any[]>([]);
    const [gameRooms, setGameRooms] = useState<GameRoomStatus[]>([]);
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [isInQueue, setIsInQueue] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [nearDoor, setNearDoor] = useState<string | null>(null);

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
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 0, 200);
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

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const groundGeometry = new THREE.BoxGeometry(100, 1, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a7d44,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        createDoors(scene);

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };

        window.addEventListener("resize", handleResize);
    };

    const createDoors = (scene: THREE.Scene) => {
        const doorGeometry = new THREE.BoxGeometry(3, 5, 0.5);
        
        for (let i = 1; i <= 10; i++) {
            const angle = (i - 1) * (Math.PI * 2 / 10);
            const radius = 20;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const doorMaterial = new THREE.MeshStandardMaterial({
                color: 0x8b4513,
                flatShading: true
            });
            
            const door = new THREE.Mesh(doorGeometry, doorMaterial);
            door.position.set(x, 2.5, z);
            door.lookAt(0, 2.5, 0);
            door.castShadow = true;
            door.receiveShadow = true;
            door.userData = { roomId: `game_room_${i}` };
            scene.add(door);
            
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            if (context) {
                context.fillStyle = '#ffffff';
                context.font = 'bold 40px Arial';
                context.textAlign = 'center';
                context.fillText(`Room ${i}`, 128, 50);
                context.font = '30px Arial';
                context.fillText('0/10', 128, 100);
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, 4, z);
            sprite.scale.set(4, 2, 1);
            scene.add(sprite);
            
            doorsRef.current.set(`game_room_${i}`, { mesh: door, label: sprite });
        }
    };

    const updateDoorLabel = (roomId: string, playersCount: number, status: string) => {
        const doorData = doorsRef.current.get(roomId);
        if (!doorData) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (context) {
            context.fillStyle = '#ffffff';
            context.font = 'bold 40px Arial';
            context.textAlign = 'center';
            context.fillText(roomId.replace('game_room_', 'Room '), 128, 50);
            context.font = '30px Arial';
            context.fillText(`${playersCount}/10`, 128, 100);
            
            if (status === 'playing') {
                context.fillStyle = '#ff0000';
                context.fillText('IN GAME', 128, 120);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        doorData.label.material.map = texture;
        doorData.label.material.needsUpdate = true;
    };

    const initSocket = () => {
        const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:3001";
        const socket = io(serverUrl);
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("joinLobby", {
                wallet,
                username
            });
        });

        socket.on("lobbyJoined", (data) => {
            setPlayers(data.players);
            setGameRooms(data.gameRooms);
            setQueuePosition(data.queuePosition);
            setIsInQueue(!!data.queuePosition);
            
            data.gameRooms.forEach((room: GameRoomStatus) => {
                updateDoorLabel(room.id, room.playersCount, room.status);
            });
            
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

        socket.on("gameRoomsStatusUpdate", (rooms: GameRoomStatus[]) => {
            setGameRooms(rooms);
            rooms.forEach((room) => {
                updateDoorLabel(room.id, room.playersCount, room.status);
            });
        });

        socket.on("joinedQueue", (data: { position: number }) => {
            setQueuePosition(data.position);
            setIsInQueue(true);
        });

        socket.on("queuePositionUpdate", (data: { position: number }) => {
            setQueuePosition(data.position);
        });

        socket.on("leftQueue", () => {
            setQueuePosition(null);
            setIsInQueue(false);
        });

        socket.on("joinedGameRoom", (data: any) => {
            onEnterGame(data.roomId, data.players);
        });

        socket.on("enterGameRoomError", (message: string) => {
            alert(message);
        });
    };

    const createPlayerModel = (player: any) => {
        if (!sceneRef.current) return;

        const group = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
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
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
            }

            if (e.code === "KeyE" && nearDoor) {
                socketRef.current?.emit("enterGameRoom", { roomId: nearDoor });
            }

            if (e.code === "KeyQ" && isInQueue) {
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

        let closestDoor: string | null = null;
        let minDistance = 5;

        doorsRef.current.forEach((doorData, roomId) => {
            const distance = cameraRef.current!.position.distanceTo(doorData.mesh.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestDoor = roomId;
            }
        });

        setNearDoor(closestDoor);

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
            
            <div className="absolute top-8 left-8 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-white text-xl font-bold">TANJO LOBBY</div>
                <div className="text-zinc-400 text-sm">Players online: {players.length}</div>
            </div>

            {nearDoor && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
                    <div className="text-white text-lg">Press E to enter {nearDoor.replace('game_room_', 'Room ')}</div>
                </div>
            )}

            {isInQueue && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
                    <div className="text-white text-lg">Queue position: {queuePosition}</div>
                    <div className="text-zinc-400 text-sm">Press Q to leave queue</div>
                </div>
            )}

            {!isInQueue && !nearDoor && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg">
                    <button
                        onClick={() => socketRef.current?.emit("joinQueue", { wallet, username })}
                        className="text-white text-lg hover:text-blue-400"
                    >
                        Join Queue
                    </button>
                </div>
            )}

            {!isLocked && (
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