// src/features/game/systems/InteractionSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { SafeZone } from "../world/SafeZone";
import { PAINT_PREFIX } from "../world/building/BuildRenderer";
import { SPAWN_BEACON_INTERACTION, STORAGE_INTERACTION } from "../world/building/BuildCatalog";
import { DEATH_CRATE_PREFIX } from "../entities/DeathCrate";
import { ARENA_ALTAR_INTERACTION, EVENT_DOORS_BY_ID, EVENT_DOOR_PREFIX, EVENT_EXIT_INTERACTION } from "../data/eventDoors";

const ARENA_REVIVE_PREFIX = "arena-revive:";

interface TokenInfo {
    name: string;
    symbol?: string;
    balance?: number;
}

interface TokenData {
    ca: string;
    name: string;
    symbol: string;
}

export class InteractionSystem extends System {
    private scene!: THREE.Scene;
    private player!: Player;
    private inputManager!: InputManager;
    private safeZone!: SafeZone;
    private interactableObjects: THREE.Object3D[] = [];

    private interactionRadius: number = 5;

    private static readonly _worldPos = new THREE.Vector3();

    public onNotification?: (msg: string, duration?: number) => void;
    public onPrompt?: (text: string | null) => void;
    public onCrystalInteract?: () => void;
    public onOpenVendor?: () => void;
    public onOpenSola?: () => void;
    public onOpenCanyonMap?: () => void;
    public onOpenFactionBroker?: () => void;
    public onOpenAlfredo?: () => void;
    public onOpenGateSteward?: () => void;
    public onOpenPlayerBubble?: (bubbleIndex: number) => void;
    public onOpenFactionBubble?: (factionId: string) => void;
    public onOpenRoomPortal?: () => void;
    public onOpenRoomConsole?: () => void;
    public onCanyonReturn?: () => void;
    public onOpenTokenUI?: (token: any) => void;
    public onEnterLocation?: (locationId: string) => void;
    public onOpenSignEditor?: (signId: string) => void;
    public onOpenSignViewer?: (signId: string) => void;
    public onOpenPosterPaint?: (pieceKey: string) => void;
    public onOpenStorage?: (pieceKey: string) => void;
    public onLootCrate?: (crateId: string) => void;
    public onOpenArena?: () => void;
    public onEnterEventRoom?: (eventId: string) => void;
    public onLeaveEventRoom?: () => void;
    public onArenaRevive?: (targetId: string) => void;
    public canPaintLot: boolean = false;
    public isOwnRoom: boolean = false;
    public localUserId: string = "";
    public myFactionIds: Set<string> = new Set();
    public isBlueprintActive: boolean = false;

    public setScene(scene: THREE.Scene) {
        this.scene = scene;
    }

    public clearInteractables() {
        this.interactableObjects = [];
    }

    init(scene: THREE.Scene, player: Player, inputManager: InputManager, safeZone: SafeZone) {
        this.scene = scene;
        this.player = player;
        this.inputManager = inputManager;
        this.safeZone = safeZone;
    }

    registerInteractable(obj: THREE.Object3D) {
        this.interactableObjects.push(obj);
    }

    removeInteractable(obj: THREE.Object3D) {
        const index = this.interactableObjects.indexOf(obj);
        if (index !== -1) this.interactableObjects.splice(index, 1);
    }

    findInteractable(interactionId: string): THREE.Object3D | null {
        return this.interactableObjects.find((obj) => obj.userData.interactionId === interactionId) ?? null;
    }

    private formatMC(value: number): string {
        if (value > 1e9) return (value / 1e9).toFixed(1) + "B";
        if (value > 1e6) return (value / 1e6).toFixed(1) + "M";
        if (value > 1e3) return (value / 1e3).toFixed(1) + "K";
        return value.toFixed(0);
    }

