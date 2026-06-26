//src\features\game\GameWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

// Настройки стрельбы
const FIRE_RATE = 120; // мс между выстрелами
const PLAYER_HEIGHT = 1.6;
const GRAVITY = -0.02;
const JUMP_FORCE = 0.3;
const PLAYER_RADIUS = 0.4;

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

    // Прыжок и гравитация
    const velocityYRef = useRef(0);
    const isOnGroundRef = useRef(true);

    // Автоматическая стрельба
    const isMouseDownRef = useRef(false);
    const shootIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const canShootRef = useRef(true);

    // Патроны через ref для мгновенного доступа в интервале
    const ammoRef = useRef(30);
    const isReloadingRef = useRef(false);
    const gameStatusRef = useRef<'waiting' | 'playing' | 'ended'>('playing');

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

    // Синхронизация state с ref
    useEffect(() => { ammoRef.current = ammo; }, [ammo]);
    useEffect(() => { isReloadingRef.current = isReloading; }, [isReloading]);
    useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);

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
        scene.background = new THREE.Color(0xd4a574);
        scene.fog = new THREE.Fog(0xd4a574, 0, 150);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // ✅ ИСПРАВЛЕНИЕ: спавн за пределами всех стен
        camera.position.set(-20, PLAYER_HEIGHT, -45);
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight - 64);
        renderer.shadowMap.enabled = true;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Освещение в стиле Dust 2 (тёплое, пустынное)
        const ambientLight = new THREE.AmbientLight(0xffeedd, 0.5);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
        sunLight.position.set(30, 80, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -80;
        sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80;
        sunLight.shadow.camera.bottom = -80;
        scene.add(sunLight);

        // Пол (песчаный)
        const groundGeometry = new THREE.BoxGeometry(200, 1, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xc2956b,
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

        const wallDarkMaterial = new THREE.MeshStandardMaterial({
            color: 0xb89060,
            flatShading: true
        });

        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b6f47,
            flatShading: true
        });

        const concreteMaterial = new THREE.MeshStandardMaterial({
            color: 0xa0a090,
            flatShading: true
        });

        collisionBoxesRef.current = [];

        const addWall = (x: number, z: number, width: number, depth: number, height: number = 5, material?: THREE.MeshStandardMaterial) => {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(geometry, material || wallMaterial);
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

        const addBox = (x: number, z: number, size: number = 2, height?: number) => {
            const h = height || size;
            const geometry = new THREE.BoxGeometry(size, h, size);
            const box = new THREE.Mesh(geometry, boxMaterial);
            box.position.set(x, h / 2, z);
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

        // ============================================
        // КАРТА DUST 2 (упрощённая)
        // ============================================
        //
        //   [Site B]          [Site A]
        //       \               /
        //   [B Tunnels]    [Long A]
        //         \           /
        //          [  Mid  ]
        //              |
        //         [T Spawn]
        //

        // === ГРАНИЦЫ КАРТЫ ===
        addWall(0, -65, 140, 2, 8, concreteMaterial); // Южная
        addWall(0, 65, 140, 2, 8, concreteMaterial);  // Северная
        addWall(-70, 0, 2, 130, 8, concreteMaterial); // Западная
        addWall(70, 0, 2, 130, 8, concreteMaterial);  // Восточная

        // === T-SPAWN (юг, z = -40 до -60) ===
        addWall(-25, -50, 2, 20, 5, wallDarkMaterial);   // Левая стена T-spawn
        addWall(25, -50, 2, 20, 5, wallDarkMaterial);    // Правая стена T-spawn
        addBox(-20, -55, 2);                              // Ящик у T-spawn
        addBox(20, -55, 2);                               // Ящик у T-spawn

        // === ВХОД ИЗ T-SPAWN В MID ===
        addWall(-8, -35, 2, 12, 5);
        addWall(8, -35, 2, 12, 5);

        // === MID (центр, z = -25 до 10) ===
        addWall(-18, -10, 2, 30, 5);     // Левая стена mid
        addWall(18, -10, 2, 30, 5);      // Правая стена mid
        addBox(-5, -15, 2.5);             // Ящик mid (укрытие)
        addBox(5, -15, 2.5);              // Ящик mid
        addBox(0, -5, 2);                 // Ящик центр mid

        // === LONG A (запад,通往 Site A) ===
        addWall(-35, -15, 2, 30, 5);     // Внешняя стена Long A
        addWall(-25, -15, 2, 30, 5);     // Внутренняя стена Long A
        addBox(-30, -25, 2);              // Ящик Long A (door)
        addBox(-30, -5, 2);               // Ящик Long A
        addBox(-30, 5, 2.5, 1.5);         // Низкий ящик (можно запрыгнуть)

        // === SHORT A / CATWALK (通往 Site A сверху) ===
        addWall(-20, 10, 12, 2, 5);       // Стена catwalk
        addWall(-20, 18, 12, 2, 5);       // Стена catwalk верх

        // === SITE A (северо-запад) ===
        addWall(-45, 25, 20, 2, 5);       // Южная стена A
        addWall(-45, 45, 20, 2, 5);       // Северная стена A
        addWall(-55, 35, 2, 20, 5);       // Западная стена A
        addWall(-35, 35, 2, 10, 5);       // Восточная стена A (с проходом)
        addBox(-45, 35, 3, 2);             // Ящик на Site A
        addBox(-50, 30, 2);                // Ящик A
        addBox(-40, 40, 2);                // Ящик A

        // === B TUNNELS (восток,通往 Site B) ===
        addWall(35, -15, 2, 30, 5);       // Внешняя стена B tunnels
        addWall(25, -15, 2, 30, 5);       // Внутренняя стена B tunnels
        addBox(30, -25, 2);                // Ящик B tunnels
        addBox(30, -5, 2);                 // Ящик B tunnels
        addBox(30, 5, 2.5, 1.5);           // Низкий ящик

        // === SITE B (северо-восток) ===
        addWall(45, 25, 20, 2, 5);        // Южная стена B
        addWall(45, 45, 20, 2, 5);        // Северная стена B
        addWall(55, 35, 2, 20, 5);        // Восточная стена B
        addWall(35, 35, 2, 10, 5);        // Западная стена B (с проходом)
        addBox(45, 35, 3, 2);              // Ящик на Site B
        addBox(50, 30, 2);                 // Ящик B
        addBox(40, 40, 2);                 // Ящик B

        // === CT SPAWN (север, z = 40 до 60) ===
        addWall(-15, 55, 2, 16, 5, wallDarkMaterial);
        addWall(15, 55, 2, 16, 5, wallDarkMaterial);
        addWall(0, 50, 20, 2, 5, wallDarkMaterial);
        addBox(-10, 58, 2);
        addBox(10, 58, 2);

        // === СОЕДИНЕНИЕ CT -> A и CT -> B ===
        addWall(-25, 50, 2, 12, 5);       // Путь CT к A
        addWall(25, 50, 2, 12, 5);        // Путь CT к B

        // === ДОПОЛНИТЕЛЬНЫЕ УКРЫТИЯ ===
        addBox(-12, 0, 2);                 // Mid укрытие
        addBox(12, 0, 2);                  // Mid укрытие
        addBox(0, 15, 2.5);                // Центр карта

        // === МАРКЕРЫ ЗОН (плоские цветные метки на полу) ===
        const markerGeometry = new THREE.BoxGeometry(4, 0.05, 4);
        
        const tMarker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0xff4444 }));
        tMarker.position.set(0, 0.03, -50);
        scene.add(tMarker);

        const ctMarker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0x4444ff }));
        ctMarker.position.set(0, 0.03, 55);
        scene.add(ctMarker);

        const aMarker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0xffff00 }));
        aMarker.position.set(-45, 0.03, 35);
        scene.add(aMarker);

        const bMarker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
        bMarker.position.set(45, 0.03, 35);
        scene.add(bMarker);
    };

    const checkCollision = (x: number, z: number, radius: number = PLAYER_RADIUS): boolean => {
        for (const box of collisionBoxesRef.current) {
            const closestX = Math.max(box.minX, Math.min(x, box.maxX));
            const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
            
            const distanceX = x - closestX;
            const distanceZ = z - closestZ;
            
            if (distanceX * distanceX + distanceZ * distanceZ < radius * radius) {
                return true;
            }
        }
        return false;
    };

    // ✅ Функция выстрела (используется и в click, и в interval)
    const performShoot = useCallback(() => {
        if (
            isReloadingRef.current ||
            ammoRef.current <= 0 ||
            !cameraRef.current ||
            !socketRef.current ||
            gameStatusRef.current !== 'playing'
        ) {
            // Если патроны кончились - останавливаем стрельбу
            if (ammoRef.current <= 0) {
                stopAutoFire();
            }
            return;
        }

        const newAmmo = ammoRef.current - 1;
        ammoRef.current = newAmmo;
        setAmmo(newAmmo);

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

        // Если патроны кончились
        if (newAmmo <= 0) {
            stopAutoFire();
        }
    }, []);

    // ✅ Запуск автоматической стрельбы
    const startAutoFire = useCallback(() => {
        if (shootIntervalRef.current) return;
        
        // Первый выстрел сразу
        performShoot();
        
        // Потом с интервалом
        shootIntervalRef.current = setInterval(() => {
            performShoot();
        }, FIRE_RATE);
    }, [performShoot]);

    // ✅ Остановка автоматической стрельбы
    const stopAutoFire = useCallback(() => {
        if (shootIntervalRef.current) {
            clearInterval(shootIntervalRef.current);
            shootIntervalRef.current = null;
        }
        isMouseDownRef.current = false;
    }, []);

    const createBulletTrail = (origin: any, direction: any) => {
        if (!bulletPoolRef.current) return;
        bulletPoolRef.current.fire(origin, direction);
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

            // Переместить камеру на позицию спавна от сервера
            if (data.player.position && cameraRef.current) {
                const spawnPos = data.player.position;
                if (!checkCollision(spawnPos.x, spawnPos.z)) {
                    cameraRef.current.position.set(spawnPos.x, PLAYER_HEIGHT, spawnPos.z);
                }
            }

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
                setAmmo(30);
                ammoRef.current = 30;
                if (cameraRef.current) {
                    cameraRef.current.position.set(data.position.x, PLAYER_HEIGHT, data.position.z);
                }
            }
        });

        socket.on("gameEnded", (data) => {
            console.log("Game ended!", data);
            setGameStatus('ended');
            setWinner(data.winner);
            setScores(data.scores);
            stopAutoFire();
        });

        socket.on("returnedToLobby", () => {
            console.log("Returned to lobby");
            stopAutoFire();
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
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        body.name = "body";
        group.add(body);

        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: true });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.9;
        head.castShadow = true;
        head.name = "head";
        group.add(head);

        const armGeometry = new THREE.BoxGeometry(0.25, 1.0, 0.25);
        const armMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true });
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.55, 0.8, 0);
        leftArm.name = "leftArm";
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.55, 0.8, 0);
        rightArm.name = "rightArm";
        group.add(rightArm);

        const legGeometry = new THREE.BoxGeometry(0.3, 1.0, 0.3);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true });
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

    const initControls = () => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.code);

            if (e.code === "Escape") {
                stopAutoFire();
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
                return;
            }

            // ✅ ПРЫЖОК
            if (e.code === "Space" && isOnGroundRef.current && gameStatusRef.current === 'playing') {
                e.preventDefault();
                velocityYRef.current = JUMP_FORCE;
                isOnGroundRef.current = false;
            }

            // ✅ ПЕРЕЗАРЯДКА
            if (e.code === "KeyR" && !isReloadingRef.current && ammoRef.current < 30 && gameStatusRef.current === 'playing') {
                reload();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        // ✅ АВТОМАТИЧЕСКАЯ СТРЕЛЬБА: mousedown запускает, mouseup останавливает
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return; // Только левая кнопка

            if (!document.pointerLockElement) {
                containerRef.current?.requestPointerLock();
                return;
            }

            if (gameStatusRef.current !== 'playing') return;

            isMouseDownRef.current = true;
            startAutoFire();
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) return;
            stopAutoFire();
        };

        if (containerRef.current) {
            containerRef.current.addEventListener("mousedown", handleMouseDown);
        }
        // mouseup на window чтобы ловить даже если мышь ушла за пределы
        window.addEventListener("mouseup", handleMouseUp);

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === containerRef.current;
            isLockedRef.current = locked;
            setIsLocked(locked);
            if (!locked) {
                stopAutoFire();
            }
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
            window.removeEventListener("mouseup", handleMouseUp);
            if (containerRef.current) {
                containerRef.current.removeEventListener("mousedown", handleMouseDown);
            }
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    };

    const reload = () => {
        if (isReloadingRef.current || ammoRef.current >= 30) return;
        
        setIsReloading(true);
        isReloadingRef.current = true;
        stopAutoFire();
        soundManagerRef.current?.playReload();
        
        setTimeout(() => {
            setAmmo(30);
            ammoRef.current = 30;
            setIsReloading(false);
            isReloadingRef.current = false;
        }, 2000);
    };

    const animate = (currentTime: number = 0) => {
        animationFrameRef.current = requestAnimationFrame(animate);

        if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

        const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0.016;
        lastTimeRef.current = currentTime;

        // === ПРЫЖОК И ГРАВИТАЦИЯ ===
        if (!isOnGroundRef.current) {
            velocityYRef.current += GRAVITY;
            cameraRef.current.position.y += velocityYRef.current;

            // Приземление
            if (cameraRef.current.position.y <= PLAYER_HEIGHT) {
                cameraRef.current.position.y = PLAYER_HEIGHT;
                velocityYRef.current = 0;
                isOnGroundRef.current = true;
            }
        }

        // === ДВИЖЕНИЕ С КОЛЛИЗИЯМИ ===
        const speed = 0.15;
        const moveDirection = new THREE.Vector3();

        if (keysRef.current.has("KeyW")) moveDirection.z -= 1;
        if (keysRef.current.has("KeyS")) moveDirection.z += 1;
        if (keysRef.current.has("KeyA")) moveDirection.x -= 1;
        if (keysRef.current.has("KeyD")) moveDirection.x += 1;

        const isMoving = moveDirection.length() > 0;

        if (isMoving && gameStatusRef.current === 'playing') {
            moveDirection.normalize();
            moveDirection.applyQuaternion(cameraRef.current.quaternion);
            moveDirection.y = 0;
            moveDirection.normalize();

            const newX = cameraRef.current.position.x + moveDirection.x * speed;
            const newZ = cameraRef.current.position.z + moveDirection.z * speed;

            // Проверяем коллизии по каждой оси отдельно (скольжение вдоль стен)
            if (!checkCollision(newX, cameraRef.current.position.z)) {
                cameraRef.current.position.x = newX;
            }
            if (!checkCollision(cameraRef.current.position.x, newZ)) {
                cameraRef.current.position.z = newZ;
            }

            // Шаги
            footstepTimerRef.current += deltaTime;
            if (footstepTimerRef.current > 0.35) {
                soundManagerRef.current?.playFootstep();
                footstepTimerRef.current = 0;
            }

            // Отправка позиции на сервер
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

        // === ОБНОВЛЕНИЕ ПУЛЯ И АНИМАЦИИ ===
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

        stopAutoFire();

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
            
            {/* Предупреждение о пустых патронах */}
            {ammo === 0 && !isReloading && gameStatus === 'playing' && (
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-red-900/80 backdrop-blur px-6 py-3 rounded-lg animate-pulse pointer-events-none">
                    <div className="text-red-300 text-lg font-bold">NO AMMO - Press R to Reload</div>
                </div>
            )}

            {/* Индикатор перезарядки */}
            {isReloading && (
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg pointer-events-none">
                    <div className="text-white text-lg font-bold">Reloading...</div>
                    <div className="w-full h-2 bg-zinc-700 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-yellow-400 animate-[loading_2s_linear]" style={{
                            animation: 'loading 2s linear forwards',
                        }} />
                    </div>
                    <style>{`
                        @keyframes loading {
                            from { width: 0%; }
                            to { width: 100%; }
                        }
                    `}</style>
                </div>
            )}

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
                        <div className="text-zinc-500 text-sm">Returning to lobby...</div>
                    </div>
                </div>
            )}

            {!isLocked && gameStatus === 'playing' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/70 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4 animate-pulse">Click to Start</div>
                        <div className="text-zinc-400 text-sm">Click anywhere to capture mouse</div>
                    </div>
                </div>
            )}
        </div>
    );
}