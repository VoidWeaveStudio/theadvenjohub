// src/features/game/GameWorld.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';

import { GameHUD } from './GameHUD';
import { GameOverlay } from './components/GameOverlay';
import { VoiceChat } from './components/VoiceChat';
import { TextChat } from './components/TextChat';

import { BulletPool } from './BulletPool';
import { SoundManager } from './SoundManager';
import { MapRegistry } from './map/MapFactory';
import { GameMap } from './map/GameMap';
import { registerAllMaps } from './map/registerMaps';

import { PlayerModel } from './models/PlayerModel';
import { PlayerModelLoader } from './models/PlayerModelLoader';
import { WeaponModel } from './models/WeaponModel';
import { ProceduralAnimationData } from './models/PlayerAnimator';

import { useGamePlayerController } from './hooks/useGamePlayerController';
import { useGameSocket } from './hooks/useGameSocket';

import { PlayerInterpolator } from './network/PlayerInterpolator';
import { InputHistory } from './network/InputHistory';

import { Player, PlayerAnimationData, GameMode, CollisionBox } from './types';
import { WEAPON_CONFIG, ANIMATION_CONFIG, PLAYER_CONFIG, GAME_CONFIG } from './config/gameConfig';

import { CollisionSystem } from './map/CollisionSystem';

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

let mapsRegistered = false;

