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
import { EventsLobby } from "../world/locations/events/EventsLobby";
import { Dust2 } from "../world/locations/events/rooms/Dust2";
import { GRINDER_LOCATION_ID } from "../data/eventDoors";
import type { WorldImpactSound } from "../systems/ShootingSystem";
import { SAFE_ZONE_RADIUS } from "../world/locations/main-world/worldConfig";
import { syncWorldStatus } from "./GameWorldState";
import type { FootstepSurface } from "./SoundManager";

export function applyFirstPersonMode(game: Game, location: Location) {
    const firstPerson = location instanceof Dust2;
    game.cameraController.setFirstPerson(firstPerson);
    game.player.setSelfHidden(firstPerson);
}

export function applyLocationMovementConfig(game: Game, location: Location) {
    applyFirstPersonMode(game, location);
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

function footstepSurfaceFor(id: string): FootstepSurface {
    if (id === "cave") return "stone";
    if (id === "dust2") return "sand";
    if (id.startsWith("tower-") || id === "basement") return "stone";
    if (id.startsWith("room-") || id.startsWith("faction-")) return "wood";
    return "soft";
}

function worldImpactFor(id: string): WorldImpactSound {
    if (id === "main-world") return "impact-dirt";
    if (id.startsWith("room-") || id.startsWith("faction-")) return "impact-wood";
    if (id === "tower-token-gates" || id === "tower-basement") return "impact-glass";
    return "impact-stone";
}

export function configureLocationSpecifics(game: Game, location: Location) {
    game.player.footstepSurface = footstepSurfaceFor(location.id);
    game.shootingSystem.worldImpactSound = worldImpactFor(location.id);

    game.dust2Mode = location instanceof Dust2;
    if (!game.dust2Mode) {
        game.dust2MateIds.clear();
        game.minimapMates.length = 0;
        game.minimapBomb = null;
    }
    if (location.id !== GRINDER_LOCATION_ID) game.onGrinderState?.(null);
    if (!game.dust2Mode) game.clearDefusalView();

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
    } else if (location instanceof EventsLobby) {
        game.safeZone.create(
            location.scene,
            undefined,
            new THREE.Vector3(0, 0, 0),
            location.hallRadius - 4
        );

        if (game.eventStates.length > 0) location.applyEventStates(game.eventStates);
        game.refreshEventStates();
    } else if (location instanceof MainWorld) {
        game.safeZone.create(
            location.scene,
            location.terrain,
            new THREE.Vector3(0, 0, 0),
            SAFE_ZONE_RADIUS
        );

        syncWorldStatus(game, location);
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
