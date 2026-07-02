// src/features/game/lobby/hooks/useLobbyNetwork.ts
import { useRef, useEffect, MutableRefObject } from 'react';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { LobbyPlayerData } from '../../hooks/network/useLobbySocket';
import { PlayerModelLoader } from '../../models/PlayerModelLoader';
import { CAMERA_CONFIG } from '../../camera/config';

interface UseLobbyNetworkProps {
    socket: Socket | null;
    myPlayerModelRef: MutableRefObject<THREE.Group | null>;
    cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
    sceneRef: MutableRefObject<THREE.Scene | null>;
    tracerSystemRef: MutableRefObject<any>;
    hitEffectRef: MutableRefObject<any>;
    playersRef: MutableRefObject<Map<string, any>>;
    interpolatorsRef: MutableRefObject<Map<string, any>>;
    buildingManagerRef: MutableRefObject<any>;
    createOtherPlayerModel: (player: LobbyPlayerData, index: number) => void;
    removePlayerModel: (playerId: string) => void;
    setLobbyId: (id: string) => void;
    setPlayers: (fn: any) => void;
    setMyHealth: (fn: any) => void;
    setIsDead: (val: boolean) => void;
    setHitKey: (fn: any) => void;
    correctionTargetRef: MutableRefObject<THREE.Vector3 | null>;
    isCorrectingRef: MutableRefObject<boolean>;
}

