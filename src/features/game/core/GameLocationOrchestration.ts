// src/features/game/core/GameLocationOrchestration.ts
import * as THREE from "three";
import type { Game } from "./Game";

export const DEFAULT_SPAWN_LOCATION_ID = "tower-main-hall";

const TELEPORT_GRACE_MS = 2500;
const RECOVERY_FLOOR_Y = -40;
const RECOVERY_MARGIN = 6;

export async function restoreToSavedProgress(game: Game) {
    try {
        const currentId = game.locationManager.getCurrentLocation()?.id;
        if (currentId !== DEFAULT_SPAWN_LOCATION_ID) {
            await game.changeLocation(DEFAULT_SPAWN_LOCATION_ID, { silent: true });
        }

        const hall = game.locationManager.getCurrentLocation();
        if (hall) placeAtLocationSpawn(game, { notify: false, resync: false });
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

export function beginTeleportGrace(game: Game) {
    game.correctionGraceUntil = Date.now() + TELEPORT_GRACE_MS;
}

function resyncPosition(game: Game) {
    game.networkManager.sendPlayerUpdate({
        position: game.player.mesh.position.toArray(),
        rotation: game.player.mesh.rotation.y,
        pitch: game.cameraController.getPitch(),
        state: 'idle',
        jumping: false,
        velocityY: 0,
        weaponEquipped: game.hudState.isWeaponEquipped,
        isShooting: false,
    });
}

export function placeAtLocationSpawn(game: Game, options?: { notify?: boolean; resync?: boolean }) {
    const location = game.locationManager.getCurrentLocation();
    if (!location) return;

    const safePoint = location.getSpawnPoint();

    game.candleSystem.stop(game.player.id);
    game.player.playPose(null);
    game.player.setMovementLocked(false);
    game.player.teleportTo(safePoint);
    game.cameraController.resetVerticalSmoothing();
    game.cameraController.yawObject.position.copy(game.player.mesh.position);

    beginTeleportGrace(game);
    if (options?.resync !== false) resyncPosition(game);
    if (options?.notify !== false) game.onNotification?.("🛡️ Teleported to Safe Zone", 2500);
}

export function teleportToSafeZone(game: Game) {
    if (game.isDead) {
        game.networkManager.sendRespawnRequest();
        return;
    }

    game.networkManager.sendStuckTeleport();
}

export function placeAtPoint(game: Game, position: number[]) {
    const point = new THREE.Vector3(position[0], position[1], position[2]);

    game.candleSystem.stop(game.player.id);
    game.player.playPose(null);
    game.player.setMovementLocked(false);
    game.player.teleportTo(point);
    game.cameraController.resetVerticalSmoothing();
    game.cameraController.yawObject.position.copy(game.player.mesh.position);

    beginTeleportGrace(game);
    resyncPosition(game);
}

export function moveToServerPlacement(game: Game, locationId: string, position: number[] | undefined): Promise<void> {
    const place = () => {
        if (position && position.length === 3 && position.every((v) => Number.isFinite(v))) {
            placeAtPoint(game, position);
        } else {
            placeAtLocationSpawn(game, { notify: false });
        }
    };

    const current = game.locationManager.getCurrentLocation();
    if (!current || current.id === locationId) {
        place();
        return Promise.resolve();
    }

    return game.changeLocation(locationId, { silent: true }).then(place);
}

export function applyStuckTeleport(game: Game, locationId: string) {
    const currentLocation = game.locationManager.getCurrentLocation();
    if (!currentLocation) return;

    if (currentLocation.id === locationId) {
        placeAtLocationSpawn(game);
        return;
    }

    game.changeLocation(locationId, { silent: true })
        .then(() => placeAtLocationSpawn(game))
        .catch(() => game.onNotification?.("⚠️ Could not reach the Safe Zone", 2500));
}

export function applyPositionCorrection(game: Game, position: number[]) {
    if (game.isChangingLocation) return;
    if (Date.now() < game.correctionGraceUntil) {
        resyncPosition(game);
        return;
    }

    const location = game.locationManager.getCurrentLocation();
    if (!location) return;

    const [x, y, z] = position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

    const limit = location.maxPlayerRadius ?? null;
    if (limit !== null && Math.hypot(x, z) > limit) {
        resyncPosition(game);
        return;
    }

    if (!location.terrain && !location.flightZone && y < RECOVERY_FLOOR_Y) {
        resyncPosition(game);
        return;
    }

    game.player.teleportTo(new THREE.Vector3(x, y, z));
    game.cameraController.resetVerticalSmoothing();
}

export function enforcePlayerBounds(game: Game) {
    if (game.isChangingLocation) return;

    const location = game.locationManager.getCurrentLocation();
    if (!location) return;
    if (game.player.isFlying()) return;

    const position = game.player.mesh.position;
    const limit = location.maxPlayerRadius ?? null;
    const outOfRing = limit !== null && Math.hypot(position.x, position.z) > limit + RECOVERY_MARGIN;
    const belowFloor = !location.terrain && !location.flightZone && position.y < RECOVERY_FLOOR_Y;

    if (!outOfRing && !belowFloor) return;

    placeAtLocationSpawn(game, { notify: false });
}
