// src/features/game/core/GameLocationTransition.ts
import * as THREE from "three";
import type { Game } from "./Game";
import { Location } from "../world/Location";
import { MainHall } from "../world/locations/tower/floors/main-hall/MainHall";
import { Basement } from "../world/locations/tower/floors/basement/Basement";
import { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";
import { Cave } from "../world/locations/cave/Cave";
import { MainWorld } from "../world/locations/main-world/MainWorld";
import { PersonalRoom } from "../world/locations/tower/floors/PersonalRoom";
import { FactionGateRoom } from "../world/locations/tower/floors/FactionGateRoom";
import { SAFE_ZONE_RADIUS } from "../world/locations/main-world/worldConfig";

export function applyLocationMovementConfig(game: Game, location: Location) {
    game.player.setTerrain(location.terrain ?? null);
    game.player.setWaterProvider(location.waterProvider ?? null);
    game.player.setCollisionGrid(location.collisionGrid!);
    game.cameraController.setCollisionGrid(location.cameraCollisionGrid ?? location.collisionGrid!);
    game.cameraController.setCoverProbe(location.coverProbe ?? null);
    game.cameraController.setCameraBounds(location.cameraBounds ?? null);
    game.player.setMaxRadius(location.maxPlayerRadius ?? 9999);
    game.player.setFlightZone(location.flightZone ?? null);
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

        if (game.leaderboard.length > 0) location.setLeaderboard(game.leaderboard);
        if (game.factionLeaderboard.length > 0) location.setFactionLeaderboard(game.factionLeaderboard);
        if (game.factionQuests.length > 0) location.setFactionQuests(game.factionQuests);

        location.onRequestBoardData = () => {
            game.requestLeaderboard();
            game.requestFactionLeaderboard();
            game.requestFactionQuestList();
        };
        location.onRequestBoardData();
    } else if (location instanceof MainWorld) {
        game.safeZone.create(
            location.scene,
            location.terrain,
            new THREE.Vector3(0, 0, 0),
            SAFE_ZONE_RADIUS
        );
    } else if (location instanceof Basement) {
        location.onInteractablesChanged = (added, removed) => {
            removed.forEach((obj) => game.interactionSystem.removeInteractable(obj));
            added.forEach((obj) => game.interactionSystem.registerInteractable(obj));
        };
        if (game.factionGates.length > 0) {
            location.handleFactionGatesState(game.factionGates);
        }
        location.columns.syncFromServer(game.slug);
        location.setViewportHeight(game.getViewportHeight());
        location.setAccountCount(game.accountCount);
        location.setWaypointIndex(game.getBubbleWaypoint());
        game.applyGalaxySpawn(location);
    } else if (location instanceof PersonalRoom || location instanceof FactionGateRoom) {
        location.onInteractablesChanged = (added, removed) => {
            removed.forEach((obj) => game.interactionSystem.removeInteractable(obj));
            added.forEach((obj) => game.interactionSystem.registerInteractable(obj));
        };
    } else if (location instanceof Cave) {
        location.onOpenChest = (chestId) => game.networkManager.sendCaveChestOpen(chestId);
        location.setBossDefeated(game.caveBossDefeated);
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
    game.onLoadStateChange?.(true, "Syncing with the server...", 0.7);
    game.lootSystem.preloadTokenTextures();
    await game.enemySystem.waitForInitialSync();
}