export function useLobbyNetwork(props: UseLobbyNetworkProps) {
    const {
        socket, myPlayerModelRef, cameraRef, sceneRef, tracerSystemRef, hitEffectRef,
        playersRef, interpolatorsRef, buildingManagerRef, createOtherPlayerModel,
        removePlayerModel, setLobbyId, setPlayers, setMyHealth, setIsDead, setHitKey,
        correctionTargetRef, isCorrectingRef
    } = props;

    const socketRef = useRef(socket);
    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    const pendingPlayersRef = useRef<LobbyPlayerData[]>([]);

    const tryCreatePlayerModels = (players: LobbyPlayerData[]) => {
        console.log(`🔄 [Network] Trying to create ${players.length} player models...`);
        console.log(`🔄 [Network] Scene ready: ${!!sceneRef.current}`);

        const stillPending: LobbyPlayerData[] = [];

        players.forEach((player, index) => {
            if (player.id === socketRef.current?.id) {
                console.log(`🙋 [Network] Skipping self: ${player.id}`);
                return;
            }

            if (playersRef.current.has(player.id)) {
                console.log(`✅ [Network] Player ${player.id} already exists`);
                return;
            }

            if (!sceneRef.current) {
                console.log(`⏳ [Network] Scene not ready, adding ${player.id} to pending`);
                stillPending.push(player);
                return;
            }

            console.log(`👤 [Network] Creating model for: ${player.username} (${player.id})`);
            createOtherPlayerModel(player, index);

            const interpolator = interpolatorsRef.current.get(player.id);
            if (interpolator) {
                interpolator.addSnapshot(Date.now(), player.position, player.rotation);
                console.log(`✅ [Network] Model created for: ${player.username}`);
            } else {
                console.error(`❌ [Network] Interpolator NOT created for: ${player.id}`);
            }
        });

        pendingPlayersRef.current = stillPending;
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (sceneRef.current && pendingPlayersRef.current.length > 0) {
                console.log(`🔄 [Network] Retrying ${pendingPlayersRef.current.length} pending players...`);
                tryCreatePlayerModels(pendingPlayersRef.current);
            }
        }, 500);

        return () => clearInterval(interval);
    }, []);

    const socketHandlers = useRef<any>({});

    socketHandlers.current.onLobbyJoined = (data: any) => {
        console.log('🎮 [Client] onLobbyJoined:', data.lobbyId, 'Players:', data.playersCount);
        setLobbyId(data.lobbyId);
        setPlayers(data.players);
        tryCreatePlayerModels(data.players);
    };

    socketHandlers.current.onPlayerJoined = (player: LobbyPlayerData) => {
        console.log(`👋 [Client] onPlayerJoined: ${player.username} (${player.id})`);
        setPlayers((prev: any) => [...prev, player]);

        if (!sceneRef.current) {
            console.log(`⏳ [Client] Scene not ready, adding ${player.id} to pending`);
            pendingPlayersRef.current.push(player);
            return;
        }

        createOtherPlayerModel(player, playersRef.current.size);

        const interpolator = interpolatorsRef.current.get(player.id);
        if (interpolator) {
            interpolator.addSnapshot(Date.now(), player.position, player.rotation);
        }
    };

    socketHandlers.current.onPlayerLeft = (playerId: string) => {
        console.log(`👋 [Client] onPlayerLeft: ${playerId}`);
        setPlayers((prev: any) => prev.filter((p: any) => p.id !== playerId));
        removePlayerModel(playerId);
        pendingPlayersRef.current = pendingPlayersRef.current.filter(p => p.id !== playerId);
    };

    socketHandlers.current.onPlayerMoved = (data: any) => {
        const playerId = data.id;
        const interpolator = interpolatorsRef.current.get(playerId);
        const playerData = playersRef.current.get(playerId);

        if (!interpolator || !playerData) {
            console.warn(`⚠️ [Client] onPlayerMoved: No interpolator/playerData for ${playerId}`);
            return;
        }

        const pos = Array.isArray(data.position)
            ? { x: data.position[0], y: data.position[1], z: data.position[2] }
            : data.position;

        const rot = Array.isArray(data.rotation)
            ? { x: data.rotation[0], y: data.rotation[1], z: data.rotation[2] }
            : data.rotation;

        const vel = Array.isArray(data.velocity)
            ? { x: data.velocity[0], z: data.velocity[1] }
            : undefined;

        const serverTime = data.serverTime || Date.now();

        interpolator.addSnapshot(serverTime, pos, rot, vel);

        if (vel) {
            const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
            playerData.animData.isMoving = speed > 0.5;
        } else {
            const lastPos = playerData.group.position;
            const dist = Math.sqrt(
                Math.pow(pos.x - lastPos.x, 2) +
                Math.pow(pos.z - lastPos.z, 2)
            );
            playerData.animData.isMoving = dist > 0.1;
        }
    };

    socketHandlers.current.onPlayerUsernameChanged = (data: { id: string; username: string }) => {
        setPlayers((prev: any) => prev.map((p: any) => p.id === data.id ? { ...p, username: data.username } : p));
    };

    socketHandlers.current.onLobbyPlayersCount = () => { };

    socketHandlers.current.onPlayerShotInLobby = (data: any) => {
        const shooterData = playersRef.current.get(data.shooterId);
        if (shooterData) {
            shooterData.animData.isShooting = true;
            setTimeout(() => {
                if (shooterData) shooterData.animData.isShooting = false;
            }, 200);

            if (sceneRef.current && tracerSystemRef.current) {
                const shooterPos = shooterData.group.position.clone();
                shooterPos.y += 1.5;

                const direction = new THREE.Vector3(
                    data.direction.x,
                    data.direction.y,
                    data.direction.z
                ).normalize();

                const endPoint = shooterPos.clone().add(direction.multiplyScalar(100));
                tracerSystemRef.current.createTracer(shooterPos, endPoint);

                if (data.hitPlayerId) {
                    const targetData = playersRef.current.get(data.hitPlayerId);
                    if (targetData && hitEffectRef.current) {
                        const hitPos = targetData.group.position.clone();
                        hitPos.y += 1;
                        hitEffectRef.current.createHitEffect(hitPos, new THREE.Vector3(0, 1, 0));
                    }
                }
            }
        }

        if (data.hitPlayerId === socketRef.current?.id) {
            setHitKey((prev: number) => prev + 1);
        }
    };

    socketHandlers.current.onPlayerHitInLobby = (data: any) => {
        const targetData = playersRef.current.get(data.targetId);
        if (targetData) {
            targetData.animData.hitFlash = 0.3;
            setTimeout(() => {
                if (targetData) targetData.animData.hitFlash = 0;
            }, 300);
        }
        if (data.targetId === socketRef.current?.id) {
            setMyHealth((prev: number) => Math.max(0, prev - data.damage));
        }
    };

    socketHandlers.current.onPlayerHealthChanged = (data: any) => {
        if (data.targetId === socketRef.current?.id) {
            setMyHealth(data.health);
        }
    };

    socketHandlers.current.onPlayerDiedInLobby = (data: any) => {
        if (data.targetId === socketRef.current?.id) {
            setIsDead(true);
        }
        const targetData = playersRef.current.get(data.targetId);
        if (targetData) {
            targetData.animData.isDead = true;
        }
    };

    socketHandlers.current.onPlayerRespawnedInLobby = (data: any) => {
        if (data.targetId === socketRef.current?.id) {
            setMyHealth(100);
            setIsDead(false);
            if (myPlayerModelRef.current) {
                const groundOffset = PlayerModelLoader.getGroundOffset();
                myPlayerModelRef.current.position.set(data.position.x, groundOffset, data.position.z);
                myPlayerModelRef.current.rotation.set(0, data.rotation.y, 0);
                if (cameraRef.current) {
                    cameraRef.current.position.set(
                        data.position.x,
                        data.position.y + CAMERA_CONFIG.heightOffset,
                        data.position.z + CAMERA_CONFIG.distance
                    );
                }
            }
        } else {
            const targetData = playersRef.current.get(data.targetId);
            if (targetData) {
                targetData.animData.isDead = false;
                const groundOffset = PlayerModelLoader.getGroundOffset();
                targetData.group.position.set(data.position.x, groundOffset, data.position.z);
                targetData.group.rotation.set(0, data.rotation.y, 0);
                const interpolator = interpolatorsRef.current.get(data.targetId);
                if (interpolator) {
                    interpolator.clear();
                    interpolator.addSnapshot(Date.now(), data.position, data.rotation);
                }
            }
        }
    };

    socketHandlers.current.onPlayerBuildInLobby = (data: any) => {
        if (!buildingManagerRef.current) {
            setTimeout(() => {
                socketHandlers.current.onPlayerBuildInLobby(data);
            }, 100);
            return;
        }

        if (data.action === 'place') {
            const piece = buildingManagerRef.current.createPiece(data.pieceType);
            if (piece) {
                buildingManagerRef.current.placePiece(
                    piece,
                    data.position.x,
                    data.position.y,
                    data.position.z,
                    data.rotation.y
                );
            }
        } else if (data.action === 'remove') {
            const pieces = buildingManagerRef.current.getAllPieces();
            const nearestPiece = pieces.find((p: any) => {
                const dist = p.group.position.distanceTo(
                    new THREE.Vector3(data.position.x, data.position.y, data.position.z)
                );
                return dist < 2;
            });

            if (nearestPiece) {
                buildingManagerRef.current.removePiece(nearestPiece.id);
            }
        }
    };

    socketHandlers.current.onPlayerEmoteInLobby = (data: any) => {
        const playerData = playersRef.current.get(data.playerId);
        if (playerData) {
            playerData.animData.isShooting = true;
            setTimeout(() => {
                if (playerData) playerData.animData.isShooting = false;
            }, 2000);
        }
    };

    socketHandlers.current.onPositionCorrection = (data: any) => {
        const pos = Array.isArray(data.position)
            ? new THREE.Vector3(data.position[0], data.position[1], data.position[2])
            : new THREE.Vector3(data.position.x, data.position.y, data.position.z);

        correctionTargetRef.current = pos;
        isCorrectingRef.current = true;
    };

    return socketHandlers;
}