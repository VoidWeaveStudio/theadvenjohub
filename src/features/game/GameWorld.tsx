// src/features/game/GameWorld.tsx
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
import { PlayerModelLoader } from './models/PlayerModelLoader';
import { WeaponModel } from './models/WeaponModel';
import { useShooting } from './hooks/useShooting';
import { usePlayerControls } from './hooks/usePlayerControls';
import { useGameSocket } from './hooks/useGameSocket';
import { Player, PlayerAnimationData, CollisionBox, GameMode } from './types';
import { pushOutOfCollision } from './map/collision';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import { VoiceChat } from './components/VoiceChat';
import { TextChat } from './components/TextChat';

interface GameWorldProps {
    wallet: string;
    roomId: string;
    mode: GameMode;
    socket: Socket | null;
    onExit: () => void;
}

interface PlayerExtrapolation {
    targetPosition: THREE.Vector3;
    targetRotation: THREE.Euler;
    velocity: THREE.Vector3;
    lastUpdateTime: number;
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
    const updateMovementRef = useRef<(deltaTime: number) => void>(() => { });
    const previousPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
    const extrapolationDataRef = useRef<Map<string, PlayerExtrapolation>>(new Map());
    const [sceneReady, setSceneReady] = useState(false);

    const playersDataRef = useRef<Map<string, Player>>(new Map());
    const [hudPlayers, setHudPlayers] = useState<Player[]>([]);

