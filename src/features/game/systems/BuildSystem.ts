// src/features/game/systems/BuildSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { Sign } from "../entities/Sign";
import { NetworkManager, SignData, FurnitureData } from "../network/NetworkManager";
import { InputManager } from "../core/InputManager";
import { InteractionSystem } from "./InteractionSystem";
import { FURNITURE_DEFS, FurnitureEntity, isFurnitureItemId } from "./FurnitureRegistry";
import { PLACEABLE_ITEMS } from "../data/placeableItems";

const REACH_DISTANCE = 3;
const REMOVE_RADIUS = 5;

type WallSnap = { x: number; y: number; z: number; rotation: number };

export class BuildSystem extends System {
    private scene!: THREE.Scene;
    private network!: NetworkManager;
    private player!: Player;
    private inputManager!: InputManager;
    private getGroundHeight!: (x: number, z: number) => number;
    private getWallSnap: ((x: number, z: number) => WallSnap | null) | null = null;
    private interactionSystem!: InteractionSystem;
    private myUserId: string = "";
    private isMainWorldScene: boolean = false;
    private currentRoomFactionId: string | null = null;

    private signs: Map<string, Sign> = new Map();
    private pendingSigns: SignData[] = [];
    private ghost: Sign | null = null;

    private placedFurniture: Map<string, FurnitureEntity> = new Map();
    private furnitureGhost: FurnitureEntity | null = null;

    private active: boolean = false;
    private armedItemId: string | null = null;
    private placeables: Record<string, number> = {};
    private wasPlaceButtonDown: boolean = false;
    private wasRemoveButtonDown: boolean = false;

    public onNotification?: (msg: string, duration?: number) => void;

    init(
        scene: THREE.Scene,
        locationId: string,
        network: NetworkManager,
        player: Player,
        inputManager: InputManager,
        getGroundHeight: (x: number, z: number) => number,
        interactionSystem: InteractionSystem,
        myUserId: string,
        getWallSnap?: (x: number, z: number) => WallSnap | null
    ) {
        this.scene = scene;
        this.isMainWorldScene = locationId === 'main-world';
        this.currentRoomFactionId = parseFactionRoomId(locationId);
        this.network = network;
        this.player = player;
        this.inputManager = inputManager;
        this.getGroundHeight = getGroundHeight;
        this.getWallSnap = getWallSnap ?? null;
        this.interactionSystem = interactionSystem;
        this.myUserId = myUserId;
    }

    public setScene(scene: THREE.Scene, locationId: string) {
        this.scene = scene;
        this.isMainWorldScene = locationId === 'main-world';
        this.currentRoomFactionId = parseFactionRoomId(locationId);

        for (const sign of this.signs.values()) {
            scene.add(sign.mesh);
        }
        for (const item of this.placedFurniture.values()) {
            scene.add(item.mesh);
        }
        if (this.ghost) {
            this.scene.add(this.ghost.mesh);
        }
        if (this.furnitureGhost) {
            this.scene.add(this.furnitureGhost.mesh);
        }
        if (this.isMainWorldScene && this.pendingSigns.length > 0) {
            const pending = this.pendingSigns;
            this.pendingSigns = [];
            for (const data of pending) this.spawnLocal(data);
        }
    }

    public setPlaceables(placeables: Record<string, number>) {
        this.placeables = placeables;
    }

    public setActive(active: boolean) {
        this.active = active;
        if (!active) {
            this.disarm();
        }
    }

    private isItemFree(itemId: string): boolean {
        return PLACEABLE_ITEMS.find((i) => i.id === itemId)?.price === 0;
    }

    public armPlaceable(itemId: string) {
        if (!this.active) return;
        if (!this.isItemFree(itemId) && !(this.placeables[itemId] > 0)) {
            this.onNotification?.("You don't own any of that", 2000);
            return;
        }

        this.disarm();
        this.armedItemId = itemId;

        if (isFurnitureItemId(itemId)) {
            const def = FURNITURE_DEFS[itemId];
            this.furnitureGhost = def.build("__ghost__", true);
            this.scene.add(this.furnitureGhost.mesh);
            return;
        }

        if (!this.ghost) {
            this.ghost = new Sign("__ghost__", "", "", null, null, null, true);
            this.scene.add(this.ghost.mesh);
        }
        this.ghost.mesh.visible = true;
    }

    public disarm() {
        this.armedItemId = null;
        if (this.ghost) {
            this.ghost.mesh.visible = false;
        }
        if (this.furnitureGhost) {
            this.furnitureGhost.dispose(this.scene);
            this.furnitureGhost = null;
        }
    }

