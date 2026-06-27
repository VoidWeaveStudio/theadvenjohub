//src\features\game\GameWorld.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { GameHUD } from './GameHUD';
import { GameOverlay } from './components/GameOverlay';
import { BulletPool } from './BulletPool';
import { SoundManager } from './SoundManager';
import { Dust2Map } from './map/Dust2Map';
import { PlayerModel } from './models/PlayerModel';
import { WeaponModel } from './models/WeaponModel';
import { useShooting } from './hooks/useShooting';
import { usePlayerControls } from './hooks/usePlayerControls';
import { useGameSocket } from './hooks/useGameSocket';
import { Player, PlayerAnimationData, CollisionBox, GameMode } from './types';
import { PLAYER_HEIGHT } from './constants';

interface GameWorldProps {
    wallet: string;
    roomId: string;
    mode: GameMode;
    socket: Socket | null;
    onExit: () => void;
}

export function GameWorld({ wallet, roomId, mode, socket, onExit }: GameWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playersRef = useRef<Map<string, THREE.Group>>(new Map());
    const animationFrameRef = useRef<number | null>(null);
    const bulletPoolRef = useRef<BulletPool | null>(null);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const playerAnimationDataRef = useRef<Map<string, PlayerAnimationData>>(new Map());
    const collisionBoxesRef = useRef<CollisionBox[]>([]);
    const gameStatusRef = useRef<'waiting' | 'playing' | 'ended'>('playing');
    const isMouseDownRef = useRef(false);
    const updateMovementRef = useRef<(deltaTime: number) => void>(() => {});
    const previousPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
    const [sceneReady, setSceneReady] = useState(false);

    const [players, setPlayers] = useState<Player[]>([]);
    const [myHealth, setMyHealth] = useState(100);
    const [myKills, setMyKills] = useState(0);
    const [myDeaths, setMyDeaths] = useState(0);
    const [ammo, setAmmo] = useState(30);
    const [isReloading, setIsReloading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('playing');
    const [scores, setScores] = useState<any>(mode === '5v5' ? { 1: 0, 2: 0 } : {});
    const [winner, setWinner] = useState<any>(null);

    useEffect(() => {
        gameStatusRef.current = gameStatus;
    }, [gameStatus]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

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
        camera.position.set(-20, PLAYER_HEIGHT, -45);
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight - 64);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

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

        const groundGeometry = new THREE.BoxGeometry(200, 1, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xc2956b,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);

        const map = new Dust2Map();
        map.build(scene);
        collisionBoxesRef.current = map.getCollisionBoxes();

        bulletPoolRef.current = new BulletPool(scene, 50);
        soundManagerRef.current = new SoundManager();

        WeaponModel.create(camera);
        scene.add(camera);

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };

        window.addEventListener('resize', handleResize);
        setSceneReady(true);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [roomId]);

    useEffect(() => {
        if (!sceneReady || !sceneRef.current) return;

        const currentScene = sceneRef.current;
        const currentPlayers = playersRef.current;

        players.forEach((player, index) => {
            if (player.id === socket?.id) return;

            if (!currentPlayers.has(player.id)) {
                const model = PlayerModel.create(currentScene, player, index, mode);
                currentPlayers.set(player.id, model);
                playerAnimationDataRef.current.set(player.id, PlayerModel.createAnimationData());
                previousPositionsRef.current.set(player.id, model.position.clone());
            }
        });

        currentPlayers.forEach((model, playerId) => {
            if (!players.find(p => p.id === playerId)) {
                currentScene.remove(model);
                currentPlayers.delete(playerId);
                playerAnimationDataRef.current.delete(playerId);
                previousPositionsRef.current.delete(playerId);
            }
        });
    }, [players, sceneReady, mode, socket?.id]);

    const { ammoRef, isReloadingRef, startAutoFire, stopAutoFire, reload } = useShooting({
        socket,
        cameraRef,
        bulletPoolRef,
        soundManagerRef,
        gameStatusRef,
        isMouseDownRef,
        playersRef,
        onAmmoChange: setAmmo,
        onReloadChange: setIsReloading
    });

    const { updateMovement } = usePlayerControls({
        containerRef,
        cameraRef,
        socket,
        collisionBoxes: collisionBoxesRef.current,
        gameStatusRef,
        onLockChange: setIsLocked,
        onExit,
        startAutoFire,
        stopAutoFire,
        reload,
        isMouseDownRef
    });

    useEffect(() => {
        updateMovementRef.current = updateMovement;
    }, [updateMovement]);

    const handleGameEnd = useCallback((winnerData: any, scoresData: any) => {
        setGameStatus('ended');
        setWinner(winnerData);
        setScores(scoresData);
        stopAutoFire();
    }, [stopAutoFire]);

    const handleReturnToLobby = useCallback(() => {
        stopAutoFire();
        onExit();
    }, [stopAutoFire, onExit]);

    const handlePlayerShot = useCallback((origin: any, direction: any) => {
        bulletPoolRef.current?.fire(origin, direction);
    }, []);

    const handlePlayerHit = useCallback((targetId: string, health: number) => {
        const animData = playerAnimationDataRef.current.get(targetId);
        if (animData) animData.hitFlash = 0.3;
    }, []);

    const handlePlayerKilled = useCallback((victimId: string) => {
        const model = playersRef.current.get(victimId);
        if (model) {
            model.visible = false;
            
            const fallAnimation = () => {
                if (model.position.y > 0) {
                    model.position.y -= 0.1;
                    model.rotation.x += 0.1;
                    requestAnimationFrame(fallAnimation);
                }
            };
            fallAnimation();
        }
    }, []);

    const handlePlayerRespawned = useCallback((id: string, position: any) => {
        if (id === socket?.id && cameraRef.current) {
            cameraRef.current.position.set(position.x, PLAYER_HEIGHT, position.z);
        } else {
            const model = playersRef.current.get(id);
            if (model) {
                model.visible = true;
                model.position.set(position.x, position.y, position.z);
                model.rotation.set(0, 0, 0);
                previousPositionsRef.current.set(id, model.position.clone());
            }
        }
    }, [socket?.id]);

    const handlePlayerMoved = useCallback((id: string, position: any, rotation: any) => {
        const model = playersRef.current.get(id);
        if (model) {
            model.position.set(position.x, position.y, position.z);
            model.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }, []);

    const handleSpawnPosition = useCallback((position: any) => {
        if (cameraRef.current) {
            cameraRef.current.position.set(position.x, PLAYER_HEIGHT, position.z);
        }
    }, []);

    const handlePositionCorrection = useCallback((position: any, rotation: any) => {
        if (cameraRef.current) {
            cameraRef.current.position.set(position.x, position.y, position.z);
            cameraRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }, []);

    useGameSocket({
        socket,
        wallet,
        roomId,
        mode,
        onPlayersUpdate: setPlayers,
        onHealthUpdate: setMyHealth,
        onKillsUpdate: setMyKills,
        onDeathsUpdate: setMyDeaths,
        onScoresUpdate: setScores,
        onGameEnd: handleGameEnd,
        onReturnToLobby: handleReturnToLobby,
        onPlayerShot: handlePlayerShot,
        onPlayerHit: handlePlayerHit,
        onPlayerKilled: handlePlayerKilled,
        onPlayerRespawned: handlePlayerRespawned,
        onPlayerJoined: () => {},
        onPlayerLeft: () => {},
        onPlayerMoved: handlePlayerMoved,
        onSpawnPosition: handleSpawnPosition,
        onPositionCorrection: handlePositionCorrection
    });

    useEffect(() => {
        let lastTime = 0;

        const animate = (currentTime: number = 0) => {
            animationFrameRef.current = requestAnimationFrame(animate);

            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0.016;
            lastTime = currentTime;

            updateMovementRef.current(deltaTime);
            bulletPoolRef.current?.update(deltaTime);

            playerAnimationDataRef.current.forEach((animData, playerId) => {
                const playerModel = playersRef.current.get(playerId);
                if (playerModel) {
                    const previousPos = previousPositionsRef.current.get(playerId);
                    if (previousPos) {
                        const currentPos = playerModel.position;
                        const distance = previousPos.distanceTo(currentPos);
                        
                        animData.isMoving = distance > 0.01;
                        
                        previousPositionsRef.current.set(playerId, currentPos.clone());
                    }
                    
                    PlayerModel.animate(playerModel, animData, deltaTime);
                }
            });

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            stopAutoFire();
            bulletPoolRef.current?.dispose();
            soundManagerRef.current?.dispose();
            playerAnimationDataRef.current.clear();
            previousPositionsRef.current.clear();

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
    }, [stopAutoFire]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <GameHUD
                health={myHealth}
                kills={myKills}
                deaths={myDeaths}
                ammo={ammo}
                maxAmmo={30}
                isReloading={isReloading}
                roomId={roomId}
                players={players}
                mode={mode}
                scores={scores}
                myUsername={`Player_${wallet.substring(0, 4)}`}
            />

            <GameOverlay
                isLocked={isLocked}
                gameStatus={gameStatus}
                playersCount={players.length}
                maxPlayers={mode === '5v5' ? 10 : 20}
                winner={winner}
                mode={mode}
                scores={scores}
                mySocketId={socket?.id}
                ammo={ammo}
                isReloading={isReloading}
            />
        </div>
    );
}