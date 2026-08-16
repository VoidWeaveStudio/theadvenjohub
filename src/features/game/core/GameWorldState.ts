// src/features/game/core/GameWorldState.ts
import type { Game } from "./Game";
import type { WorldStatusData } from "../network/NetworkManager";
import { MainWorld } from "../world/locations/main-world/MainWorld";

function pushToWorld(game: Game, location: MainWorld, status: WorldStatusData | null) {
    location.applyWorldStatus(status);
    game.player.setMaxRadius(location.maxPlayerRadius ?? 9999);
}

export function applyWorldStatus(game: Game, status: WorldStatusData) {
    const previous = game.worldStatus;
    game.worldStatus = status;

    const location = game.locationManager.getCurrentLocation();
    if (location instanceof MainWorld) {
        pushToWorld(game, location, status);
    }

    if (!previous) return;

    if (previous.tier !== status.tier) {
        if (status.radius === null) {
            game.onNotification?.("The rampart has fallen. The world is open.", 5000);
        } else if (status.tier > previous.tier) {
            game.onNotification?.(`The rampart has grown to ${status.radius}m`, 4000);
        }
    }

    if (previous.portal.status === status.portal.status) return;

    if (status.portal.status === "active") {
        game.onNotification?.(`A rift has torn open to the ${compass(status.portal.x, status.portal.z)}`, 6000);
    } else if (previous.portal.status === "active") {
        game.onNotification?.("The rift has collapsed.", 5000);
    }
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

function compass(x: number, z: number): string {
    const angle = Math.atan2(x, -z);
    const index = Math.round((angle / (Math.PI * 2)) * 8 + 8) % 8;
    return COMPASS[index];
}

export function syncWorldStatus(game: Game, location: MainWorld) {
    pushToWorld(game, location, game.worldStatus);
}
