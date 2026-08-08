// src/features/game/core/GameLocationTransition.ts
import * as THREE from "three";
import type { Game } from "./Game";
import { Location } from "../world/Location";
import { MainHall } from "../world/locations/tower/floors/MainHall";
import { Basement } from "../world/locations/tower/floors/basement/Basement";
import { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";
import { MainWorld } from "../world/locations/main-world/MainWorld";

export function applyLocationMovementConfig(game: Game, location: Location) {
    game.player.setTerrain(location.terrain ?? null);
    game.player.setCollisionGrid(location.collisionGrid!);
    game.cameraController.setCollisionGrid(location.cameraCollisionGrid ?? location.collisionGrid!);
    game.player.setMaxRadius(location.maxPlayerRadius ?? 9999);
    game.shootingSystem.setLocation(location, location.collisionGrid ?? null);
}

export function configureLocationSpecifics(game: Game, location: Location) {
    if (location instanceof MainHall) {
        game.safeZone.create(
            location.scene,
            undefined,
            new THREE.Vector3(0, 0, 0),
            location.hallRadius - 3
        );
    } else if (location instanceof Basement) {
        location.columns.syncFromServer(game.slug);
    } else if (location instanceof FirstFloor) {
        location.onInteractablesChanged = (added, removed) => {
            removed.forEach((obj) => game.interactionSystem.removeInteractable(obj));
            added.forEach((obj) => game.interactionSystem.registerInteractable(obj));
        };
        location.onReadyToEnterDungeon = () => {
            game.enterCanyonDungeon();
        };
        location.onSegmentCrossed = () => {
            game.networkManager.sendCanyonCrossThreshold();
        };
    }
}

export async function syncMainWorldEntry(game: Game, location: MainWorld) {
    game.onLoadStateChange?.(true, "Syncing with server...");
    game.lootSystem.preloadTokenTextures();
    await game.enemySystem.waitForInitialSync();
}
