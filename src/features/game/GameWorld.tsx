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
import { PlayerInterpolator } from './network/PlayerInterpolator';
import { InputHistory } from './network/InputHistory';

interface GameWorldProps {
    wallet: string;
    roomId: string;
    mode: GameMode;
    socket: Socket | null;
    onExit: () => void;
}

interface KillFeedEntry {
    id: string;
    killer: string;
    victim: string;
    killerTeam: number;
    victimTeam: number;
    timestamp: number;
}

interface DamageIndicator {
    id: string;
    angle: number;
    timestamp: number;
    damage: number;
}

export function GameWorld({ wallet, roomId, mode, socket, onExit }: GameWorldProps) {
    const interpolatorsRef = useRef<Map<string, PlayerInterpolator>>(new Map());
    const inputHistoryRef = useRef<InputHistory>(new InputHistory());
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
    const [sceneReady, setSceneReady] = useState(false);
    const modelLoadedRef = useRef(false);

    const playersDataRef = useRef<Map<string, Player>>(new Map());
    const [hudPlayers, setHudPlayers] = useState<Player[]>([]);
    const hudPlayersRef = useRef<Player[]>([]);

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
    const weaponModelRef = useRef<THREE.Group | null>(null);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const isChatOpenRef = useRef(false);

    const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
    const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
    const [showHitMarker, setShowHitMarker] = useState(false);
    const [lastHitTime, setLastHitTime] = useState(0);

    useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);
    useEffect(() => { hudPlayersRef.current = hudPlayers; }, [hudPlayers]);

    const myUsername = `Player_${wallet.substring(0, 4)}`;
    const myTeam = hudPlayers.find(p => p.id === socket?.id)?.team;

    useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);

    const createPlayerModelSafe = useCallback((player: Player, index: number) => {
        if (!sceneRef.current) return null;
        if (playersRef.current.has(player.id)) return playersRef.current.get(player.id)!;

        const model = PlayerModel.create(sceneRef.current, player, index, mode);
        playersRef.current.set(player.id, model);
        playerAnimationDataRef.current.set(player.id, PlayerModel.createAnimationData());
        previousPositionsRef.current.set(player.id, new THREE.Vector3(player.position.x, 0, player.position.z));

        if (player.id === socket?.id) {
            playerModelRef.current = model;
            if (cameraRef.current) {
                cameraRef.current.position.set(
                    player.position.x,
                    player.position.y + 3,
                    player.position.z + 5
                );
            }
            if (sceneRef.current && !weaponModelRef.current) {
                const weapon = WeaponModel.createForPlayer(model);
                weaponModelRef.current = weapon;
            }
        }

        return model;
    }, [mode, socket?.id]);

    useEffect(() => {
        PlayerModelLoader.preload()
            .then(() => {
                modelLoadedRef.current = true;
                let index = 0;
                playersDataRef.current.forEach((player) => {
                    if (!playersRef.current.has(player.id)) {
                        createPlayerModelSafe(player, index);
                    }
                });
            })
            .catch(err => {
                console.warn('⚠️ Player model preload failed:', err);
            });
    }, [socket?.id, mode, createPlayerModelSafe]);

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
        camera.position.set(0, 5, 10);
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

        bulletPoolRef.current = new BulletPool(scene, 50);
        soundManagerRef.current = new SoundManager();

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

    const { ammoRef, isReloadingRef, startAutoFire, stopAutoFire, reload } = useShooting({
        socket,
        cameraRef,
        playerModelRef,  
        bulletPoolRef,
        soundManagerRef,
        gameStatusRef,
        isMouseDownRef,
        playersRef,
        playerAnimationDataRef,
        onAmmoChange: setAmmo,
        onReloadChange: setIsReloading
    });

    const { updateMovement } = usePlayerControls({
        containerRef,
        cameraRef,
        playerModelRef,
        socket,
        collisionBoxes: collisionBoxesRef.current,
        gameStatusRef,
        onLockChange: setIsLocked,
        onExit,
        startAutoFire,
        stopAutoFire,
        reload,
        isMouseDownRef,
        onChatToggle: setIsChatOpen,
        isChatOpenRef,
        inputHistoryRef
    });

    useEffect(() => { updateMovementRef.current = updateMovement; }, [updateMovement]);

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
            setTimeout(() => { if (animData) animData.isShooting = false; }, 300);
        }
    }, []);

    const handlePlayerHit = useCallback((targetId: string, health: number) => {
        const animData = playerAnimationDataRef.current.get(targetId);
        if (animData) animData.hitFlash = 0.3;

        if (targetId !== socket?.id) {
            setShowHitMarker(true);
            setLastHitTime(Date.now());
            setTimeout(() => setShowHitMarker(false), 200);
        }

        if (targetId === socket?.id) {
            const angle = Math.random() * 360;
            setDamageIndicators(prev => [...prev, {
                id: `dmg_${Date.now()}_${Math.random()}`,
                angle, timestamp: Date.now(), damage: 25
            }]);
        }
    }, [socket?.id]);

    const handlePlayerKilled = useCallback((victimId: string) => {
        const model = playersRef.current.get(victimId);
        const animData = playerAnimationDataRef.current.get(victimId);

        if (animData) animData.isDead = true;
        if (model) {
            setTimeout(() => { model.visible = false; }, 2000);
        }

        const killer = hudPlayersRef.current.find(p => p.id === socket?.id);
        const victim = hudPlayersRef.current.find(p => p.id === victimId);

        if (killer && victim) {
            setKillFeed(prev => [...prev, {
                id: `kill_${Date.now()}_${Math.random()}`,
                killer: killer.username, victim: victim.username,
                killerTeam: killer.team, victimTeam: victim.team,
                timestamp: Date.now()
            }]);
        }
    }, [socket?.id]);

    const handlePlayerRespawned = useCallback((id: string, position: any, spawnProtectionUntil?: number) => {
        const animData = playerAnimationDataRef.current.get(id);
        if (animData) animData.isDead = false;

        if (id === socket?.id && playerModelRef.current) {
            playerModelRef.current.position.set(position.x, 0, position.z);
            const pushed = pushOutOfCollision(position.x, position.z, collisionBoxesRef.current, PLAYER_RADIUS);
            if (pushed.x !== position.x || pushed.z !== position.z) {
                playerModelRef.current.position.set(pushed.x, 0, pushed.z);
            }
            if (spawnProtectionUntil) setSpawnProtectionUntil(spawnProtectionUntil);
        } else {
            const model = playersRef.current.get(id);
            if (model) {
                model.visible = true;
                model.position.set(position.x, 0, position.z);
                previousPositionsRef.current.set(id, model.position.clone());
            }
        }
    }, [socket?.id]);

    const handlePlayerMoved = useCallback((id: string, position: any, rotation: any, serverTime?: number) => {
        if (id === socket?.id) return;

        let interpolator = interpolatorsRef.current.get(id);
        if (!interpolator) {
            interpolator = new PlayerInterpolator();
            interpolatorsRef.current.set(id, interpolator);
        }

        interpolator.addSnapshot(serverTime || Date.now(), position, rotation);

        const model = playersRef.current.get(id);
        if (model) {
            PlayerModel.updateTilt(model, { x: rotation.x, y: rotation.y });
        }
    }, [socket?.id]);

    const handleSpawnPosition = useCallback((position: any) => {
        if (playerModelRef.current) {
            playerModelRef.current.position.set(position.x, 0, position.z);
        }
    }, []);

    const handlePositionCorrection = useCallback((position: any, rotation: any, serverTime: number) => {
        if (playerModelRef.current) {
            playerModelRef.current.userData.correctPosition = new THREE.Vector3(position.x, 0, position.z);
            inputHistoryRef.current.removeBefore(serverTime);
        }
    }, []);

    const handleMatchEndTime = useCallback((endTime: number) => {
        setMatchEndTime(endTime);
    }, []);

    useGameSocket({
        socket, wallet, roomId, mode,
        onSpawnProtectionUpdate: setSpawnProtectionUntil,
        onUsernameChanged: (id, username) => {
            setHudPlayers(prev => prev.map(p => p.id === id ? { ...p, username } : p));
        },
        onPlayersUpdate: (playersOrUpdater) => {
            if (typeof playersOrUpdater === 'function') {
                setHudPlayers(playersOrUpdater);
            } else {
                playersDataRef.current.clear();
                playersOrUpdater.forEach((p, index) => {
                    playersDataRef.current.set(p.id, p);
                    if (!playerAnimationDataRef.current.has(p.id)) {
                        playerAnimationDataRef.current.set(p.id, PlayerModel.createAnimationData());
                    }
                    if (modelLoadedRef.current && sceneRef.current && !playersRef.current.has(p.id)) {
                        createPlayerModelSafe(p, index);
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
            createPlayerModelSafe(player, index);
        },
        onPlayerLeft: (playerId: string) => {
            if (playerId === socket?.id) return;
            const model = playersRef.current.get(playerId);
            if (model && sceneRef.current) sceneRef.current.remove(model);
            playersRef.current.delete(playerId);
            playerAnimationDataRef.current.delete(playerId);
            previousPositionsRef.current.delete(playerId);
            interpolatorsRef.current.delete(playerId);
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

            const deltaTime = lastTime ? Math.min((currentTime - lastTime) / 1000, 0.1) : 0.016;
            lastTime = currentTime;

            updateMovementRef.current(deltaTime);
            bulletPoolRef.current?.update(deltaTime);

            if (playerModelRef.current && playerModelRef.current.userData.correctPosition) {
                const target = playerModelRef.current.userData.correctPosition as THREE.Vector3;
                playerModelRef.current.position.lerp(target, 0.3);
                if (playerModelRef.current.position.distanceTo(target) < 0.05) {
                    delete playerModelRef.current.userData.correctPosition;
                }
            }

            const myAnimData = playerAnimationDataRef.current.get(socket?.id || '');
            if (myAnimData && playerModelRef.current) {
                const prevPos = previousPositionsRef.current.get(socket?.id || '');
                const currPos = playerModelRef.current.position;
                if (prevPos) {
                    myAnimData.isMoving = currPos.distanceTo(prevPos) > 0.01;
                }
                previousPositionsRef.current.set(socket?.id || '', currPos.clone());
                PlayerModel.animate(playerModelRef.current, myAnimData, deltaTime);
            }

            interpolatorsRef.current.forEach((interpolator, playerId) => {
                const playerModel = playersRef.current.get(playerId);
                if (!playerModel) return;

                const animData = playerAnimationDataRef.current.get(playerId);
                if (!animData) return;

                const state = interpolator.getInterpolatedState();
                if (state) {
                    playerModel.position.lerp(state.position, 0.3);
                    playerModel.rotation.y += (state.rotation.y - playerModel.rotation.y) * 0.3;
                }

                const previousPos = previousPositionsRef.current.get(playerId);
                if (previousPos) {
                    animData.isMoving = playerModel.position.distanceTo(previousPos) > 0.05;
                }
                previousPositionsRef.current.set(playerId, playerModel.position.clone());
                PlayerModel.animate(playerModel, animData, deltaTime);
            });

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();
        return () => {
            if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [socket?.id]);

    useEffect(() => {
        return () => {
            stopAutoFire();
            bulletPoolRef.current?.dispose();
            soundManagerRef.current?.dispose();
            playerAnimationDataRef.current.clear();
            previousPositionsRef.current.clear();
            interpolatorsRef.current.forEach(i => i.clear());
            interpolatorsRef.current.clear();
            inputHistoryRef.current.clear();

            if (sceneRef.current) {
                sceneRef.current.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => { m.dispose(); if (m.map) m.map.dispose(); });
                        } else if (obj.material) {
                            obj.material.dispose();
                            if ((obj.material as any).map) (obj.material as any).map.dispose();
                        }
                    }
                });
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current.forceContextLoss();
                if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current = null;
            }

            if (document.pointerLockElement) document.exitPointerLock();
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
                killFeed={killFeed}
                damageIndicators={damageIndicators}
                showHitMarker={showHitMarker}
                lastHitTime={lastHitTime}
            />

            <VoiceChat socket={socket} channelId={roomId} myUsername={myUsername} isChatOpenRef={isChatOpenRef} />
            <TextChat socket={socket} channelId={roomId} myUsername={myUsername} myTeam={myTeam} mode={mode} isOpen={isChatOpen} onToggle={setIsChatOpen} />

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