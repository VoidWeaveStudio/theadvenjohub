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
import { t } from "@/core/i18n";

const ARENA_REVIVE_PREFIX = "arena-revive:";

interface TokenInfo {
    name: string;
    state?: "loading" | "empty" | "unknown";
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
                this.onPrompt?.(t("g.prompt.inspectFaction", { name: factionName }));
                if (isEJustPressed === true) {
                    this.onOpenFactionBubble?.(factionId);
                }
            } else if (id === "room-console") {
                this.onPrompt?.(t("g.prompt.roomConsole"));
                if (isEJustPressed === true) {
                    this.onOpenRoomConsole?.();
                }
            } else if (id === "room-portal") {
                this.onPrompt?.(t("g.prompt.usePortal"));
                if (isEJustPressed === true) {
                    this.onOpenRoomPortal?.();
                }
            } else if (id === "gate-steward") {
                this.onPrompt?.(t("g.prompt.gateSteward"));
                if (isEJustPressed === true) {
                    this.onOpenGateSteward?.();
                }
            } else if (id?.startsWith("player-bubble-")) {
                const bubbleIndex = Number(id.slice("player-bubble-".length));
                this.onPrompt?.(t("g.prompt.inspectBubble"));
                if (isEJustPressed === true && Number.isFinite(bubbleIndex)) {
                    this.onOpenPlayerBubble?.(bubbleIndex);
                }
            } else if (id?.startsWith("column-")) {
                this.onPrompt?.(t("g.prompt.tokenInfo"));
                if (isEJustPressed === true) {
                    const info = nearest.obj.userData.tokenInfo as TokenInfo | undefined;

                    if (!info || info.state === "loading") {
                        this.onNotification?.(t("g.token.loading"), 2000);
                    } else if (info.state === "empty") {
                        this.onNotification?.(t("g.column.emptyNotice"), 2000);
                    } else {
                        this.onOpenTokenUI?.({
                            ...info,
                            ca: nearest.obj.userData.ca
                        });
                    }
                }
            } else if (id === "tower-crystal") {
                this.onPrompt?.(t("g.prompt.usePortal"));
                if (isEJustPressed === true) {
                    if (this.onCrystalInteract) {
                        this.onCrystalInteract();
                    } else {
                        console.error("❌ [InteractionSystem] onCrystalInteract is UNDEFINED in Game.ts!");
                    }
                }
            } else if (id === "crystal") {
                this.onPrompt?.(t("g.prompt.crystal"));
                if (isEJustPressed === true) {
                    this.onNotification?.(t("g.notify.eventsSoon"), 3000);
                }
            } else if (id === "token-vendor") {
                this.onPrompt?.(t("g.prompt.tokenVendor"));
                if (isEJustPressed === true) {
                    this.onOpenVendor?.();
                }
            } else if (id === "quest-giver-sola") {
                this.onPrompt?.(t("g.prompt.talkSola"));
                if (isEJustPressed === true) {
                    this.onOpenSola?.();
                }
            } else if (id === "faction-broker") {
                this.onPrompt?.(t("g.prompt.talkAlaric"));
                if (isEJustPressed === true) {
                    this.onOpenFactionBroker?.();
                }
            } else if (id === "npc-alfredo") {
                this.onPrompt?.(t("g.prompt.talkAlfredo"));
                if (isEJustPressed === true) {
                    this.onOpenAlfredo?.();
                }
            } else if (id === "canyon-dispatcher") {
                this.onPrompt?.(t("g.prompt.canyonMap"));
                if (isEJustPressed === true) {
                    this.onOpenCanyonMap?.();
                }
            } else if (id === "canyon-return") {
                this.onPrompt?.(t("g.prompt.canyonReturn"));
                if (isEJustPressed === true) {
                    this.onCanyonReturn?.();
                }
            } else if (id?.startsWith(ARENA_REVIVE_PREFIX)) {
                this.onPrompt?.(t("g.prompt.raiseAlly"));
                if (isEJustPressed === true) {
                    this.onArenaRevive?.(id.slice(ARENA_REVIVE_PREFIX.length));
                }
            } else if (id?.startsWith(EVENT_DOOR_PREFIX)) {
                const event = EVENT_DOORS_BY_ID.get(id.slice(EVENT_DOOR_PREFIX.length));
                if (!event) {
                    this.onPrompt?.(t("g.prompt.doorSealed"));
                } else {
                    this.onPrompt?.(`[E] ${t(event.name)}  •  ${t(event.tagline)}`);
                    if (isEJustPressed === true) this.onEnterEventRoom?.(event.id);
                }
            } else if (id === EVENT_EXIT_INTERACTION) {
                this.onPrompt?.(t("g.prompt.eventsExit"));
                if (isEJustPressed === true) this.onLeaveEventRoom?.();
            } else if (id === ARENA_ALTAR_INTERACTION) {
                this.onPrompt?.(t("g.prompt.lightCandle"));
                if (isEJustPressed === true) this.onOpenArena?.();
            } else if (id?.startsWith(DEATH_CRATE_PREFIX)) {
                this.onPrompt?.(t("g.prompt.lootCrate"));
                if (isEJustPressed === true) {
                    this.onLootCrate?.(id.slice(DEATH_CRATE_PREFIX.length));
                }
            } else if (id === SPAWN_BEACON_INTERACTION) {
                this.onPrompt?.(t("g.prompt.spawnBeacon"));
            } else if (id?.startsWith(`${STORAGE_INTERACTION}:`)) {
                if (this.isOwnRoom) {
                    this.onPrompt?.(t("g.prompt.openStorage"));
                    if (isEJustPressed === true) {
                        this.onOpenStorage?.(id.slice(STORAGE_INTERACTION.length + 1));
                    }
                } else {
                    this.onPrompt?.(t("g.prompt.crateOwnerOnly"));
                }
            } else if (id?.startsWith(PAINT_PREFIX)) {
                if (this.canPaintLot) {
                    this.onPrompt?.(t("g.prompt.drawOnIt"));
                    if (isEJustPressed === true) {
                        this.onOpenPosterPaint?.(id.slice(PAINT_PREFIX.length));
                    }
                } else {
                    this.onPrompt?.(t("g.prompt.lotOwnerOnly"));
                }
            } else if (id?.startsWith("sign-")) {
                const ownerId = nearest.obj.userData.ownerId;
                const hasContent = !!nearest.obj.userData.contentType;
                const isOwner = ownerId === this.localUserId;
                if (isOwner && this.isBlueprintActive) {
                    this.onPrompt?.(t("g.prompt.readSignOwner"));
                } else {
                    this.onPrompt?.(t("g.prompt.readSign"));
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