export function GameWorld({ wallet, roomId, mode, socket, onExit }: GameWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const playerModelRef = useRef<THREE.Group | null>(null);
    const weaponModelRef = useRef<WeaponModel | null>(null);
    const playersRef = useRef<Map<string, THREE.Group>>(new Map());
    const interpolatorsRef = useRef<Map<string, PlayerInterpolator>>(new Map());
    const inputHistoryRef = useRef<InputHistory>(new InputHistory());
    const bulletPoolRef = useRef<BulletPool | null>(null);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const playerAnimationDataRef = useRef<Map<string, PlayerAnimationData>>(new Map());
    const gameStatusRef = useRef<'waiting' | 'playing' | 'ended'>('playing');
    const isMouseDownRef = useRef(false);
    const isChatOpenRef = useRef(false);
    const previousPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
    const playersDataRef = useRef<Map<string, Player>>(new Map());
    const hudPlayersRef = useRef<Player[]>([]);
    const mapRef = useRef<GameMap | null>(null);
    const collisionSystemRef = useRef<CollisionSystem | null>(null);
    const collisionBoxesRef = useRef<CollisionBox[]>([]);
    const shootingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);

    const [myHealth, setMyHealth] = useState(100);
    const [myKills, setMyKills] = useState(0);
    const [myDeaths, setMyDeaths] = useState(0);

    const [ammo, setAmmo] = useState(WEAPON_CONFIG.maxAmmo);

    const [isReloading, setIsReloading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'ended'>('playing');
    const [scores, setScores] = useState<Record<string, number>>(mode === '5v5' ? { '1': 0, '2': 0 } : {});
    const [winner, setWinner] = useState<unknown>(null);
    const [matchEndTime, setMatchEndTime] = useState<number | null>(null);
    const [spawnProtectionUntil, setSpawnProtectionUntil] = useState<number>(0);
    const [hudPlayers, setHudPlayers] = useState<Player[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
    const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
    const [showHitMarker, setShowHitMarker] = useState(false);
    const [isSceneReady, setIsSceneReady] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);

    useEffect(() => {
        isChatOpenRef.current = isChatOpen;
    }, [isChatOpen]);
    useEffect(() => {
        hudPlayersRef.current = hudPlayers;
    }, [hudPlayers]);
    useEffect(() => {
        gameStatusRef.current = gameStatus;
    }, [gameStatus]);

    const myUsername = `Player_${wallet.substring(0, 4)}`;
    const myTeam = hudPlayers.find(p => p.id === socket?.id)?.team ?? 0;

    const controller = useGamePlayerController({
        containerRef,
        cameraRef,
        playerModelRef,
        socket,
        collisionBoxes: collisionBoxesRef.current,
        collisionSystem: collisionSystemRef.current || undefined,
        gameStatusRef,
        isChatOpenRef,
        isMouseDownRef,
        bulletPoolRef,
        soundManagerRef,
        inputHistoryRef,
        playerAnimationDataRef,
        playersRef,
        onLockChange: setIsLocked,
        onExit,
        onChatToggle: setIsChatOpen,
        onAmmoChange: setAmmo,
        onReloadChange: setIsReloading,
        onProceduralDataUpdate: (data: ProceduralAnimationData) => {
            if (playerModelRef.current) {
                const animator = playerModelRef.current.userData.animator;
                if (animator) {
                    animator.update(1 / 60, data);
                }
            }
        },
    });

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
        if (!containerRef.current) return;

        if (!mapsRegistered) {
            registerAllMaps();
            mapsRegistered = true;
        }

        console.log(`🎬 [GameWorld] Initializing game scene for room: ${roomId}, mode: ${mode}`);

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
        scene.background = new THREE.Color(0xd4a574);
        scene.fog = new THREE.Fog(0xd4a574, 0, 150);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000,
        );
        camera.position.set(0, 5, 10);
        camera.position.set(0, 2.5, 6); 
        camera.rotation.order = 'YXZ';
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight - 64);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene.add(new THREE.AmbientLight(0xffeedd, 0.5));

        const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
        sunLight.position.set(30, 80, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -80;
        sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80;
        sunLight.shadow.camera.bottom = -80;
        scene.add(sunLight);

        const map = MapRegistry.createMapForMode(mode, scene);
        if (map) {
            map.build();
            mapRef.current = map;

            const collisionSystem = new CollisionSystem(10);
            const collisions = map.getCollisions();

            collisions.getSolidBoxes().forEach(box => {
                collisionSystem.addSolid(box);
            });

            if (collisions.getWaterBoxes) {
                collisions.getWaterBoxes().forEach(box => {
                    collisionSystem.addWater(box);
                });
            }

            if (collisions.getHazardBoxes) {
                collisions.getHazardBoxes().forEach(box => {
                    collisionSystem.addHazard(box);
                });
            }

            if (collisions.getBoundaryBoxes) {
                collisions.getBoundaryBoxes().forEach(box => {
                    collisionSystem.addBoundary(box);
                });
            }

            collisionSystemRef.current = collisionSystem;
            collisionBoxesRef.current = collisions.getSolidBoxes().map(box => ({
                minX: box.minX,
                maxX: box.maxX,
                minZ: box.minZ,
                maxZ: box.maxZ,
            }));

            console.log(`✅ [GameWorld] Map and collision system initialized`);
        } else {
            console.error('❌ [GameWorld] Failed to create map for mode:', mode);
        }

        bulletPoolRef.current = new BulletPool(scene, WEAPON_CONFIG.bulletPoolSize);
        soundManagerRef.current = new SoundManager();

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / (window.innerHeight - 64);
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight - 64);
        };
        window.addEventListener('resize', handleResize);

        startTimeRef.current = performance.now();
        lastTimeRef.current = performance.now();

        setIsSceneReady(true);

        return () => {
            console.log(`🗑️ [GameWorld] Cleaning up game scene`);
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            map?.dispose();
        };
    }, [roomId, mode]);

    useEffect(() => {
        if (!isSceneReady || !modelLoaded) return;
        if (!sceneRef.current) return;
        if (playerModelRef.current) return;

        console.log(`🎮 [GameWorld] Creating my player model`);
        const cloned = PlayerModelLoader.getModelClone();
        if (!cloned) {
            console.error(`❌ [GameWorld] Failed to clone model`);
            return;
        }

        const groundOffset = PlayerModelLoader.getGroundOffset();
        const { PlayerAnimator } = require('./models/PlayerAnimator');
        cloned.userData.animator = new PlayerAnimator(cloned);

        cloned.position.set(0, groundOffset, 0);
        sceneRef.current.add(cloned);
        playerModelRef.current = cloned;

        console.log(`✅ [GameWorld] My player model added to scene at y=${groundOffset.toFixed(4)}`);

        if (!weaponModelRef.current) {
            weaponModelRef.current = new WeaponModel(cloned);
            console.log(`✅ [GameWorld] Weapon model attached`);
        }
    }, [isSceneReady, modelLoaded]);

    const handleGameEnd = useCallback((winnerData: unknown, scoresData: unknown) => {
        setGameStatus('ended');
        setWinner(winnerData);
        setScores(scoresData as Record<string, number>);
        controller.autoFire.stop();
    }, [controller]);

    const handlePlayerShot = useCallback((shooterId: string, origin: unknown, direction: unknown) => {
        bulletPoolRef.current?.fire(origin as { x: number; y: number; z: number }, direction as { x: number; y: number; z: number });
        const animData = playerAnimationDataRef.current.get(shooterId);
        if (animData) {
            animData.isShooting = true;

            const existingTimer = shootingTimersRef.current.get(shooterId);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                if (animData) animData.isShooting = false;
                shootingTimersRef.current.delete(shooterId);
            }, WEAPON_CONFIG.shootingAnimationDuration);

            shootingTimersRef.current.set(shooterId, timer);
        }
    }, []);

    const handlePlayerHit = useCallback((targetId: string, health: number) => {
        const animData = playerAnimationDataRef.current.get(targetId);
        if (animData) animData.hitFlash = PLAYER_CONFIG.hitFlashDuration;

        if (targetId !== socket?.id) {
            setShowHitMarker(true);
            setTimeout(() => setShowHitMarker(false), WEAPON_CONFIG.shootingAnimationDuration);
        }

        if (targetId === socket?.id) {
            setDamageIndicators(prev => [...prev, {
                id: `dmg_${Date.now()}_${Math.random()}`,
                angle: Math.random() * 360,
                timestamp: Date.now(),
                damage: WEAPON_CONFIG.damage,
            }]);
        }
    }, [socket?.id]);

    const handlePlayerKilled = useCallback((victimId: string) => {
        const model = playersRef.current.get(victimId);
        const animData = playerAnimationDataRef.current.get(victimId);

        if (animData) animData.isDead = true;
        if (model) setTimeout(() => {
            model.visible = false;
        }, 2000);

        const killer = hudPlayersRef.current.find(p => p.id === socket?.id);
        const victim = hudPlayersRef.current.find(p => p.id === victimId);

        if (killer && victim) {
            setKillFeed(prev => [...prev, {
                id: `kill_${Date.now()}_${Math.random()}`,
                killer: killer.username,
                victim: victim.username,
                killerTeam: killer.team,
                victimTeam: victim.team,
                timestamp: Date.now(),
            }]);
        }
    }, [socket?.id]);

    const handlePlayerRespawned = useCallback((id: string, position: unknown, spawnProtectionUntil?: number) => {
        const animData = playerAnimationDataRef.current.get(id);
        if (animData) animData.isDead = false;

        const pos = position as { x: number; y: number; z: number };
        const groundOffset = PlayerModelLoader.getGroundOffset();

        if (id === socket?.id && playerModelRef.current) {
            playerModelRef.current.position.set(pos.x, groundOffset, pos.z);
            if (spawnProtectionUntil) setSpawnProtectionUntil(spawnProtectionUntil);
        } else {
            const model = playersRef.current.get(id);
            if (model) {
                model.visible = true;
                model.position.set(pos.x, groundOffset, pos.z);
                previousPositionsRef.current.set(id, model.position.clone());
            }
        }
    }, [socket?.id]);

    const handlePlayerMoved = useCallback((id: string, position: unknown, rotation: unknown, serverTime?: number) => {
        if (id === socket?.id) return;

        let interpolator = interpolatorsRef.current.get(id);
        if (!interpolator) {
            interpolator = new PlayerInterpolator();
            interpolatorsRef.current.set(id, interpolator);
        }
        interpolator.addSnapshot(serverTime || Date.now(), position as { x: number; y: number; z: number }, rotation as { x: number; y: number; z: number });

        const model = playersRef.current.get(id);
        const rot = rotation as { x: number; y: number };
        if (model) PlayerModel.updateTilt(model, { x: rot.x, y: rot.y });
    }, [socket?.id]);

    useGameSocket({
        socket,
        wallet,
        roomId,
        mode,
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

                    if (sceneRef.current && !playersRef.current.has(p.id) && p.id !== socket?.id) {
                        const model = PlayerModel.create(sceneRef.current, p, index, mode);
                        playersRef.current.set(p.id, model);
                        previousPositionsRef.current.set(p.id, new THREE.Vector3(p.position.x, 0, p.position.z));
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
        onReturnToLobby: () => {
            controller.autoFire.stop();
            onExit();
        },
        onPlayerShot: handlePlayerShot,
        onPlayerHit: handlePlayerHit,
        onPlayerKilled: handlePlayerKilled,
        onPlayerRespawned: handlePlayerRespawned,
        onPlayerJoined: (player: Player, index: number) => {
            if (sceneRef.current && player.id !== socket?.id) {
                const model = PlayerModel.create(sceneRef.current, player, index, mode);
                playersRef.current.set(player.id, model);
                previousPositionsRef.current.set(player.id, new THREE.Vector3(player.position.x, 0, player.position.z));
            }
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
        onSpawnPosition: (position: unknown) => {
            const pos = position as { x: number; y: number; z: number };
            if (playerModelRef.current) {
                const groundOffset = PlayerModelLoader.getGroundOffset();
                playerModelRef.current.position.set(pos.x, groundOffset, pos.z);
            }
        },
        onPositionCorrection: (position: unknown, rotation: unknown, serverTime: number) => {
            const pos = position as { x: number; y: number; z: number };
            if (playerModelRef.current) {
                playerModelRef.current.userData.correctPosition = new THREE.Vector3(pos.x, 0, pos.z);
                inputHistoryRef.current.removeBefore(serverTime);
            }
        },
        onMatchEndTime: setMatchEndTime,
    });

    useEffect(() => {
        if (!isSceneReady) return;

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            lastTimeRef.current = currentTime;

            controller.update(deltaTime);

            mapRef.current?.update(deltaTime, elapsedTime);

            bulletPoolRef.current?.update(deltaTime);

            weaponModelRef.current?.updateRecoil(deltaTime);

            if (playerModelRef.current?.userData.correctPosition) {
                const target = playerModelRef.current.userData.correctPosition as THREE.Vector3;
                playerModelRef.current.position.lerp(target, 0.3);
                if (playerModelRef.current.position.distanceTo(target) < 0.05) {
                    delete playerModelRef.current.userData.correctPosition;
                }
            }

            if (playerModelRef.current) {
                const myAnimData = playerAnimationDataRef.current.get(socket?.id || '');
                if (myAnimData) {
                    const prevPos = previousPositionsRef.current.get(socket?.id || '');
                    const currPos = playerModelRef.current.position;
                    if (prevPos) myAnimData.isMoving = currPos.distanceTo(prevPos) > ANIMATION_CONFIG.isMovingThreshold.self;
                    previousPositionsRef.current.set(socket?.id || '', currPos.clone());
                    PlayerModel.animate(playerModelRef.current, myAnimData, deltaTime);
                }
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
                    animData.isMoving = playerModel.position.distanceTo(previousPos) > ANIMATION_CONFIG.isMovingThreshold.other;
                }
                previousPositionsRef.current.set(playerId, playerModel.position.clone());
                PlayerModel.animate(playerModel, animData, deltaTime);
            });

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isSceneReady, controller, socket?.id]);

    useEffect(() => {
        return () => {
            controller.autoFire.stop();

            shootingTimersRef.current.forEach(timer => clearTimeout(timer));
            shootingTimersRef.current.clear();

            bulletPoolRef.current?.dispose();
            soundManagerRef.current?.dispose();

            weaponModelRef.current?.dispose();
            weaponModelRef.current = null;

            playersRef.current.forEach((model) => {
                sceneRef.current?.remove(model);
                model.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else if (obj.material) {
                            obj.material.dispose();
                        }
                    }
                });
            });
            playersRef.current.clear();

            playerAnimationDataRef.current.clear();
            previousPositionsRef.current.clear();
            interpolatorsRef.current.forEach(i => i.clear());
            interpolatorsRef.current.clear();
            inputHistoryRef.current.clear();

            if (collisionSystemRef.current) {
                collisionSystemRef.current.clear();
                collisionSystemRef.current = null;
            }

            if (sceneRef.current) {
                sceneRef.current.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => {
                                m.dispose();
                                if (m.map) m.map.dispose();
                            });
                        } else if (obj.material) {
                            obj.material.dispose();
                            const mat = obj.material as THREE.MeshStandardMaterial;
                            if (mat.map) mat.map.dispose();
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
    }, [controller]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <GameHUD
                health={myHealth}
                kills={myKills}
                deaths={myDeaths}
                ammo={ammo}
                maxAmmo={WEAPON_CONFIG.maxAmmo}
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
                lastHitTime={Date.now()}
            />

            <VoiceChat socket={socket} channelId={roomId} myUsername={myUsername} isChatOpenRef={isChatOpenRef} />
            <TextChat
                socket={socket}
                channelId={roomId}
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
                maxPlayers={GAME_CONFIG.maxPlayers[mode]}
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