    public isArmed(): boolean {
        return this.armedItemId !== null;
    }

    private spawnLocal(data: SignData) {
        if (!this.isMainWorldScene) {
            if (!this.pendingSigns.some((s) => s.id === data.id)) {
                this.pendingSigns.push(data);
            }
            return;
        }
        if (this.signs.has(data.id)) return;
        const sign = new Sign(data.id, data.ownerId, data.ownerNickname, data.contentType, data.textContent, data.drawingUrl);
        sign.mesh.position.set(data.position[0], data.position[1], data.position[2]);
        sign.mesh.rotation.y = data.rotation;
        sign.mesh.userData.ownerId = data.ownerId;
        sign.mesh.userData.contentType = data.contentType;
        this.scene.add(sign.mesh);
        this.signs.set(data.id, sign);
        this.interactionSystem.registerInteractable(sign.mesh);
    }

    private despawnLocal(id: string) {
        const sign = this.signs.get(id);
        if (!sign) return;
        this.interactionSystem.removeInteractable(sign.mesh);
        sign.dispose(this.scene);
        this.signs.delete(id);
    }

    public handleSignState(list: SignData[]) {
        for (const data of list) this.spawnLocal(data);
    }

    public handleSignSpawn(data: SignData) {
        this.spawnLocal(data);
    }

    public handleSignDespawn(id: string) {
        this.despawnLocal(id);
        this.pendingSigns = this.pendingSigns.filter((s) => s.id !== id);
    }

    public handleSignContentSet(data: { id: string; contentType: "text" | "draw"; textContent?: string; drawingUrl?: string }) {
        const sign = this.signs.get(data.id);
        if (!sign) return;
        sign.updateContent(data.contentType, data.textContent ?? null, data.drawingUrl ?? null);
        sign.mesh.userData.contentType = data.contentType;
    }

    public getSign(id: string): Sign | undefined {
        return this.signs.get(id);
    }

    private spawnLocalFurniture(data: FurnitureData) {
        // Furniture belongs to a specific faction's room, unlike signs (always
        // main-world) — a mismatched factionId means this data is for a room
        // we've since left, so it's dropped rather than queued: the server
        // re-sends a fresh furnitureState whenever we actually enter a room.
        if (data.factionId !== this.currentRoomFactionId) return;
        if (this.placedFurniture.has(data.id)) return;
        const def = FURNITURE_DEFS[data.itemId];
        if (!def) return;

        const entity = def.build(data.id, false, {
            ownerId: data.ownerId,
            ownerNickname: data.ownerNickname,
            contentType: data.contentType,
            textContent: data.textContent,
            drawingUrl: data.drawingUrl,
        });
        entity.mesh.position.set(data.position[0], data.position[1], data.position[2]);
        entity.mesh.rotation.y = data.rotation;
        entity.mesh.userData.ownerId = data.ownerId;
        entity.mesh.userData.itemId = data.itemId;
        this.scene.add(entity.mesh);
        this.placedFurniture.set(data.id, entity);
        if (entity.mesh.userData.interactionId) {
            this.interactionSystem.registerInteractable(entity.mesh);
        }
    }

    private despawnLocalFurniture(id: string) {
        const item = this.placedFurniture.get(id);
        if (!item) return;
        if (item.mesh.userData.interactionId) {
            this.interactionSystem.removeInteractable(item.mesh);
        }
        item.dispose(this.scene);
        this.placedFurniture.delete(id);
    }

    public handleFurnitureState(list: FurnitureData[]) {
        for (const data of list) this.spawnLocalFurniture(data);
    }

    public handleFurnitureSpawn(data: FurnitureData) {
        this.spawnLocalFurniture(data);
    }

    public handleFurnitureDespawn(id: string) {
        this.despawnLocalFurniture(id);
    }

    public handleFurnitureContentSet(data: { id: string; contentType: "text" | "draw"; textContent?: string; drawingUrl?: string }) {
        const item = this.placedFurniture.get(data.id);
        if (!item?.updateContent) return;
        item.updateContent(data.contentType, data.textContent ?? null, data.drawingUrl ?? null);
        item.mesh.userData.contentType = data.contentType;
    }

    public getFurniture(id: string): FurnitureEntity | undefined {
        return this.placedFurniture.get(id);
    }

    public toggleFurnitureOpen(id: string) {
        this.placedFurniture.get(id)?.toggleOpen?.();
    }

