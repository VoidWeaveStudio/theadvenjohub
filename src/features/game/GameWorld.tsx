//src\features\game\GameWorld.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { io, Socket } from "socket.io-client";
import { GameHUD } from "./GameHUD";
import { BulletPool } from "./BulletPool";
import { SoundManager } from "./SoundManager";

interface GameWorldProps {
    wallet: string;
    roomId: string;
    onExit: () => void;
}

interface Player {
    id: string;
    username: string;
    team: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    health: number;
    kills: number;
    deaths: number;
    isAlive: boolean;
}

interface PlayerAnimationData {
    walkPhase: number;
    isMoving: boolean;
    hitFlash: number;
    deathAnimation: number;
}

export function GameWorld({ wallet, roomId, onExit }: GameWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playersRef = useRef<Map<string, THREE.Group>>(new Map());
    const keysRef = useRef<Set<string>>(new Set());
    const isLockedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    
    const bulletPoolRef = useRef<BulletPool | null>(null);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const lastTimeRef = useRef<number>(0);
    const playerAnimationDataRef = useRef<Map<string, PlayerAnimationData>>(new Map());
    const footstepTimerRef = useRef<number>(0);

    const [players, setPlayers] = useState<Player[]>([]);
    const [myHealth, setMyHealth] = useState(100);
    const [myKills, setMyKills] = useState(0);
    const [myDeaths, setMyDeaths] = useState(0);
    const [ammo, setAmmo] = useState(30);
    const [maxAmmo] = useState(30);
    const [isReloading, setIsReloading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('waiting');
    const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
    const [winner, setWinner] = useState<number | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        if (rendererRef.current) {
            if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            rendererRef.current.dispose();
            rendererRef.current = null;
        }

        initThreeJS();
        initSocket();
        initControls();
        animate();

        return () => cleanup();
    }, [roomId]);

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
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
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

        createMap(scene);

        bulletPoolRef.current = new BulletPool(scene, 50);
        soundManagerRef.current = new SoundManager();

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };

        window.addEventListener("resize", handleResize);
    };

    const createMap = (scene: THREE.Scene) => {
        const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            flatShading: true
        });

        const obstacles = [
            { x: -15, z: -10 },
            { x: -15, z: 10 },
            { x: 15, z: -10 },
            { x: 15, z: 10 },
            { x: 0, z: 0 },
            { x: -8, z: 0 },
            { x: 8, z: 0 },
        ];

        obstacles.forEach((pos) => {
            const wall = new THREE.Mesh(boxGeometry, wallMaterial);
            wall.position.set(pos.x, 2, pos.z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
        });

        const spawnGeometry = new THREE.BoxGeometry(2, 0.1, 2);
        const spawnMaterial1 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        const spawnMaterial2 = new THREE.MeshStandardMaterial({ color: 0xff0000 });

        const spawn1 = new THREE.Mesh(spawnGeometry, spawnMaterial1);
        spawn1.position.set(-20, 0.05, 0);
        scene.add(spawn1);

        const spawn2 = new THREE.Mesh(spawnGeometry, spawnMaterial2);
        spawn2.position.set(20, 0.05, 0);
        scene.add(spawn2);
    };

    const initSocket = () => {
        const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:3001";
        const socket = io(serverUrl);
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to game server, joining room:", roomId);
            socket.emit("joinGameRoom", {
                wallet,
                username: `Player_${wallet.substring(0, 4)}`,
                roomId
            });
        });

        socket.on("joinedGameRoom", (data) => {
            console.log("Joined game room:", data);
            setPlayers(data.players);
            setMyHealth(data.player.health);
            setMyKills(data.player.kills);
            setMyDeaths(data.player.deaths);

            data.players.forEach((player: Player) => {
                if (player.id !== socket.id) {
                    createPlayerModel(player);
                }
            });
        });

        socket.on("playerJoinedGameRoom", (player: Player) => {
            setPlayers((prev) => [...prev, player]);
            createPlayerModel(player);
        });

        socket.on("playerLeft", (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
        });

        socket.on("gameStarted", (data) => {
            console.log("Game started!", data);
            setGameStatus('playing');
            setPlayers(data.players);
            setScores(data.scores);

            // Обновить модели с правильными командами
            data.players.forEach((player: Player) => {
                const existingModel = playersRef.current.get(player.id);
                if (existingModel) {
                    removePlayerModel(player.id);
                }
                if (player.id !== socket.id) {
                    createPlayerModel(player);
                }
            });
        });

        socket.on("playerMoved", (data) => {
            const playerModel = playersRef.current.get(data.id);
            if (playerModel) {
                playerModel.position.set(data.position.x, data.position.y, data.position.z);
                playerModel.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            }
        });

        socket.on("playerShot", (data) => {
            createBulletTrail(data.origin, data.direction);
        });

        socket.on("playerHit", (data) => {
            if (data.targetId === socketRef.current?.id) {
                setMyHealth(data.health);
                soundManagerRef.current?.playHit();
            } else {
                const animData = playerAnimationDataRef.current.get(data.targetId);
                if (animData) {
                    animData.hitFlash = 0.3;
                }
            }
        });

        socket.on("playerKilled", (data) => {
            if (data.killerId === socketRef.current?.id) {
                setMyKills((prev) => prev + 1);
            }
            if (data.victimId === socketRef.current?.id) {
                setMyDeaths((prev) => prev + 1);
                soundManagerRef.current?.playDeath();
            }
            if (data.scores) {
                setScores(data.scores);
            }
        });

        socket.on("playerRespawned", (data) => {
            if (data.id === socketRef.current?.id) {
                setMyHealth(100);
                if (cameraRef.current) {
                    cameraRef.current.position.set(data.position.x, data.position.y, data.position.z);
                }
            }
        });

        socket.on("gameEnded", (data) => {
            console.log("Game ended!", data);
            setGameStatus('ended');
            setWinner(data.winningTeam);
            setScores(data.scores);
        });

        socket.on("returnedToLobby", () => {
            console.log("Returned to lobby");
            onExit();
        });

        socket.on("connect_error", (err) => {
            console.error("Connection error:", err);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from server");
        });
    };

    const createPlayerModel = (player: Player) => {
        if (!sceneRef.current) return;

        const group = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: player.team === 1 ? 0x0000ff : 0xff0000,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        body.name = "body";
        group.add(body);

        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            flatShading: true
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.9;
        head.castShadow = true;
        head.name = "head";
        group.add(head);

        const armGeometry = new THREE.BoxGeometry(0.25, 1.0, 0.25);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: player.team === 1 ? 0x0000aa : 0xaa0000,
            flatShading: true
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.55, 0.8, 0);
        leftArm.name = "leftArm";
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.55, 0.8, 0);
        rightArm.name = "rightArm";
        group.add(rightArm);

        const legGeometry = new THREE.BoxGeometry(0.3, 1.0, 0.3);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            flatShading: true
        });

        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.2, 0.0, 0);
        leftLeg.name = "leftLeg";
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.2, 0.0, 0);
        rightLeg.name = "rightLeg";
        group.add(rightLeg);

        group.position.set(player.position.x, player.position.y, player.position.z);
        sceneRef.current.add(group);
        playersRef.current.set(player.id, group);

        playerAnimationDataRef.current.set(player.id, {
            walkPhase: Math.random() * Math.PI * 2,
            isMoving: false,
            hitFlash: 0,
            deathAnimation: 0
        });
    };

    const removePlayerModel = (playerId: string) => {
        const model = playersRef.current.get(playerId);
        if (model && sceneRef.current) {
            sceneRef.current.remove(model);
            playersRef.current.delete(playerId);
            playerAnimationDataRef.current.delete(playerId);
        }
    };

    const createBulletTrail = (origin: any, direction: any) => {
        if (!bulletPoolRef.current) return;
        bulletPoolRef.current.fire(origin, direction);
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

            if (e.code === "KeyR" && !isReloading && ammo < maxAmmo && gameStatus === 'playing') {
                reload();
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
            } else if (gameStatus === 'playing') {
                shoot();
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

        (window as any).__gameCleanup = () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            if (containerRef.current) {
                containerRef.current.removeEventListener("click", handleClick);
            }
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    };

    const shoot = () => {
        if (isReloading || ammo <= 0 || !cameraRef.current || !socketRef.current || gameStatus !== 'playing') return;

        setAmmo((prev) => prev - 1);
        soundManagerRef.current?.playShoot();

        const origin = {
            x: cameraRef.current.position.x,
            y: cameraRef.current.position.y,
            z: cameraRef.current.position.z
        };

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraRef.current.quaternion);

        socketRef.current.emit("shoot", {
            origin,
            direction: { x: direction.x, y: direction.y, z: direction.z },
            damage: 25
        });

        createBulletTrail(origin, direction);
    };

    const reload = () => {
        setIsReloading(true);
        soundManagerRef.current?.playReload();
        setTimeout(() => {
            setAmmo(maxAmmo);
            setIsReloading(false);
        }, 2000);
    };

    const animate = (currentTime: number = 0) => {
        animationFrameRef.current = requestAnimationFrame(animate);

        if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

        const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0.016;
        lastTimeRef.current = currentTime;

        const speed = 0.2;
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

            cameraRef.current.position.add(direction.multiplyScalar(speed));

            footstepTimerRef.current += deltaTime;
            if (footstepTimerRef.current > 0.4) {
                soundManagerRef.current?.playFootstep();
                footstepTimerRef.current = 0;
            }

            if (socketRef.current?.connected) {
                socketRef.current.emit("playerMove", {
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

        bulletPoolRef.current?.update(deltaTime);

        playerAnimationDataRef.current.forEach((animData, playerId) => {
            const playerModel = playersRef.current.get(playerId);
            if (!playerModel) return;

            animData.walkPhase += deltaTime * 8;

            const body = playerModel.getObjectByName("body") as THREE.Mesh;
            if (body) {
                body.position.y = 0.8 + Math.abs(Math.sin(animData.walkPhase)) * 0.05;
            }

            const leftArm = playerModel.getObjectByName("leftArm") as THREE.Mesh;
            const rightArm = playerModel.getObjectByName("rightArm") as THREE.Mesh;
            if (leftArm && rightArm) {
                leftArm.rotation.x = Math.sin(animData.walkPhase) * 0.5;
                rightArm.rotation.x = -Math.sin(animData.walkPhase) * 0.5;
            }

            const leftLeg = playerModel.getObjectByName("leftLeg") as THREE.Mesh;
            const rightLeg = playerModel.getObjectByName("rightLeg") as THREE.Mesh;
            if (leftLeg && rightLeg) {
                leftLeg.rotation.x = -Math.sin(animData.walkPhase) * 0.6;
                rightLeg.rotation.x = Math.sin(animData.walkPhase) * 0.6;
            }

            if (animData.hitFlash > 0) {
                animData.hitFlash -= deltaTime;
                if (body && body.material instanceof THREE.MeshStandardMaterial) {
                    body.material.emissive.setHex(0xff0000);
                    body.material.emissiveIntensity = animData.hitFlash * 5;
                }
            } else if (body && body.material instanceof THREE.MeshStandardMaterial) {
                body.material.emissive.setHex(0x000000);
                body.material.emissiveIntensity = 0;
            }
        });

        rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    const cleanup = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if ((window as any).__gameCleanup) {
            (window as any).__gameCleanup();
            delete (window as any).__gameCleanup;
        }

        socketRef.current?.disconnect();

        bulletPoolRef.current?.dispose();
        bulletPoolRef.current = null;

        soundManagerRef.current?.dispose();
        soundManagerRef.current = null;

        playerAnimationDataRef.current.clear();

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
            <GameHUD
                health={myHealth}
                kills={myKills}
                deaths={myDeaths}
                ammo={ammo}
                maxAmmo={maxAmmo}
                isReloading={isReloading}
                roomId={roomId}
                players={players}
            />
            
            {gameStatus === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4">Waiting for players...</div>
                        <div className="text-zinc-400 text-lg">
                            {players.length}/10 players in room
                        </div>
                        <div className="text-zinc-500 text-sm mt-4">
                            Game will start when 10 players are ready
                        </div>
                    </div>
                </div>
            )}

            {gameStatus === 'ended' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        <div className="text-white text-4xl font-bold mb-4">
                            {winner === 1 ? "🔵 Blue Team Wins!" : "🔴 Red Team Wins!"}
                        </div>
                        <div className="text-zinc-400 text-xl mb-4">
                            Score: {scores[1]} - {scores[2]}
                        </div>
                        <div className="text-zinc-500 text-sm">
                            Returning to lobby...
                        </div>
                    </div>
                </div>
            )}

            {!isLocked && gameStatus === 'playing' && (
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