    const [myHealth, setMyHealth] = useState(100);
    const [myKills, setMyKills] = useState(0);
    const [myDeaths, setMyDeaths] = useState(0);
    const [ammo, setAmmo] = useState(30);
    const [isReloading, setIsReloading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('playing');
    const [scores, setScores] = useState<any>(mode === '5v5' ? { 1: 0, 2: 0 } : {});
    const [winner, setWinner] = useState<any>(null);
    const [matchEndTime, setMatchEndTime] = useState<number | null>(null);
    const [spawnProtectionUntil, setSpawnProtectionUntil] = useState<number>(0);

    const playerModelRef = useRef<THREE.Group | null>(null);
    const [isThirdPerson, setIsThirdPerson] = useState(false);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const isChatOpenRef = useRef(false);

    useEffect(() => {
        isChatOpenRef.current = isChatOpen;
    }, [isChatOpen]);

    const myUsername = `Player_${wallet.substring(0, 4)}`;
    const myTeam = hudPlayers.find(p => p.id === socket?.id)?.team;

    useEffect(() => {
        gameStatusRef.current = gameStatus;
    }, [gameStatus]);

    useEffect(() => {
        PlayerModelLoader.preload().catch(err => {
            console.warn('⚠️ Player model preload failed, using fallback:', err);
        });
    }, []);

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
        renderer.shadowMap.type = THREE.PCFShadowMap;
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

        console.log(`🗺️ Procedural Dust 2 map built: ${collisionBoxesRef.current.length} collision boxes`);

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
            map.dispose();
        };
    }, [roomId]);

    useEffect(() => {
        if (!sceneReady || !sceneRef.current) return;

        setTimeout(() => {
            if (!sceneRef.current) return;

            collisionBoxesRef.current.forEach((box, i) => {
                const width = box.maxX - box.minX;
                const depth = box.maxZ - box.minZ;
                const height = 5;

                if (width < 0.1 || depth < 0.1) return;

                const geo = new THREE.BoxGeometry(width, height, depth);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(
                    box.minX + width / 2,
                    height / 2,
                    box.minZ + depth / 2
                );
                sceneRef.current!.add(mesh);
            });

            console.log(`🔴 Visualized ${collisionBoxesRef.current.length} collision boxes`);
        }, 2000);
    }, [sceneReady]);

    const { ammoRef, isReloadingRef, startAutoFire, stopAutoFire, reload } = useShooting({
        socket,
        cameraRef,
        bulletPoolRef,
        soundManagerRef,
        gameStatusRef,
        isMouseDownRef,
        playersRef,
        playerAnimationDataRef, 
        onAmmoChange: setAmmo,
        onReloadChange: setIsReloading
    });

    const { updateMovement, isThirdPersonRef, updateThirdPersonCamera } = usePlayerControls({
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
        isMouseDownRef,
        onThirdPersonToggle: (enabled) => {
            setIsThirdPerson(enabled);
            if (playerModelRef.current) {
                playerModelRef.current.visible = enabled;
            }
        },
        playerModelRef,
        onChatToggle: setIsChatOpen,
        isChatOpenRef
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

    const handlePlayerShot = useCallback((shooterId: string, origin: any, direction: any) => {
        bulletPoolRef.current?.fire(origin, direction);
        
        const animData = playerAnimationDataRef.current.get(shooterId);
        if (animData) {
            animData.isShooting = true;
            setTimeout(() => {
                if (animData) animData.isShooting = false;
            }, 300);
        }
    }, []);

    const handlePlayerHit = useCallback((targetId: string, health: number) => {
        const animData = playerAnimationDataRef.current.get(targetId);
        if (animData) animData.hitFlash = 0.3;
    }, []);

    const handlePlayerKilled = useCallback((victimId: string) => {
        const model = playersRef.current.get(victimId);
        const animData = playerAnimationDataRef.current.get(victimId);
        
        if (animData) {
            animData.isDead = true;
        }
        
        if (model) {
            setTimeout(() => {
                model.visible = false;
            }, 2000);
        }
    }, []);

    const handlePlayerRespawned = useCallback((id: string, position: any, spawnProtectionUntil?: number) => {
        const animData = playerAnimationDataRef.current.get(id);
        if (animData) {
            animData.isDead = false;
        }
        
        if (id === socket?.id && cameraRef.current) {
            cameraRef.current.position.set(position.x, PLAYER_HEIGHT, position.z);

            const pushed = pushOutOfCollision(
                position.x,
                position.z,
                collisionBoxesRef.current,
                PLAYER_RADIUS
            );

            if (pushed.x !== position.x || pushed.z !== position.z) {
                cameraRef.current.position.set(pushed.x, PLAYER_HEIGHT, pushed.z);
            }

            if (spawnProtectionUntil) {
                setSpawnProtectionUntil(spawnProtectionUntil);
            }
        } else {
            const model = playersRef.current.get(id);
            if (model) {
                model.visible = true;
                model.userData.targetPosition = new THREE.Vector3(position.x, 0, position.z);
                model.userData.targetRotation = new THREE.Euler(0, 0, 0);
                model.position.set(position.x, 0, position.z);
                previousPositionsRef.current.set(id, model.position.clone());
            }
        }
    }, [socket?.id]);

    const handlePlayerMoved = useCallback((id: string, position: any, rotation: any) => {
        const model = playersRef.current.get(id);
        if (model) {
            const now = Date.now();
            const extrapolationData = extrapolationDataRef.current.get(id);

            if (extrapolationData) {
                const deltaTime = (now - extrapolationData.lastUpdateTime) / 1000;
                if (deltaTime > 0) {
                    extrapolationData.velocity.set(
                        (position.x - extrapolationData.targetPosition.x) / deltaTime,
                        0,
                        (position.z - extrapolationData.targetPosition.z) / deltaTime
                    );
                }
            } else {
                extrapolationDataRef.current.set(id, {
                    targetPosition: new THREE.Vector3(position.x, 0, position.z),
                    targetRotation: new THREE.Euler(rotation.x, rotation.y, rotation.z),
                    velocity: new THREE.Vector3(0, 0, 0),
                    lastUpdateTime: now
                });
            }

            const data = extrapolationDataRef.current.get(id)!;
            data.targetPosition.set(position.x, 0, position.z);
            data.targetRotation.set(rotation.x, rotation.y, rotation.z);
            data.lastUpdateTime = now;

            PlayerModel.updateTilt(model, { x: rotation.x, y: rotation.y });
        }
    }, []);

    const handleSpawnPosition = useCallback((position: any) => {
        if (cameraRef.current) {
            cameraRef.current.position.set(position.x, PLAYER_HEIGHT, position.z);
        }
    }, []);

    const handlePositionCorrection = useCallback((position: any, rotation: any) => {
        if (cameraRef.current) {
            cameraRef.current.userData.correctPosition = new THREE.Vector3(
                position.x, position.y, position.z
            );
            cameraRef.current.userData.correctRotation = new THREE.Euler(
                rotation.x, rotation.y, rotation.z
            );
        }
    }, []);

    const handleMatchEndTime = useCallback((endTime: number) => {
        setMatchEndTime(endTime);
    }, []);

    useGameSocket({
        socket,
        wallet,
        roomId,
        mode,
        onPlayersUpdate: (playersOrUpdater) => {
            if (typeof playersOrUpdater === 'function') {
                setHudPlayers(playersOrUpdater);
            } else {
                playersDataRef.current.clear();
                playersOrUpdater.forEach(p => {
                    playersDataRef.current.set(p.id, p);
                    
                    if (!playerAnimationDataRef.current.has(p.id)) {
                        playerAnimationDataRef.current.set(p.id, PlayerModel.createAnimationData());
                    }
                });
                setHudPlayers(playersOrUpdater);
            }
        },
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
        onPlayerJoined: (player: Player, index: number) => {
            if (!sceneRef.current) return;
            
            const model = PlayerModel.create(sceneRef.current, player, index, mode);
            playersRef.current.set(player.id, model);
            
            playerAnimationDataRef.current.set(player.id, PlayerModel.createAnimationData());
        },
        onPlayerLeft: (playerId: string) => {
            const model = playersRef.current.get(playerId);
            if (model && sceneRef.current) {
                sceneRef.current.remove(model);
            }
            playersRef.current.delete(playerId);
            playerAnimationDataRef.current.delete(playerId);
            previousPositionsRef.current.delete(playerId);
            extrapolationDataRef.current.delete(playerId);
        },
        onPlayerMoved: handlePlayerMoved,
        onSpawnPosition: handleSpawnPosition,
        onPositionCorrection: handlePositionCorrection,
        onMatchEndTime: handleMatchEndTime
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

            if (cameraRef.current && cameraRef.current.userData.correctPosition) {
                const target = cameraRef.current.userData.correctPosition as THREE.Vector3;
                cameraRef.current.position.lerp(target, 0.1);

                if (cameraRef.current.position.distanceTo(target) < 0.05) {
                    delete cameraRef.current.userData.correctPosition;
                    delete cameraRef.current.userData.correctRotation;
                }
            }

            if (playerModelRef.current && isThirdPersonRef.current) {
                playerModelRef.current.position.x = cameraRef.current.position.x;
                playerModelRef.current.position.z = cameraRef.current.position.z;

                updateThirdPersonCamera(playerModelRef.current.position);

                const cameraDir = new THREE.Vector3();
                cameraRef.current.getWorldDirection(cameraDir);
                playerModelRef.current.rotation.y = Math.atan2(cameraDir.x, cameraDir.z);
            }

            extrapolationDataRef.current.forEach((data, playerId) => {
                const playerModel = playersRef.current.get(playerId);
                if (playerModel) {
                    const timeSinceUpdate = (Date.now() - data.lastUpdateTime) / 1000;

                    if (timeSinceUpdate > 0.1 && data.velocity.length() > 0.1) {
                        const extrapolatedPos = data.targetPosition.clone().add(
                            data.velocity.clone().multiplyScalar(Math.min(timeSinceUpdate, 0.5))
                        );
                        playerModel.position.lerp(extrapolatedPos, 0.25);
                    } else {
                        playerModel.position.lerp(data.targetPosition, 0.25);
                    }

                    if (data.targetRotation) {
                        const targetRot = data.targetRotation as THREE.Euler;
                        playerModel.rotation.y += (targetRot.y - playerModel.rotation.y) * 0.25;
                    }

                    const previousPos = previousPositionsRef.current.get(playerId);
                    const animData = playerAnimationDataRef.current.get(playerId);
                    if (previousPos && animData) {
                        const distance = playerModel.position.distanceTo(previousPos);
                        animData.isMoving = distance > 0.01;
                        previousPositionsRef.current.set(playerId, playerModel.position.clone());

                        PlayerModel.animate(playerModel, animData, deltaTime);
                    }
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
            extrapolationDataRef.current.clear();

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
                players={hudPlayers}
                mode={mode}
                scores={scores}
                myUsername={myUsername}
                matchEndTime={matchEndTime}
                spawnProtectionUntil={spawnProtectionUntil}
            />

            <VoiceChat
                socket={socket}
                roomId={roomId}
                myUsername={myUsername}
                isChatOpenRef={isChatOpenRef}
            />

            <TextChat
                socket={socket}
                roomId={roomId}
                myUsername={myUsername}
                myTeam={myTeam}
                mode={mode}
                isOpen={isChatOpen}
                onToggle={setIsChatOpen}
            />

            <GameOverlay
                isLocked={isLocked}
                gameStatus={gameStatus}
                playersCount={hudPlayers.length}
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