    public update(_delta: number) {
        if (this.placedFurniture.size > 0) {
            const now = performance.now();
            for (const item of this.placedFurniture.values()) item.update?.(now);
        }

        if (!this.active) {
            this.wasPlaceButtonDown = false;
            this.wasRemoveButtonDown = false;
            return;
        }

        const playerPos = this.player.mesh.position;
        const yaw = this.player.mesh.rotation.y;
        const reachX = playerPos.x + Math.sin(yaw) * REACH_DISTANCE;
        const reachZ = playerPos.z + Math.cos(yaw) * REACH_DISTANCE;

        const armedDef = this.armedItemId && isFurnitureItemId(this.armedItemId) ? FURNITURE_DEFS[this.armedItemId] : null;
        const wallSnap = armedDef?.wallMounted ? this.getWallSnap?.(reachX, reachZ) ?? null : null;

        let placeX = reachX;
        let placeY = this.getGroundHeight(reachX, reachZ);
        let placeZ = reachZ;
        let placeRotation = yaw;
        if (wallSnap) {
            placeX = wallSnap.x;
            placeY = wallSnap.y;
            placeZ = wallSnap.z;
            placeRotation = wallSnap.rotation;
        }

        if (this.armedItemId && armedDef && this.furnitureGhost) {
            this.furnitureGhost.mesh.position.set(placeX, placeY, placeZ);
            this.furnitureGhost.mesh.rotation.y = placeRotation;
        } else if (this.armedItemId && this.ghost) {
            this.ghost.mesh.position.set(placeX, placeY, placeZ);
            this.ghost.mesh.rotation.y = placeRotation;
        }

        const pointerLocked = this.inputManager.isPointerLockedState();

        const placeDown = pointerLocked && this.inputManager.isMousePressed(0);
        if (placeDown && !this.wasPlaceButtonDown && this.armedItemId) {
            if (!armedDef?.wallMounted || wallSnap) {
                this.tryPlace(placeX, placeY, placeZ, placeRotation);
            } else {
                this.onNotification?.("Stand closer to a wall to place this", 1500);
            }
        }
        this.wasPlaceButtonDown = placeDown;

        const removeDown = pointerLocked && this.inputManager.isMousePressed(2);
        if (removeDown && !this.wasRemoveButtonDown) {
            if (this.armedItemId) {
                this.disarm();
            } else {
                this.tryRemoveNearestOwned(playerPos);
            }
        }
        this.wasRemoveButtonDown = removeDown;
    }

    private tryPlace(x: number, y: number, z: number, rotation: number) {
        if (!this.armedItemId) return;
        if (!this.isItemFree(this.armedItemId) && !(this.placeables[this.armedItemId] > 0)) {
            this.onNotification?.("You don't own any of that — buy one from the Shop", 2500);
            return;
        }
        if (isFurnitureItemId(this.armedItemId)) {
            this.network.sendItemPlace(this.armedItemId, [x, y, z], rotation);
            return;
        }
        this.network.sendSignPlace([x, y, z], rotation);
    }

    private tryRemoveNearestOwned(playerPos: THREE.Vector3) {
        let nearestId: string | null = null;
        let nearestDist = Infinity;
        let nearestIsFurniture = false;

        for (const sign of this.signs.values()) {
            if (sign.ownerId !== this.myUserId) continue;
            const d = playerPos.distanceTo(sign.mesh.position);
            if (d < REMOVE_RADIUS && d < nearestDist) {
                nearestDist = d;
                nearestId = sign.id;
                nearestIsFurniture = false;
            }
        }

        for (const item of this.placedFurniture.values()) {
            if (item.mesh.userData.ownerId !== this.myUserId) continue;
            const d = playerPos.distanceTo(item.mesh.position);
            if (d < REMOVE_RADIUS && d < nearestDist) {
                nearestDist = d;
                nearestId = item.id;
                nearestIsFurniture = true;
            }
        }

        if (!nearestId) return;
        if (nearestIsFurniture) {
            this.network.sendItemRemove(nearestId);
        } else {
            this.network.sendSignRemove(nearestId);
        }
    }

    public clear() {
        for (const id of Array.from(this.signs.keys())) {
            this.despawnLocal(id);
        }
        for (const id of Array.from(this.placedFurniture.keys())) {
            this.despawnLocalFurniture(id);
        }
        if (this.ghost) {
            this.ghost.dispose(this.scene);
            this.ghost = null;
        }
        if (this.furnitureGhost) {
            this.furnitureGhost.dispose(this.scene);
            this.furnitureGhost = null;
        }
        this.armedItemId = null;
    }

    dispose() {
        this.clear();
    }
}

function parseFactionRoomId(locationId: string): string | null {
    const prefix = "faction-gate-";
    return locationId.startsWith(prefix) ? locationId.slice(prefix.length) : null;
}
