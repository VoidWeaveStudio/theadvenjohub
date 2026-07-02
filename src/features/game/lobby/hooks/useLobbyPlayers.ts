// src/features/game/lobby/hooks/useLobbyPlayers.ts
import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerModelLoader } from '../../models/PlayerModelLoader';
import { PlayerAnimator } from '../../models/PlayerAnimator';
import { PlayerAnimationData } from '../../types';
import { LobbyPlayerData } from '../../hooks/network/useLobbySocket';
import { UsernameSprite } from '../../utils/UsernameSprite';
import { PlayerInterpolator } from '../../network/PlayerInterpolator';

export interface LobbyPlayerModel {
    group: THREE.Group;
    animator: PlayerAnimator;
    animData: PlayerAnimationData;
    sprite: THREE.Sprite;
    targetPosition: THREE.Vector3;
    targetRotationY: number;
}

export function useLobbyPlayers(sceneRef: React.MutableRefObject<THREE.Scene | null>) {
    const playersRef = useRef<Map<string, LobbyPlayerModel>>(new Map());
    const interpolatorsRef = useRef<Map<string, PlayerInterpolator>>(new Map());

    const createOtherPlayerModel = useCallback((player: LobbyPlayerData, index: number) => {
        console.log(`🔧 [Players] Creating model for ${player.id} (${player.username})...`);

        if (!sceneRef.current) {
            console.warn(`⚠️ [Players] Scene not ready for ${player.id}`);
            return;
        }

        if (playersRef.current.has(player.id)) {
            console.warn(`⚠️ [Players] Player ${player.id} already exists`);
            return;
        }

        try {
            const cloned = PlayerModelLoader.getModelClone();
            if (!cloned) {
                console.error(`❌ [Players] Clone failed for ${player.id}`);
                return;
            }

            const animator = new PlayerAnimator(cloned);
            cloned.userData.animator = animator;

            const groundOffset = PlayerModelLoader.getGroundOffset();
            cloned.position.set(player.position.x, groundOffset, player.position.z);
            cloned.rotation.set(0, player.rotation.y, 0);

            sceneRef.current.add(cloned);

            const sprite = UsernameSprite.create(player.username, 0x00ffff);
            cloned.add(sprite);

            const interpolator = new PlayerInterpolator();
            interpolator.addSnapshot(Date.now(), player.position, { x: 0, y: player.rotation.y, z: 0 });
            interpolatorsRef.current.set(player.id, interpolator);

            playersRef.current.set(player.id, {
                group: cloned,
                animator,
                animData: {
                    walkPhase: 0,
                    isMoving: false,
                    isShooting: false,
                    isReloading: false,
                    isDead: false,
                    hitFlash: 0,
                    deathAnimation: 0
                },
                sprite,
                targetPosition: new THREE.Vector3(player.position.x, groundOffset, player.position.z),
                targetRotationY: player.rotation.y,
            });

            console.log(`✅ [Players] Model created for ${player.id}`);
        } catch (err) {
            console.error(`❌ [Players] Failed for ${player.id}:`, err);
        }
    }, [sceneRef]);

    const removePlayerModel = useCallback((playerId: string) => {
        const playerData = playersRef.current.get(playerId);
        if (!playerData || !sceneRef.current) return;
        sceneRef.current.remove(playerData.group);
        playerData.group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material?.dispose();
            }
        });
        playersRef.current.delete(playerId);
        interpolatorsRef.current.delete(playerId);
    }, [sceneRef]);

    const updatePlayers = useCallback((deltaTime: number) => {
        playersRef.current.forEach((playerData, id) => {
            const interpolator = interpolatorsRef.current.get(id);
            if (!interpolator) return;

            const state = interpolator.getInterpolatedState();
            if (state) {
                const groundOffset = PlayerModelLoader.getGroundOffset();
                playerData.group.position.x = state.position.x;
                playerData.group.position.y = groundOffset;
                playerData.group.position.z = state.position.z;
                playerData.group.rotation.y = state.rotation.y;
            }

            if (playerData.animator) {
                playerData.animator.update(deltaTime, {
                    isMoving: playerData.animData.isMoving,
                    moveSpeed: playerData.animData.isMoving ? 1 : 0,
                    strafeInput: 0,
                });
            }
        });
    }, []);

    const clearPlayers = useCallback(() => {
        playersRef.current.forEach((pd) => {
            if (sceneRef.current) {
                sceneRef.current.remove(pd.group);
                pd.group.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material?.dispose();
                    }
                });
            }
        });
        playersRef.current.clear();
        interpolatorsRef.current.clear();
    }, [sceneRef]);

    return {
        playersRef,
        interpolatorsRef,
        createOtherPlayerModel,
        removePlayerModel,
        updatePlayers,
        clearPlayers,
    };
}