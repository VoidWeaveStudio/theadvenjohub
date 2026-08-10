// src/features/game/core/GameLocationOrchestration.ts
import * as THREE from "three";
import type { Game } from "./Game";

export const DEFAULT_SPAWN_LOCATION_ID = "tower-main-hall";

export async function restoreToSavedProgress(game: Game) {
    try {
        const currentId = game.locationManager.getCurrentLocation()?.id;
        if (currentId !== DEFAULT_SPAWN_LOCATION_ID) {
            await game.changeLocation(DEFAULT_SPAWN_LOCATION_ID, { silent: true });
        }

        const hall = game.locationManager.getCurrentLocation();
        if (hall) {
            const spawnPoint = hall.getSpawnPoint();
            game.player.teleportTo(spawnPoint);
            game.cameraController.yawObject.position.copy(spawnPoint);
        }
    } catch (error) {
        console.error("Failed to place player at the main hall:", error);
    } finally {
        game.setWeaponEquipped(game.hudState.isWeaponEquipped);
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
