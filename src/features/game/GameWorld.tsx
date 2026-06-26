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
    mode: string;
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

interface CollisionBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

const FFA_COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff,
    0xff8800, 0x88ff00, 0x0088ff, 0xff0088, 0x8800ff, 0x00ff88,
    0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff,
    0xffaa00, 0xaaff00
];

export function GameWorld({ wallet, roomId, mode, onExit }: GameWorldProps) {
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
    const playerIndexRef = useRef<Map<string, number>>(new Map());
    const collisionBoxesRef = useRef<CollisionBox[]>([]);

    const [players, setPlayers] = useState<Player[]>([]);
    const [myHealth, setMyHealth] = useState(100);
    const [myKills, setMyKills] = useState(0);
    const [myDeaths, setMyDeaths] = useState(0);
    const [ammo, setAmmo] = useState(30);
    const [maxAmmo] = useState(30);
    const [isReloading, setIsReloading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('playing');
    const [scores, setScores] = useState<any>(mode === '5v5' ? { 1: 0, 2: 0 } : {});
    const [winner, setWinner] = useState<any>(null);

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
        scene.background = new THREE.Color(mode === '5v5' ? 0xd4a574 : 0x2a1a3e);
        scene.fog = new THREE.Fog(mode === '5v5' ? 0xd4a574 : 0x2a1a3e, 0, 200);
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
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        const groundGeometry = new THREE.BoxGeometry(200, 1, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: mode === '5v5' ? 0xc2956b : 0x4a2a6e,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        createDust2Map(scene);

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

    const createDust2Map = (scene: THREE.Scene) => {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4a574,
            flatShading: true
        });

        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b6f47,
            flatShading: true
        });

        collisionBoxesRef.current = [];

        const addWall = (x: number, z: number, width: number, depth: number, height: number = 4) => {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(geometry, wallMaterial);
            wall.position.set(x, height / 2, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);

            collisionBoxesRef.current.push({
                minX: x - width / 2,
                maxX: x + width / 2,
                minZ: z - depth / 2,
                maxZ: z + depth / 2
            });
        };

        const addBox = (x: number, z: number, size: number = 2) => {
            const geometry = new THREE.BoxGeometry(size, size, size);
            const box = new THREE.Mesh(geometry, boxMaterial);
            box.position.set(x, size / 2, z);
            box.castShadow = true;
            box.receiveShadow = true;
            scene.add(box);

            collisionBoxesRef.current.push({
                minX: x - size / 2,
                maxX: x + size / 2,
                minZ: z - size / 2,
                maxZ: z + size / 2
            });
        };

        // T-Spawn (террористы) - нижняя часть карты
        addWall(-30, -40, 2, 20);
        addWall(-20, -50, 20, 2);
        addWall(-10, -40, 2, 20);

        // CT-Spawn (контр-террористы) - верхняя часть карты
        addWall(30, 40, 2, 20);
        addWall(20, 50, 20, 2);
        addWall(10, 40, 2, 20);

        // Mid (средняя зона)
        addWall(0, 0, 2, 30);
        addWall(-15, 0, 2, 20);
        addWall(15, 0, 2, 20);

        // Site A (левая верхняя)
        addWall(-35, 25, 15, 2);
        addWall(-35, 35, 15, 2);
        addWall(-42, 30, 2, 10);
        addBox(-35, 30, 3);

        // Site B (правая верхняя)
        addWall(35, 25, 15, 2);
        addWall(35, 35, 15, 2);
        addWall(42, 30, 2, 10);
        addBox(35, 30, 3);

        // Long A (длинный коридор к A)
        addWall(-25, 15, 2, 20);
        addWall(-20, 15, 2, 20);
        addBox(-22, 10, 2);
        addBox(-22, 20, 2);

        // Short A (короткий путь к A)
        addWall(-10, 20, 2, 10);
        addWall(-5, 25, 10, 2);

        // B Tunnels (туннели к B)
        addWall(20, 15, 2, 20);
        addWall(25, 15, 2, 20);
        addBox(22, 10, 2);
        addBox(22, 20, 2);

        // CT Spawn connection
        addWall(0, 35, 20, 2);
        addBox(0, 40, 3);

        // T Spawn connection
        addWall(0, -35, 20, 2);
        addBox(0, -40, 3);

        // Дополнительные укрытия
        addBox(-8, -10, 2);
        addBox(8, -10, 2);
        addBox(-8, 10, 2);
        addBox(8, 10, 2);

        // Границы карты
        addWall(0, -60, 120, 2, 6);
        addWall(0, 60, 120, 2, 6);
        addWall(-60, 0, 2, 120, 6);
        addWall(60, 0, 2, 120, 6);
    };

    const checkCollision = (x: number, z: number, radius: number = 0.5): boolean => {
        for (const box of collisionBoxesRef.current) {
            const closestX = Math.max(box.minX, Math.min(x, box.maxX));
            const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
            
            const distanceX = x - closestX;
            const distanceZ = z - closestZ;
            const distanceSquared = (distanceX * distanceX) + (distanceZ * distanceZ);
            
            if (distanceSquared < (radius * radius)) {
                return true;
            }
        }
        return false;
    };

    const initSocket = () => {
        const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "http://localhost:3001";
        const socket = io(serverUrl);
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected, joining room:", roomId);
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
            if (data.scores) setScores(data.scores);

            data.players.forEach((player: Player, index: number) => {
                playerIndexRef.current.set(player.id, index);
                if (player.id !== socket.id) {
                    createPlayerModel(player, index);
                }
            });
        });

        socket.on("playerJoinedGame", (player: Player) => {
            setPlayers((prev) => [...prev, player]);
            const index = playerIndexRef.current.size;
            playerIndexRef.current.set(player.id, index);
            createPlayerModel(player, index);
        });

        socket.on("playerLeft", (playerId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== playerId));
            removePlayerModel(playerId);
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
            setWinner(data.winner);
            setScores(data.scores);
        });

        socket.on("returnedToLobby", () => {
            console.log("Returned to lobby");
            onExit();
        });

        socket.on("connect_error", (err) => {
            console.error("Connection error:", err);
        });
    };

    const createPlayerModel = (player: Player, index: number) => {
        if (!sceneRef.current) return;

        const group = new THREE.Group();

        let bodyColor: number;
        if (mode === '5v5') {
            bodyColor = player.team === 1 ? 0x0000ff : 0xff0000;
        } else {
            bodyColor = FFA_COLORS[index % FFA_COLORS.length];
        }

        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: bodyColor,
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
            color: bodyColor,
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

            const newX = cameraRef.current.position.x + direction.x * speed;
            const newZ = cameraRef.current.position.z + direction.z * speed;

            // Проверяем коллизии по X и Z отдельно
            if (!checkCollision(newX, cameraRef.current.position.z)) {
                cameraRef.current.position.x = newX;
            }
            if (!checkCollision(cameraRef.current.position.x, newZ)) {
                cameraRef.current.position.z = newZ;
            }

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

    const renderHUD = () => {
        const myUsername = `Player_${wallet.substring(0, 4)}`;
        
        return (
            <GameHUD
                health={myHealth}
                kills={myKills}
                deaths={myDeaths}
                ammo={ammo}
                maxAmmo={maxAmmo}
                isReloading={isReloading}
                roomId={roomId}
                players={players}
                mode={mode as '5v5' | 'ffa'}
                scores={scores}
                myUsername={myUsername}
            />
        );
    };

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />
            {renderHUD()}
            
            {gameStatus === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4">Waiting for players...</div>
                        <div className="text-zinc-400 text-lg">
                            {players.length}/{mode === '5v5' ? 10 : 20} players in room
                        </div>
                    </div>
                </div>
            )}

            {gameStatus === 'ended' && winner && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        {mode === '5v5' ? (
                            <>
                                <div className="text-white text-4xl font-bold mb-4">
                                    {winner.team === 1 ? "🔵 Blue Team Wins!" : "🔴 Red Team Wins!"}
                                </div>
                                <div className="text-zinc-400 text-xl mb-4">
                                    Score: {scores[1]} - {scores[2]}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-yellow-400 text-4xl font-bold mb-4">
                                    🏆 {winner.username} Wins!
                                </div>
                                <div className="text-zinc-400 text-xl mb-4">
                                    {winner.playerId === socketRef.current?.id ? "YOU ARE #1!" : `${winner.username} got 50 kills`}
                                </div>
                            </>
                        )}
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