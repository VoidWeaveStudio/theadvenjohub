// src/features/game/core/GameLocationOrchestration.ts
import * as THREE from "three";
import type { Game } from "./Game";

export async function restoreToSavedProgress(
    game: Game,
    progress?: { locationId?: string; position: number[]; rotation?: number }
) {
    try {
        const currentId = game.locationManager.getCurrentLocation()?.id;
        if (progress?.locationId && progress.locationId !== currentId) {
            await game.changeLocation(progress.locationId, {
                position: progress.position,
                rotation: progress.rotation,
                silent: true,
            });
        } else if (progress?.position) {
            const pos = new THREE.Vector3(progress.position[0], progress.position[1], progress.position[2]);
            game.player.teleportTo(pos);
            game.cameraController.yawObject.position.copy(pos);
            if (progress.rotation !== undefined) {
                game.player.mesh.rotation.y = progress.rotation;
            }
        }
    } catch (error) {
        console.error("Failed to restore saved location:", error);
    } finally {
        game.restoreResolver?.();
        game.restoreResolver = null;
    }
}

export function waitForProgressRestore(game: Game, timeoutMs = 6000): Promise<void> {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };
        game.restoreResolver = finish;
        setTimeout(finish, timeoutMs);
    });
}

export function teleportToSafeZone(game: Game) {
    if (game.isDead) {
        game.networkManager.sendRespawnRequest();
        return;
    }

    const currentLocation = game.locationManager.getCurrentLocation();
    if (!currentLocation) return;

    if (currentLocation.id !== 'tower-main-hall') {
        game.changeLocation('tower-main-hall').then(() => {
            const hall = game.locationManager.getCurrentLocation();
            if (hall) {
                const safePoint = hall.getSpawnPoint();
                game.player.teleportTo(safePoint);
                game.cameraController.yawObject.position.copy(safePoint);
                game.networkManager.sendPlayerUpdate({
                    position: safePoint.toArray(),
                    rotation: game.player.mesh.rotation.y,
                    pitch: game.cameraController.getPitch(),
                    state: 'idle', jumping: false, velocityY: 0,
                    weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
                });
                game.onNotification?.("🛡️ Teleported to Safe Zone", 2500);
            }
        });
        return;
    }

    const safePoint = currentLocation.getSpawnPoint();
    game.player.teleportTo(safePoint);
    game.cameraController.yawObject.position.copy(safePoint);

    game.networkManager.sendPlayerUpdate({
        position: safePoint.toArray(),
        rotation: game.player.mesh.rotation.y,
        pitch: game.cameraController.getPitch(),
        state: 'idle', jumping: false, velocityY: 0,
        weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
    });

    game.onNotification?.("🛡️ Teleported to Safe Zone", 2500);
}