    update(_delta: number, isEJustPressed?: boolean) {
        const playerPos = this.player.mesh.position;
        let nearest: { obj: THREE.Object3D; dist: number } | null = null;

        for (const obj of this.interactableObjects) {
            const d = playerPos.distanceTo(obj.getWorldPosition(InteractionSystem._worldPos));
            const radius = (obj.userData.interactionRadius as number | undefined) ?? this.interactionRadius;
            if (d < radius && (!nearest || d < nearest.dist)) {
                nearest = { obj, dist: d };
            }
        }

        if (nearest) {
            const id = nearest.obj.userData.interactionId;

            if (id?.startsWith("faction-gate-")) {
                const factionId = id.slice("faction-gate-".length);
                const factionName = (nearest.obj.userData.factionName as string | undefined) ?? "Faction";
                this.onPrompt?.(`[E] Inspect ${factionName}`);
                if (isEJustPressed === true) {
                    this.onOpenFactionBubble?.(factionId);
                }
            } else if (id === "room-console") {
                this.onPrompt?.("[E] Room controls");
                if (isEJustPressed === true) {
                    this.onOpenRoomConsole?.();
                }
            } else if (id === "room-portal") {
                this.onPrompt?.("[E] Use the portal");
                if (isEJustPressed === true) {
                    this.onOpenRoomPortal?.();
                }
            } else if (id === "gate-steward") {
                this.onPrompt?.("[E] Speak to the Keeper");
                if (isEJustPressed === true) {
                    this.onOpenGateSteward?.();
                }
            } else if (id?.startsWith("player-bubble-")) {
                const bubbleIndex = Number(id.slice("player-bubble-".length));
                this.onPrompt?.("[E] Inspect bubble");
                if (isEJustPressed === true && Number.isFinite(bubbleIndex)) {
                    this.onOpenPlayerBubble?.(bubbleIndex);
                }
            } else if (id?.startsWith("column-")) {
                this.onPrompt?.("[E] View Token Info");
                if (isEJustPressed === true) {
                    const info = nearest.obj.userData.tokenInfo as TokenInfo | undefined;

                    if (!info || info.name === "Loading...") {
                        this.onNotification?.("⏳ Loading token data...", 2000);
                    } else if (info.name === "Empty Pedestal") {
                        this.onNotification?.("🪨 Empty pedestal", 2000);
                    } else {
                        this.onOpenTokenUI?.({
                            ...info,
                            ca: nearest.obj.userData.ca
                        });
                    }
                }
            } else if (id === "tower-crystal") {
                this.onPrompt?.("[E] Use the portal");
                if (isEJustPressed === true) {
                    if (this.onCrystalInteract) {
                        this.onCrystalInteract();
                    } else {
                        console.error("❌ [InteractionSystem] onCrystalInteract is UNDEFINED in Game.ts!");
                    }
                }
            } else if (id === "crystal") {
                this.onPrompt?.("[E] Interact with Crystal");
                if (isEJustPressed === true) {
                    this.onNotification?.("⚡ Events coming soon!", 3000);
                }
            } else if (id === "token-vendor") {
                this.onPrompt?.("[E] Trade tokens for Ash");
                if (isEJustPressed === true) {
                    this.onOpenVendor?.();
                }
            } else if (id === "quest-giver-sola") {
                this.onPrompt?.("[E] Talk to Sola");
                if (isEJustPressed === true) {
                    this.onOpenSola?.();
                }
            } else if (id === "faction-broker") {
                this.onPrompt?.("[E] Talk to Alaric");
                if (isEJustPressed === true) {
                    this.onOpenFactionBroker?.();
                }
            } else if (id === "npc-alfredo") {
                this.onPrompt?.("[E] Talk to Alfredo");
                if (isEJustPressed === true) {
                    this.onOpenAlfredo?.();
                }
            } else if (id === "canyon-dispatcher") {
                this.onPrompt?.("[E] View Canyon Map");
                if (isEJustPressed === true) {
                    this.onOpenCanyonMap?.();
                }
            } else if (id === "canyon-return") {
                this.onPrompt?.("[E] Return to the Outpost");
                if (isEJustPressed === true) {
                    this.onCanyonReturn?.();
                }
            } else if (id?.startsWith(ARENA_REVIVE_PREFIX)) {
                this.onPrompt?.("[E] Raise your ally");
                if (isEJustPressed === true) {
                    this.onArenaRevive?.(id.slice(ARENA_REVIVE_PREFIX.length));
                }
            } else if (id?.startsWith(EVENT_DOOR_PREFIX)) {
                const event = EVENT_DOORS_BY_ID.get(id.slice(EVENT_DOOR_PREFIX.length));
                if (!event) {
                    this.onPrompt?.("This door is sealed");
                } else {
                    this.onPrompt?.(`[E] ${event.name}  •  ${event.tagline}`);
                    if (isEJustPressed === true) this.onEnterEventRoom?.(event.id);
                }
            } else if (id === EVENT_EXIT_INTERACTION) {
                this.onPrompt?.("[E] Back to the Events Hall");
                if (isEJustPressed === true) this.onLeaveEventRoom?.();
            } else if (id === ARENA_ALTAR_INTERACTION) {
                this.onPrompt?.("[E] Light the candle");
                if (isEJustPressed === true) this.onOpenArena?.();
            } else if (id?.startsWith(DEATH_CRATE_PREFIX)) {
                this.onPrompt?.("[E] Loot the crate");
                if (isEJustPressed === true) {
                    this.onLootCrate?.(id.slice(DEATH_CRATE_PREFIX.length));
                }
            } else if (id === SPAWN_BEACON_INTERACTION) {
                this.onPrompt?.("Your spawn beacon — you respawn here");
            } else if (id?.startsWith(`${STORAGE_INTERACTION}:`)) {
                if (this.isOwnRoom) {
                    this.onPrompt?.("[E] Open storage");
                    if (isEJustPressed === true) {
                        this.onOpenStorage?.(id.slice(STORAGE_INTERACTION.length + 1));
                    }
                } else {
                    this.onPrompt?.("Only the owner can open this crate");
                }
            } else if (id?.startsWith(PAINT_PREFIX)) {
                if (this.canPaintLot) {
                    this.onPrompt?.("[E] Draw on it");
                    if (isEJustPressed === true) {
                        this.onOpenPosterPaint?.(id.slice(PAINT_PREFIX.length));
                    }
                } else {
                    this.onPrompt?.("Only the lot owner can draw here");
                }
            } else if (id?.startsWith("sign-")) {
                const ownerId = nearest.obj.userData.ownerId;
                const hasContent = !!nearest.obj.userData.contentType;
                const isOwner = ownerId === this.localUserId;
                if (isOwner && this.isBlueprintActive) {
                    this.onPrompt?.("[E] Read Sign  •  [RMB] Delete sign forever (no refund)");
                } else {
                    this.onPrompt?.("[E] Read Sign");
                }
                if (isEJustPressed === true) {
                    const signId = id.slice("sign-".length);
                    if (!hasContent && isOwner) {
                        this.onOpenSignEditor?.(signId);
                    } else {
                        this.onOpenSignViewer?.(signId);
                    }
                }
            }
        } else {
            this.onPrompt?.(null);
        }
    }

    dispose() { }
}