// src/features/game/systems/BuildSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { Sign } from "../entities/Sign";
import { NetworkManager, SignData } from "../network/NetworkManager";
import { InputManager } from "../core/InputManager";
import { InteractionSystem } from "./InteractionSystem";
import { PLACEABLE_ITEMS } from "../data/placeableItems";

const REACH_DISTANCE = 3;
const REMOVE_RADIUS = 5;


export class BuildSystem extends System {
    private scene!: THREE.Scene;
    private network!: NetworkManager;
    private player!: Player;
    private inputManager!: InputManager;
    private getGroundHeight!: (x: number, z: number) => number;
    private interactionSystem!: InteractionSystem;
    private myUserId: string = "";
    private isMainWorldScene: boolean = false;
    private currentRoomFactionId: string | null = null;

    private signs: Map<string, Sign> = new Map();
    private pendingSigns: SignData[] = [];
    private ghost: Sign | null = null;


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
        myUserId: string
    ) {
        this.scene = scene;
        this.isMainWorldScene = locationId === 'main-world';
        this.currentRoomFactionId = parseFactionRoomId(locationId);
        this.network = network;
        this.player = player;
        this.inputManager = inputManager;
        this.getGroundHeight = getGroundHeight;
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
        if (this.ghost) {
            this.scene.add(this.ghost.mesh);
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

    public update(_delta: number) {
        if (!this.active) {
            this.wasPlaceButtonDown = false;
            this.wasRemoveButtonDown = false;
            return;
        }

        const playerPos = this.player.mesh.position;
        const yaw = this.player.mesh.rotation.y;
        const reachX = playerPos.x + Math.sin(yaw) * REACH_DISTANCE;
        const reachZ = playerPos.z + Math.cos(yaw) * REACH_DISTANCE;

        const placeX = reachX;
        const placeY = this.getGroundHeight(reachX, reachZ);
        const placeZ = reachZ;
        const placeRotation = yaw;

        if (this.armedItemId && this.ghost) {
            this.ghost.mesh.position.set(placeX, placeY, placeZ);
            this.ghost.mesh.rotation.y = placeRotation;
        }

        const pointerLocked = this.inputManager.isPointerLockedState();

        const placeDown = pointerLocked && this.inputManager.isMousePressed(0);
        if (placeDown && !this.wasPlaceButtonDown && this.armedItemId) {
            this.tryPlace(placeX, placeY, placeZ, placeRotation);
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
        this.network.sendSignPlace([x, y, z], rotation);
    }

    private tryRemoveNearestOwned(playerPos: THREE.Vector3) {
        let nearestId: string | null = null;
        let nearestDist = Infinity;

        for (const sign of this.signs.values()) {
            if (sign.ownerId !== this.myUserId) continue;
            const d = playerPos.distanceTo(sign.mesh.position);
            if (d < REMOVE_RADIUS && d < nearestDist) {
                nearestDist = d;
                nearestId = sign.id;
            }
        }

        if (!nearestId) return;
        this.network.sendSignRemove(nearestId);
    }

    public clear() {
        for (const id of Array.from(this.signs.keys())) {
            this.despawnLocal(id);
        }
        if (this.ghost) {
            this.ghost.dispose(this.scene);
            this.ghost = null;
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
