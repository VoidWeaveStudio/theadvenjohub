// src/features/game/core/Game.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CameraController } from "./CameraController";
import { ResourceManager } from "./ResourceManager";
import { NetworkManager, InventoryEntry, FactionGateData, ShardStateData, LeaderboardEntry, FactionSummary, FactionQuestEntry, WorldStatusData, ProgressionStateData, RespawnTarget } from "../network/NetworkManager";
import { BranchId } from "../data/progression";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";
import { SafeZone } from "../world/SafeZone";
import { ShootingSystem } from "../systems/ShootingSystem";
import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { NetworkSystem } from "../systems/NetworkSystem";
import { EnemySystem } from "../systems/EnemySystem";
import { BossProjectiles } from "../entities/bossProjectiles";
import { LootSystem } from "../systems/LootSystem";
import { PetSystem } from "../systems/PetSystem";
import { PetTuner } from "../systems/PetTuner";
import { BuildSystem } from "../systems/BuildSystem";
import { VoiceChatSystem } from "../systems/VoiceChatSystem";
import { EmoteSystem } from "../systems/EmoteSystem";
import { CandleEmoteSystem } from "../systems/CandleEmoteSystem";
import { AbilitySystem } from "../systems/AbilitySystem";
import { weaponTierName } from "../entities/weaponTiers";
import { WeaponTuner } from "../systems/WeaponTuner";
import { MemeSystem, MemeCastEvent } from "../systems/MemeSystem";
import { MEME_ABILITIES_BY_ID } from "../data/progression";
import { disposeEmoteAssets } from "../entities/emoteSprites";
import { disposeSkinTextures } from "../entities/characterSkinTexture";
import { EmoteKey, isBodyEmote } from "../data/emotes";
import { type CompanionId } from "../data/companions";
import { CosmeticId } from "../data/cosmetics";
import { LocationManager } from "../world/LocationManager";
import type { Location } from "../world/Location";
import { withTimeout, waitForFrames } from "../utils/loadGate";
import { MainHall } from "../world/locations/tower/floors/main-hall/MainHall";
import { EventsLobby } from "../world/locations/events/EventsLobby";
import { CandleArena } from "../world/locations/events/rooms/CandleArena";
import {
    EVENTS_LOBBY_ID,
    EVENT_DOORS_BY_ID,
    GRINDER_EVENT_ID,
    GRINDER_LOCATION_ID,
    GRINDER_NAME,
    ResolvedEvent,
    eventWindow,
    isEventLive,
} from "../data/eventDoors";
import { fetchEvents } from "../data/eventClient";
import { DefusalViewModel } from "../entities/DefusalViewModel";
import { GrenadeSystem } from "../systems/GrenadeSystem";
import { ARSENAL_BY_ID } from "../data/defusalArsenal";
import { Basement } from "../world/locations/tower/floors/basement/Basement";
import { FactionGateRoom } from "../world/locations/tower/floors/FactionGateRoom";
import { PersonalRoom } from "../world/locations/tower/floors/PersonalRoom";
import { MainWorld } from "../world/locations/main-world/MainWorld";
import { computeDayTime, DayNightConfig } from "../utils/dayNightCycle";
import { applyLocationMovementConfig, configureLocationSpecifics, syncMainWorldEntry } from "./GameLocationTransition";
import { registerNetworkHandlers } from "./GameNetworkHandlers";
import type { GameCallbacks } from "./GameCallbacks";
import { ViewModelTuner } from "../systems/ViewModelTuner";
import { createGameRenderer } from "./GameRenderer";
import { perf } from "./PerfProfiler";
import { updateDamageIndicator } from "./GameDamageIndicator";
import { restoreToSavedProgress, waitForProgressRestore, teleportToSafeZone, beginTeleportGrace, enforcePlayerBounds } from "./GameLocationOrchestration";
import { BuildSession } from "../world/building/BuildSession";
import { SoundManager } from "./SoundManager";
import { QuestMarkerKind, createQuestMarker, animateQuestMarker, disposeQuestMarker } from "../entities/questMarker";
import { t } from "@/core/i18n";

export interface GameSession {
    gameToken: string;
    serverUrl: string;
    userId: string;
    wallet: string;
}

const FACTION_VIEW_REFRESH_COOLDOWN_MS = 4000;
const ASSET_STAGE_END = 0.4;
const CONNECT_TIMEOUT_MS = 8000;
const LOCATION_READY_TIMEOUT_MS = 10000;
const ABILITY_CAST_HEIGHT = 1.5;
const ABILITY_AIM_RANGE = 85;
const PROGRAM_READY_POLL_MS = 10;
const EVENT_STATE_POLL_SECONDS = 30;

interface CompilingProgram {
    isReady(): boolean;
}

export interface HUDState {
    health: number;
    maxHealth: number;
    ammo: number;
    maxAmmo: number;
    reserve: number;
    online: number;
    inSafeZone: boolean;
    prompt: string | null;
    isReloading: boolean;
    reloadProgress: number;
    isWeaponEquipped: boolean;
    equippedTool: "weapon" | "blueprint" | null;
    weaponName: string;
    weaponKind: "rifle" | "staff";
    fireMode: string;
    chargeProgress: number;
    tunerReadout: string | null;
    inkDarkness: number;
}

export interface DamageEvent {
    id: number;
    direction: number;
    damage: number;
    timestamp: number;
}

export class Game {
    private hitMarkTrigger: number = 0;
    private canvas: HTMLCanvasElement;
    public readonly slug: string;
    private renderer: THREE.WebGLRenderer;
    private timer: THREE.Timer;
    public session: GameSession;

    private inputManager: InputManager;
    public readonly cameraController: CameraController;
    public readonly resourceManager: ResourceManager;
    public readonly networkManager: NetworkManager;

    public readonly player: Player;
    public readonly otherPlayers: Map<string, OtherPlayer> = new Map();
    public readonly safeZone: SafeZone;

    public readonly shootingSystem: ShootingSystem;
    private safeZoneSystem: SafeZoneSystem;
    public readonly emoteSystem: EmoteSystem = new EmoteSystem();
    public readonly candleSystem: CandleEmoteSystem = new CandleEmoteSystem();
    public readonly abilitySystem: AbilitySystem = new AbilitySystem();
    public readonly weaponTuner: WeaponTuner = new WeaponTuner();
    public readonly viewModelTuner: ViewModelTuner = new ViewModelTuner();
    public readonly memeSystem: MemeSystem = new MemeSystem();
    private memeMovementUntil: number = 0;
    public readonly interactionSystem: InteractionSystem;
    private readonly questMarkers = new Map<string, THREE.Sprite>();
    private questMarkerRequest: Record<string, QuestMarkerKind> = {};
    private questMarkerTime = 0;
    private networkSystem: NetworkSystem;
    public readonly enemySystem: EnemySystem;
    public readonly bossProjectiles = new BossProjectiles();

    private readonly listenerForward = new THREE.Vector3();

    private updateAudioListener() {
        const camera = this.cameraController.camera;
        camera.getWorldDirection(this.listenerForward);

        const position = this.player.mesh.position;
        SoundManager.getInstance().setListener(
            position.x,
            position.z,
            this.listenerForward.x,
            this.listenerForward.z
        );
    }

    public readonly getGroundHeight = (x: number, z: number) => {
        const currentLoc = this.locationManager.getCurrentLocation();
        return currentLoc?.terrain?.getHeightAt(x, z) ?? 0;
    };
    public readonly lootSystem: LootSystem;
    public readonly petSystem: PetSystem;
    public readonly petTuner: PetTuner;
    public readonly buildSystem: BuildSystem;
    public readonly buildSession: BuildSession;
    public readonly voiceChat: VoiceChatSystem;
    public readonly locationManager: LocationManager;
    public inventory: InventoryEntry[] = [];
    public accountCount: number = 0;
    public gateFactionIds: string[] = [];
    public factionGates: FactionGateData[] = [];
    public caveBossDefeated: boolean = false;
    public worldStatus: WorldStatusData | null = null;
    public leaderboard: LeaderboardEntry[] = [];
    public factionLeaderboard: FactionSummary[] = [];
    public factionQuests: FactionQuestEntry[] = [];
    private lastFactionViewRefresh = 0;
    private pendingOwnFactionRefresh = false;
    public myNickname: string = "";
    public shardState: ShardStateData | null = null;
    private ownBubbleIndex: number | null = null;
    private bubbleWaypointIndex: number | null = null;
    private spawnBesideOwnBubble: boolean = false;
    public ash: number = 0;
    public placeables: Record<string, number> = {};
    private pendingSignSave: { signId: string; resolve: () => void; reject: (err: Error) => void } | null = null;

    public spawnProtectionUntil: number = 0;
    private lastProtectionSecond: number = -1;
    public isDead: boolean = false;
    public killerName: string | null = null;

    public damageAttackerId: string | null = null;
    public lastDamageTime: number = 0;
    public readonly DAMAGE_INDICATOR_DURATION = 2000;

    private isLoaded: boolean = false;
    private animationFrameId: number | null = null;
    private frameCount: number = 0;
    private frameCapMs = 0;
    private lastFrameAt = 0;
    private disposed: boolean = false;
    public isChangingLocation: boolean = false;
    public correctionGraceUntil: number = 0;

    private showFloorSelector: boolean = false;
    public localPlayerNetId: string | null = null;
    public partyMemberIds: Set<string> = new Set();
    public progression: ProgressionStateData | null = null;
    public dayNightConfig: DayNightConfig | null = null;
    public hasRestoredLocation: boolean = false;
    public restoreResolver: (() => void) | null = null;
    public restoreTimeoutId: ReturnType<typeof setTimeout> | null = null;

    public readonly hudState: HUDState = {
        health: 100,
        maxHealth: 100,
        ammo: 30,
        maxAmmo: 30,
        reserve: 0,
        online: 1,
        inSafeZone: true,
        prompt: null,
        isReloading: false,
        reloadProgress: 0,
        isWeaponEquipped: true,
        equippedTool: "weapon",
        weaponName: "g.weapontier.1.rifle",
        weaponKind: "rifle",
        fireMode: "Single",
        chargeProgress: 0,
        tunerReadout: null,
        inkDarkness: 0,
    };

    private lastStateEmit: number = 0;
    private stateEmitInterval: number = 100;

    public openFloorSelector() {
        this.showFloorSelector = true;
        this.onFloorSelectorToggle?.(true);
    }

    public closeFloorSelector() {
        this.showFloorSelector = false;
        this.onFloorSelectorToggle?.(false);
    }

    public async selectFloor(floorId: string) {
        this.closeFloorSelector();
        await this.changeLocation(floorId).catch(() => {
            this.onNotification?.("⚠️ Failed to travel to this floor", 2000);
        });
    }

    public async enterEventsLocation(factionId: string, factionName: string) {
        this.closeFloorSelector();
        await this.changeLocation(EVENTS_LOBBY_ID, { factionId, factionName }).catch(() => {
            this.onNotification?.("⚠️ Failed to travel to Events", 2000);
        });
    }

    public dust2Mode = false;
    public eventStates: ResolvedEvent[] = [];
    private eventStateTimer = 0;

    private updateEventStates(delta: number, location: Location) {
        if (!(location instanceof EventsLobby)) {
            this.eventStateTimer = 0;
            return;
        }

        this.eventStateTimer -= delta;
        if (this.eventStateTimer > 0) return;

        this.eventStateTimer = EVENT_STATE_POLL_SECONDS;
        this.refreshEventStates();
    }

    public async refreshEventStates() {
        this.eventStates = await fetchEvents(this.slug);
        if (this.disposed) return;

        const lobby = this.locationManager.getCurrentLocation();
        if (lobby instanceof EventsLobby) lobby.applyEventStates(this.eventStates);
        this.onEventStates?.(this.eventStates);
    }

    public isEventOpen(eventId: string): boolean {
        const state = this.eventStates.find((event) => event.id === eventId);
        if (state) return isEventLive(state);
        return EVENT_DOORS_BY_ID.get(eventId)?.live ?? false;
    }

    public async enterEventRoom(eventId: string) {
        const event = EVENT_DOORS_BY_ID.get(eventId);
        if (!event) return;

        if (!this.isEventOpen(eventId)) {
            const state = this.eventStates.find((entry) => entry.id === eventId);
            const name = state?.title ?? event.name;

            if (state?.enabled) {
                const window = eventWindow(state);
                this.onNotification?.(
                    window.state === "upcoming" ? `⏳ ${name} has not opened yet` : `⏳ ${name} is over for now`,
                    2500
                );
            } else {
                this.onNotification?.(`🔒 ${name} is sealed`, 2500);
            }
            return;
        }

        await this.changeLocation(event.locationId, { silent: true }).then(() => {
            this.onNotification?.(`${event.glyph} ${event.name}`, 2500);
        }).catch(() => {
            this.onNotification?.("⚠️ That door would not open", 2000);
        });
    }


    public togglePetTuner() {
        if (!this.petTuner.isReady()) {
            this.onNotification?.("🐕 No pet out to tune", 2000);
            return;
        }
        this.petTuner.toggle();
    }

    public toggleWeaponTuner() {
        if (this.dust2Mode && this.viewModelTuner.isReady()) {
            this.viewModelTuner.toggle();
            return;
        }
        this.weaponTuner.toggle();
    }

    public async enterGrinder() {
        if (!this.isEventOpen(GRINDER_EVENT_ID)) {
            this.onNotification?.("🔒 Dust II is sealed", 2500);
            return;
        }

        await this.changeLocation(GRINDER_LOCATION_ID, { silent: true }).then(() => {
            this.setWeaponEquipped(true);
            this.onNotification?.(`🩸 ${GRINDER_NAME}`, 2500);
        }).catch(() => {
            this.onNotification?.("⚠️ That door would not open", 2000);
        });
    }

    public async leaveEventRoom() {
        await this.changeLocation(EVENTS_LOBBY_ID, { silent: true }).then(() => {
            this.onNotification?.("📍 Events Hall", 2000);
        }).catch(() => {
            this.onNotification?.("⚠️ Failed to return to the hall", 2000);
        });
    }

    public async teleportToFactionGate(faction: { id: string; name: string; symbol: string | null; image: string | null }) {
        await this.changeLocation(`faction-gate-${faction.id}`, {
            factionId: faction.id,
            factionName: faction.name,
            factionSymbol: faction.symbol,
            factionImage: faction.image,
        }).catch(() => {
            this.onNotification?.("⚠️ Failed to teleport to this gate", 2000);
        });
    }

    public canOpenBuildEditor(): boolean {
        return this.buildSession.canOpenEditor();
    }

    public openBuildEditor(): boolean {
        const location = this.locationManager.getCurrentLocation();
        if (!location) return false;
        if (!this.buildSession.enter(location.scene)) {
            this.onNotification?.("🔒 Only the lot owner can build here", 2500);
            return false;
        }

        this.inputManager.setEnabled(false);
        this.locationManager.setActiveCamera(this.buildSession.editor.camera.camera);
        this.buildSession.editor.camera.setAspect(this.getViewportAspect());
        return true;
    }

    public closeBuildEditor() {
        if (!this.buildSession.editor.active) return;
        this.buildSession.exit();
        this.locationManager.setActiveCamera(null);
        this.inputManager.setEnabled(true);
    }

    private getViewportAspect(): number {
        const container = this.canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        return width / Math.max(1, height);
    }

    public async teleportToPersonalRoom(ownerUserId?: string) {
        await this.changeLocation(`player-room-${ownerUserId ?? this.session.userId}`).catch(() => {
            this.onNotification?.("⚠️ Failed to open that room", 2000);
        });
    }

    public switchShard(instance: number) {
        const location = this.locationManager.getCurrentLocation();
        if (!location) return;
        this.networkManager.sendLocationChange(location.id, instance);
    }

    public setBubbleWaypoint(index: number | null) {
        this.bubbleWaypointIndex = index;
        const location = this.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.setWaypointIndex(index);
        }
    }

    public getBubbleWaypoint(): number | null {
        return this.bubbleWaypointIndex;
    }

    public setOwnBubbleIndex(index: number | null) {
        this.ownBubbleIndex = index;
        const location = this.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.setOwnBubbleIndex(index);
        }
    }

    public applyGalaxySpawn(location: Basement) {
        location.setOwnBubbleIndex(this.ownBubbleIndex);

        if (!this.spawnBesideOwnBubble || this.ownBubbleIndex === null) return;
        this.spawnBesideOwnBubble = false;

        const target = new THREE.Vector3();
        location.getBubbleWorldPosition(this.ownBubbleIndex, target);
        target.y += 4;
        target.z += 22;

        this.player.teleportTo(target);
        this.cameraController.yawObject.position.copy(target);
        this.networkManager.sendPlayerUpdate({
            position: target.toArray(),
            rotation: this.player.mesh.rotation.y,
            pitch: this.cameraController.getPitch(),
            state: 'idle',
            jumping: false,
            velocityY: 0,
            weaponEquipped: false,
            isShooting: false,
        });
    }

    public getPlayerGroundPosition(): { x: number; z: number } {
        return { x: this.player.mesh.position.x, z: this.player.mesh.position.z };
    }

    public async returnToGalaxy(nearOwnBubble: boolean) {
        this.spawnBesideOwnBubble = nearOwnBubble && this.ownBubbleIndex !== null;
        await this.changeLocation('tower-basement').catch(() => {
            this.spawnBesideOwnBubble = false;
            this.onNotification?.("⚠️ Failed to reach Token Gates", 2000);
        });
    }

    public notifyGatePurchased(faction: { id: string; name: string; symbol: string | null; image: string | null; tokenCa: string | null }) {
        const location = this.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.addLocalGate({
                factionId: faction.id,
                factionName: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                tokenCa: faction.tokenCa,
            });
        }
    }

    constructor(canvas: HTMLCanvasElement, slug: string, session: GameSession) {
        this.canvas = canvas;
        this.slug = slug;
        this.session = session;

        const container = canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;

        this.renderer = createGameRenderer(canvas, width, height);
        perf.attach(this.renderer);
        perf.registerToggle("fpsCap", (value) => this.setFrameCap(Number(value)));

        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        this.timer = new THREE.Timer();
        this.inputManager = new InputManager(canvas);
        this.cameraController = new CameraController();
        this.resourceManager = ResourceManager.getInstance();
        this.networkManager = new NetworkManager();
        this.locationManager = new LocationManager(this.renderer, this.cameraController.camera);
        this.player = new Player();
        this.safeZone = new SafeZone();
        this.shootingSystem = new ShootingSystem();
        this.safeZoneSystem = new SafeZoneSystem();
        this.interactionSystem = new InteractionSystem();
        this.networkSystem = new NetworkSystem(this.networkManager);
        this.enemySystem = new EnemySystem();
        this.lootSystem = new LootSystem();
        this.petSystem = new PetSystem();
        this.petTuner = new PetTuner();
        this.buildSystem = new BuildSystem();
        this.buildSession = new BuildSession(width / height, this.networkManager, slug);
        this.buildSession.attach(canvas);
        this.voiceChat = new VoiceChatSystem();
    }


    async init() {
        this.setLoadingStage("Initializing core assets...", 0);

        SoundManager.getInstance().loadCritical().then(() => {
            SoundManager.getInstance().loadLazy();
        });

        this.resourceManager.onProgress = (progress, message) => {
            this.setLoadingStage(message, (progress / 100) * ASSET_STAGE_END);
        };

        const criticalResult = await perf.measureAsync("resourceManager.loadCritical", () =>
            this.resourceManager.loadCritical()
        );
        perf.flushLoad("critical assets");

        if (!criticalResult.success) {
            this.onLoadStateChange?.(false);
            throw new Error("assets_load_failed");
        }

        if (criticalResult.failed.length > 0) {
            this.onNotification?.("⚠️ Some assets failed to load, retrying in background...", 3000);
        }

        requestAnimationFrame(async () => {
            if (this.disposed) return;
            try {
                this.setLoadingStage("Building the tower...", ASSET_STAGE_END);

                this.locationManager.registerLocations(this.resourceManager);
                const currentLocation = await this.locationManager.loadLocation("tower-main-hall");
                if (this.disposed) return;

                if (!currentLocation) {
                    throw new Error("Failed to load tower-main-hall location");
                }

                this.locationManager.onLocationChange = (id: string) => {
                    this.onNotification?.(` Entered: ${id}`, 2000);
                    this.interactionSystem.isOwnRoom = id === `player-room-${this.session.userId}`;
                    this.onLocationChange?.(id);
                    const loc = this.locationManager.getCurrentLocation();
                    if (loc) {
                        loc.onOpenFloorSelector = () => {
                            this.openFloorSelector();
                        };
                    }
                };

                this.onLocationChange?.(currentLocation.id);

                this.player.create(currentLocation.scene, this.resourceManager);
                this.player.setDependencies(this.inputManager, this.cameraController);

                const spawnPoint = currentLocation.getSpawnPoint();
                this.player.mesh.position.copy(spawnPoint);

                applyLocationMovementConfig(this, currentLocation);

                currentLocation.scene.add(this.cameraController.yawObject);
                this.cameraController.setTarget(this.player.mesh);

                configureLocationSpecifics(this, currentLocation);

                this.shootingSystem.init(
                    currentLocation.scene,
                    this.player,
                    this.inputManager,
                    this.cameraController,
                    this.resourceManager,
                    this.networkManager,
                    this.otherPlayers,
                    currentLocation,
                    currentLocation.collisionGrid
                );
                this.shootingSystem.onHitPlayer = () => {
                    this.hitMarkTrigger = Date.now();
                    this.onHitMark?.();
                };

                const getGroundHeight = this.getGroundHeight;
                this.bossProjectiles.setScene(currentLocation.scene);

                this.enemySystem.init(currentLocation.scene, this.networkManager, getGroundHeight);
                this.abilitySystem.attach(currentLocation.scene);
                this.memeSystem.attach(currentLocation.scene);
                this.weaponTuner.init(this.inputManager, this.player.getWeapon());
                this.weaponTuner.onReadout = (text) => {
                    this.hudState.tunerReadout = text;
                    this.emitState(true);
                };
                this.viewModelTuner.onReadout = (text) => {
                    this.hudState.tunerReadout = text;
                    this.emitState(true);
                };
                this.lootSystem.init(currentLocation.scene, this.networkManager, this.player, getGroundHeight, this.interactionSystem);
                this.petSystem.init(this.networkManager, this.player, getGroundHeight, () => this.lootSystem.getFetchableDrops());
                this.petTuner.init(this.inputManager, this.petSystem);
                this.petTuner.onReadout = (text) => {
                    this.hudState.tunerReadout = text;
                    this.emitState(true);
                };
                this.petSystem.setScene(currentLocation.scene);
                this.petSystem.setLocation(currentLocation.id);
                this.buildSystem.init(currentLocation.scene, currentLocation.id, this.networkManager, this.player, this.inputManager, getGroundHeight, this.interactionSystem, this.session.userId);
                this.shootingSystem.onShotFired = () => this.notifyLocalShot();
                this.buildSystem.onNotification = (msg, duration) => {
                    this.onNotification?.(msg, duration);
                };

                this.buildSession.onNotification = (msg, duration) => {
                    this.onNotification?.(msg, duration);
                };
                this.buildSession.onStateChange = (state) => {
                    this.interactionSystem.canPaintLot = state.canEdit;
                    this.onBuildEditorState?.(state);
                };
                this.interactionSystem.onOpenPosterPaint = (pieceKey) => {
                    this.onOpenPosterPaintUI?.(pieceKey);
                };
                this.interactionSystem.onOpenStorage = (pieceKey) => {
                    this.networkManager.sendStorageOpen(pieceKey);
                };
                this.interactionSystem.onLootCrate = (crateId) => {
                    this.networkManager.sendCrateLoot(crateId);
                };
                this.interactionSystem.onOpenArena = () => {
                    this.onOpenArenaUI?.();
                };
                this.interactionSystem.onEnterEventRoom = (eventId) => {
                    this.onOpenEventDoorUI?.(eventId);
                };
                this.interactionSystem.onLeaveEventRoom = () => {
                    this.leaveEventRoom();
                };
                this.interactionSystem.onArenaRevive = (targetId) => {
                    this.networkManager.sendArenaRevive(targetId);
                };
                this.buildSession.onRequestExit = () => {
                    this.closeBuildEditor();
                };
                this.networkManager.onRoomBuildOp = (op) => {
                    this.buildSession.applyRemoteOp(op);
                };

                this.shootingSystem.prewarm();
                await this.lootSystem.prewarm();
                if (this.disposed) return;
                this.renderer.compile(currentLocation.scene, this.cameraController.camera);
                this.shootingSystem.endPrewarm();
                this.lootSystem.endPrewarm();

                this.enemySystem.onEnemySpawn = (id, hitbox) => {
                    this.shootingSystem.registerEnemyHitbox(id, hitbox);
                };

                this.enemySystem.onEnemyDespawn = (id) => {
                    this.shootingSystem.unregisterEnemyHitbox(id);
                };

                this.enemySystem.onEnemyEliminated = (killerId) => {
                    if (killerId === this.localPlayerNetId) {
                        this.onNotification?.("🎯 Enemy eliminated!", 2000);
                    }
                };

                this.safeZoneSystem.init(this.safeZone);
                this.interactionSystem.init(currentLocation.scene, this.player, this.inputManager, this.safeZone);
                this.networkSystem.init();

                currentLocation.getInteractables().forEach(obj => {
                    this.interactionSystem.registerInteractable(obj);
                });

                this.interactionSystem.onNotification = (msg, duration) => {
                    this.onNotification?.(msg, duration);
                };
                this.interactionSystem.onPrompt = (text) => {
                    this.hudState.prompt = text;
                    this.emitState(true);
                };

                this.interactionSystem.onCrystalInteract = () => {
                    const currentLoc = this.locationManager.getCurrentLocation();
                    if (currentLoc?.id === 'tower-main-hall') {
                        this.openFloorSelector();
                    } else {
                        this.changeLocation('tower-main-hall').catch(() => {
                            this.onNotification?.("⚠️ Failed to travel", 2000);
                        });
                    }
                };

                this.interactionSystem.onOpenTokenUI = (tokenData) => {
                    this.onOpenTokenUI?.(tokenData);
                };

                this.interactionSystem.onOpenVendor = () => {
                    this.networkManager.sendNpcVisit("token-vendor");
                    this.onOpenVendorUI?.();
                };

                this.interactionSystem.onOpenSola = () => {
                    this.onOpenSolaUI?.();
                };

                this.interactionSystem.onOpenCanyonMap = () => {
                    this.networkManager.sendNpcVisit("canyon-dispatcher");
                    this.onOpenCanyonMapUI?.();
                };

                this.interactionSystem.onOpenFactionBroker = () => {
                    this.networkManager.sendNpcVisit("faction-broker");
                    this.onOpenFactionBrokerUI?.();
                };

                this.interactionSystem.onOpenAlfredo = () => {
                    this.networkManager.sendNpcVisit("npc-alfredo");
                    this.onOpenAlfredoUI?.();
                };

                this.interactionSystem.onOpenGateSteward = () => {
                    this.networkManager.sendNpcVisit("gate-steward");
                    this.onOpenGateStewardUI?.();
                };

                this.interactionSystem.onOpenPlayerBubble = (bubbleIndex) => {
                    this.onOpenPlayerBubbleUI?.(bubbleIndex);
                };

                this.interactionSystem.onOpenFactionBubble = (factionId) => {
                    this.onOpenFactionBubbleUI?.(factionId);
                };

                this.interactionSystem.onOpenRoomPortal = () => {
                    this.onOpenRoomPortalUI?.();
                };

                this.interactionSystem.onOpenRoomConsole = () => {
                    const location = this.locationManager.getCurrentLocation();
                    const factionId = location instanceof FactionGateRoom ? location.factionId : null;
                    this.onOpenRoomConsoleUI?.(factionId);
                };

                this.interactionSystem.localUserId = this.session.userId;
                this.interactionSystem.onOpenSignEditor = (signId) => {
                    this.onOpenSignEditorUI?.(signId);
                };
                this.interactionSystem.onOpenSignViewer = (signId) => {
                    const sign = this.buildSystem.getSign(signId);
                    if (sign) {
                        this.onOpenSignViewerUI?.({
                            id: sign.id,
                            ownerNickname: sign.ownerNickname,
                            contentType: sign.contentType,
                            textContent: sign.textContent,
                            drawingUrl: sign.drawingUrl,
                        });
                    }
                };
                this.networkManager.onSignState = (signs) => {
                    this.buildSystem.handleSignState(signs);
                };
                this.networkManager.onSignSpawn = (sign) => {
                    this.buildSystem.handleSignSpawn(sign);
                };
                this.networkManager.onSignContentSet = (data) => {
                    this.buildSystem.handleSignContentSet(data);
                    this.resolvePendingSignSave(data.id);
                };
                this.networkManager.onSignDespawn = (id) => {
                    this.buildSystem.handleSignDespawn(id);
                };

                this.interactionSystem.onCanyonReturn = () => {
                    this.networkManager.sendCanyonReturnToHub();
                };

                this.voiceChat.onCapturingChange = (capturing) => {
                    this.onVoiceCapturingChange?.(capturing);
                };
                this.voiceChat.onError = (message) => {
                    this.onNotification?.(`🎤 ${message}`, 3000);
                };
                this.voiceChat.sendOffer = (targetId, sdp) => {
                    this.networkManager.sendVoiceOffer(targetId, sdp);
                };
                this.voiceChat.sendAnswer = (targetId, sdp) => {
                    this.networkManager.sendVoiceAnswer(targetId, sdp);
                };
                this.voiceChat.sendIceCandidate = (targetId, candidate) => {
                    this.networkManager.sendVoiceIceCandidate(targetId, candidate);
                };

                this.interactionSystem.onEnterLocation = async (locationId: string) => {
                    this.closeFloorSelector();
                    await this.changeLocation(locationId).catch(() => {
                        this.onNotification?.("⚠️ Failed to travel", 2000);
                    });
                };

                if (this.disposed) return;
                this.setupNetwork();

                this.setLoadingStage("Connecting to the server...", 0.55);
                await withTimeout(this.networkManager.whenAuthenticated(), CONNECT_TIMEOUT_MS);
                if (this.disposed) return;

                this.setLoadingStage("Restoring your last position...", 0.65);
                await this.waitForProgressRestore();
                if (this.disposed) return;

                this.isLoaded = true;

                const hall = this.locationManager.getCurrentLocation();
                if (hall instanceof MainHall) hall.onRequestBoardData?.();

                this.setLoadingStage("Compiling shaders...", 0.75);
                if (hall) await this.compileScene(hall);
                if (this.disposed) return;

                if (hall) await this.awaitLocationReady(hall, 0.85);
                if (this.disposed) return;

                this.setLoadingStage("Entering the tower...", 1);
                this.onLoadStateChange?.(false);
                this.emitState(true);

                this.resourceManager.loadLazy();
            } catch (error) {
                console.error("Failed to initialize game world:", error);
                this.onLoadStateChange?.(false);
                this.onNotification?.("❌ Failed to load world", 3000);
            }
        });

        this.animate();

        window.addEventListener("resize", this.handleResize);
        window.addEventListener("orientationchange", this.handleResize);
    }

    public async changeLocation(
        targetLocationId: string,
        options?: {
            position?: number[]; rotation?: number; silent?: boolean; factionId?: string; factionName?: string;
            factionSymbol?: string | null; factionImage?: string | null;
        }
    ) {
        if (this.isChangingLocation) return;
        this.isChangingLocation = true;
        this.closeBuildEditor();

        try {
            this.setLoadingStage("Traveling to a new location...", 0.05);

            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (this.disposed) return;

            const previousLocation = this.locationManager.getCurrentLocation();
            if (!previousLocation || previousLocation.id === targetLocationId) {
                this.onLoadStateChange?.(false);
                return;
            }

            this.enemySystem.clear();
            this.lootSystem.clear();
            this.petSystem.clear();
            this.buildSystem.clear();

            this.setLoadingStage("Building the location...", 0.2);
            const newLocation = await this.locationManager.loadLocation(targetLocationId);
            if (this.disposed) return;
            if (!newLocation || newLocation === previousLocation) {
                this.onLoadStateChange?.(false);
                return;
            }

            this.networkManager.sendLocationChange(newLocation.id);
            this.shootingSystem.clearAllEffects();

            previousLocation.scene.remove(this.player.mesh);
            newLocation.scene.add(this.player.mesh);
            this.player.moveEffectsToScene(newLocation.scene);

            previousLocation.scene.remove(this.cameraController.yawObject);
            newLocation.scene.add(this.cameraController.yawObject);

     
            this.emoteSystem.clear();
            this.candleSystem.clear();
            this.abilitySystem.clear();
            this.memeSystem.clear();
            this.player.clearMemeMovement();
            this.player.clearSlow();
            this.memeMovementUntil = 0;
            this.player.setMovementLocked(false);
            this.otherPlayers.forEach((op) => {
                if (!op.isHidden()) {
                    previousLocation.scene.remove(op.mesh);
                    previousLocation.scene.remove(op.getHitbox());
                    this.shootingSystem.unregisterOtherPlayer(op.id);
                    op.setHidden(true);
                }
            });
            this.syncNearbyPeers();

            this.locationManager.evictLocation(previousLocation.id);

            this.shootingSystem.setScene(newLocation.scene);
            this.interactionSystem.setScene(newLocation.scene);
            this.interactionSystem.clearInteractables();
            this.questMarkers.clear();
            this.enemySystem.setScene(newLocation.scene);
            this.abilitySystem.attach(newLocation.scene);
            this.memeSystem.attach(newLocation.scene);
            this.bossProjectiles.setScene(newLocation.scene);
            this.grenadeSystem.setScene(newLocation.scene);
            this.lootSystem.setScene(newLocation.scene);
            this.petSystem.setScene(newLocation.scene);
            this.petSystem.setLocation(newLocation.id);
            this.buildSystem.setScene(newLocation.scene, newLocation.id);

            this.player.footstepSurface = newLocation.id === "cave" ? "stone" : "soft";
            SoundManager.getInstance().play("portal-enter", { volume: 0.7 });

            this.setLoadingStage("Compiling shaders...", 0.5);
            this.shootingSystem.prewarm();
            await this.lootSystem.prewarm();
            if (this.disposed) return;
            await this.compileScene(newLocation);
            if (this.disposed) return;
            this.shootingSystem.endPrewarm();
            this.lootSystem.endPrewarm();

            const newLocationInteractables = newLocation.getInteractables();
            newLocationInteractables.forEach(obj => {
                this.interactionSystem.registerInteractable(obj);
            });
            this.applyQuestMarkers();

            applyLocationMovementConfig(this, newLocation);
            configureLocationSpecifics(this, newLocation);

            if (newLocation.id !== 'main-world' && !this.isOwnFactionRoom(newLocation) && this.hudState.equippedTool === 'blueprint') {
                this.setBlueprintEquipped(false);
            }

            let spawnPoint = newLocation.getSpawnPoint();
            if (options?.position) {
                const requested = new THREE.Vector3(options.position[0], options.position[1], options.position[2]);
                const limit = newLocation.maxPlayerRadius ?? 9999;
                if (Math.hypot(requested.x, requested.z) <= limit) {
                    spawnPoint = requested;
                }
            }
            this.player.teleportTo(spawnPoint);
            this.cameraController.resetVerticalSmoothing();
            this.cameraController.yawObject.position.copy(spawnPoint);
            beginTeleportGrace(this);
            if (options?.rotation !== undefined) {
                this.player.mesh.rotation.y = options.rotation;
            }

            if (newLocation instanceof PersonalRoom) {
                newLocation.setOwnerName(this.myNickname ? `${this.myNickname}'s Lot` : "Your Lot");
                this.buildSession.bindLot(newLocation.plot, {
                    ownerType: "personal",
                    ownerId: newLocation.ownerUserId,
                });
            } else if (newLocation instanceof FactionGateRoom) {
                this.buildSession.bindLot(newLocation.plot, {
                    ownerType: "faction",
                    ownerId: newLocation.factionId,
                });
            } else {
                this.buildSession.unbindLot();
            }

            if (newLocation instanceof EventsLobby) {
                newLocation.setFactionContext(options?.factionId ?? "", options?.factionName ?? "");
            }

            if (newLocation instanceof FactionGateRoom) {
               if (options?.factionName !== undefined) {
                    newLocation.setFactionInfo(options.factionName, options.factionImage ?? null, options.factionSymbol ?? null);
                } else {
                    const info = previousLocation instanceof Basement
                        ? previousLocation.getFactionGateInfo(newLocation.factionId)
                        : undefined;
                    newLocation.setFactionInfo(info?.factionName ?? "Faction", info?.image ?? null, info?.symbol ?? null);
                }
            }

            if (!options?.silent) {
                const where = t(newLocation.name);
                this.onNotification?.(
                    options?.factionName
                        ? t("g.notify.teleportedAs", { place: where, faction: options.factionName })
                        : t("g.notify.teleported", { place: where }),
                    2000
                );
            }
            this.onLocationChange?.(newLocation.id);

            if (newLocation instanceof MainWorld) {
                await syncMainWorldEntry(this, newLocation);
                if (this.disposed) return;
            }

            await this.awaitLocationReady(newLocation, 0.8);
            if (this.disposed) return;

            this.setLoadingStage("Entering the location...", 1);
        } catch (error) {
            console.error(`Failed to enter ${targetLocationId}:`, error);
            this.onNotification?.("⚠️ Failed to load the location", 3000);
        } finally {
            beginTeleportGrace(this);
            this.isChangingLocation = false;
            if (!this.disposed) this.onLoadStateChange?.(false);
        }
    }

    public async restoreToSavedProgress() {
        return restoreToSavedProgress(this);
    }

    private waitForProgressRestore(timeoutMs = 6000): Promise<void> {
        return waitForProgressRestore(this, timeoutMs);
    }

    private setLoadingStage(message: string, progress: number) {
        this.onLoadStateChange?.(true, message, Math.max(0, Math.min(1, progress)));
    }

    private async compileScene(location: Location) {
        if (this.disposed) return;

        this.renderer.compile(location.scene, this.cameraController.camera);
        await this.waitForProgramsReady(LOCATION_READY_TIMEOUT_MS);
    }

    private waitForProgramsReady(timeoutMs: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const deadline = performance.now() + timeoutMs;

            const poll = () => {
                const programs = this.renderer.info.programs as unknown as CompilingProgram[] | null;

                if (this.disposed || !programs || performance.now() >= deadline) {
                    resolve();
                    return;
                }

                if (programs.every((program) => program.isReady())) {
                    resolve();
                    return;
                }

                setTimeout(poll, PROGRAM_READY_POLL_MS);
            };

            poll();
        });
    }

    private async awaitLocationReady(location: Location, startProgress: number) {
        this.setLoadingStage("Syncing location data...", startProgress);
        this.player.setMovementLocked(true);

        try {
            await withTimeout(
                Promise.all([location.whenReady?.(), this.buildSession.whenLotReady()]),
                LOCATION_READY_TIMEOUT_MS
            );
            if (this.disposed) return;

            this.setLoadingStage("Almost there...", 0.97);
            await withTimeout(waitForFrames(2), 3000);
        } finally {
            this.player.setMovementLocked(false);
            this.networkManager.sendClientReady();
        }
    }

    private setupNetwork() {
        registerNetworkHandlers(this);
    }

    public syncNearbyPeers() {
        const nearbyIds = new Set<string>();
        this.otherPlayers.forEach((op, id) => {
            if (!op.isHidden()) nearbyIds.add(id);
        });
        this.voiceChat.syncPeers(nearbyIds);
    }

    public emitState(force: boolean = false) {
        const now = performance.now();
        if (!force && now - this.lastStateEmit < this.stateEmitInterval) return;
        this.lastStateEmit = now;
        const ammoState = this.shootingSystem.getAmmoState();
        this.hudState.health = this.player.health;
        this.hudState.maxHealth = this.player.maxHealth;
        this.hudState.ammo = ammoState.ammo;
        this.hudState.maxAmmo = ammoState.maxAmmo;
        this.hudState.reserve = ammoState.reserve;
        this.hudState.isReloading = ammoState.isReloading;
        this.hudState.reloadProgress = ammoState.reloadProgress;

        const weapon = this.player.getWeapon();
        this.hudState.weaponKind = weapon.kind;
        this.hudState.weaponName = weaponTierName(weapon.kind, weapon.tier);
        this.hudState.fireMode = this.shootingSystem.getFireModeName();
        this.hudState.chargeProgress = this.shootingSystem.getChargeProgress();

        this.onStateChange?.({ ...this.hudState });
    }

    public setFrameCap(fps: number) {
        this.frameCapMs = fps > 0 ? 1000 / fps : 0;
        this.lastFrameAt = 0;
    }

    private animate = async () => {
        if (this.disposed) return;
        this.animationFrameId = requestAnimationFrame(this.animate);

        if (!this.isLoaded) {
            this.locationManager.render();
            return;
        }

        if (this.frameCapMs > 0) {
            const now = performance.now();
            const since = now - this.lastFrameAt;
            if (since < this.frameCapMs - 1) return;
            this.lastFrameAt = since > this.frameCapMs * 2 ? now : this.lastFrameAt + this.frameCapMs;
        }

        this.frameCount++;
        perf.frameBegin();

        const portal = this.locationManager.checkPortals(this.player.mesh.position);
        const isEJustPressed = this.inputManager.isKeyJustPressed("KeyE");

        if (portal) {
            this.interactionSystem.onPrompt?.(t("g.prompt.enterPlace", { place: t(`g.floorReg.${portal.targetLocationId}.name`) }));
            if (isEJustPressed) {
                await this.changeLocation(portal.targetLocationId);
            }
        }

        this.timer.update();
        const delta = Math.min(this.timer.getDelta(), 0.1);

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            updateDamageIndicator(this);
            perf.begin("player");
            this.player.update(delta, isEJustPressed);
            enforcePlayerBounds(this);
            perf.end("player");
            perf.begin("camera");
            if (this.buildSession.editor.active) {
                this.buildSession.update(delta);
            } else {
                this.cameraController.setAbsorbSteps(!this.player.isJumping());
                this.cameraController.update(delta, this.inputManager);
            }
            perf.end("camera");

            const inSafe = (currentLocation instanceof MainHall || currentLocation instanceof MainWorld || currentLocation instanceof EventsLobby)
                && this.safeZoneSystem.isInSafeZone(this.player.mesh.position);

            if (this.hudState.inSafeZone !== inSafe) {
                this.hudState.inSafeZone = inSafe;
                this.emitState(true);
            }

            this.updateAudioListener();

            perf.begin("combat");
            this.enemySystem.update(delta);
            this.bossProjectiles.update(delta);

            if (this.defusalHoldingGrenade) {
                this.player.getWeapon().update(delta);
                this.updateGrenadeThrow();
            } else if (this.defusalHoldingMelee) {
                this.player.getWeapon().update(delta);
                this.updateMeleeSwing();
            } else if (!inSafe) {
                this.shootingSystem.update(delta);
            } else {
                this.player.getWeapon().update(delta);
            }

            this.updateDefusalView(delta);
            this.grenadeSystem.update(delta);
            if (this.defusalWeaponId) this.updateScopeInput();
            this.lootSystem.update(delta);
            this.petSystem.update(delta);
            this.petTuner.update();
            this.buildSystem.update(delta);
            perf.end("combat");

            if (currentLocation.update) {
                const dayTime = this.dayNightConfig
                    ? computeDayTime(Date.now(), this.dayNightConfig)
                    : undefined;
                perf.begin("location");
                currentLocation.update(this.player.mesh.position, delta, isEJustPressed, dayTime);
                perf.end("location");
            }

            perf.begin("interaction");
            this.interactionSystem.update(delta, isEJustPressed);
            this.updateQuestMarkers(delta);
            perf.end("interaction");

            if (currentLocation.getInteractionPrompt && !portal) {
                const prompt = currentLocation.getInteractionPrompt(this.player.mesh.position);
                if (prompt !== null) {
                    this.interactionSystem.onPrompt?.(prompt);
                }
            }

            if (currentLocation.pendingTeleport) {
                const targetId = currentLocation.pendingTeleport;
                currentLocation.pendingTeleport = null;
                await this.changeLocation(targetId);
            }

            this.updateSpawnProtection();
            this.updateEventStates(delta, currentLocation);
            this.updateCandleEmote(delta);
            perf.begin("network");
            this.networkSystem.update(delta);
            perf.end("network");
            this.emoteSystem.update(delta);
            this.abilitySystem.update(delta);
            this.updateMemeEffects(delta);
            this.weaponTuner.update();
            this.viewModelTuner.update();
            perf.begin("otherPlayers");
            const galaxy = currentLocation instanceof Basement ? currentLocation : null;
            this.otherPlayers.forEach((op) => {
                if (galaxy) op.setWispMode(!galaxy.isOnPlatform(op.mesh.position));
                op.update(delta);
            });
            perf.end("otherPlayers");

            this.networkManager.sendPlayerUpdate({
                position: this.player.mesh.position.toArray(),
                rotation: this.player.mesh.rotation.y,
                pitch: this.cameraController.getPitch(),
                state: this.player.getState(),
                jumping: this.player.isJumping(),
                velocityY: this.player.getVelocityY(),
                weaponEquipped: this.hudState.isWeaponEquipped,
                isShooting: this.player.getIsShooting(),
            });

            this.emitState(false);
        }

        perf.beginRender();
        this.locationManager.render();
        perf.endRender();
        perf.frameEnd();
    };

    public getViewportHeight(): number {
        const container = this.canvas.parentElement;
        return container?.clientHeight || window.innerHeight;
    }

    private handleResize = () => {
        const container = this.canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        this.cameraController.resize(width, height);
        this.buildSession.editor.camera.setAspect(width / Math.max(1, height));
        this.renderer.setSize(width, height, false);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        const location = this.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.setViewportHeight(height);
        }
    };

    public notifyLocalShot() {
        if (this.spawnProtectionUntil <= 0) return;
        this.spawnProtectionUntil = 0;
        this.updateSpawnProtection();
    }

    setWeaponEquipped(equipped: boolean) {
        const currentLocation = this.locationManager.getCurrentLocation();
        const finalEquipped = currentLocation?.id === 'tower-main-hall' ? false : equipped;
        this.hudState.isWeaponEquipped = finalEquipped;
        this.player.setWeaponVisible(finalEquipped);
        this.shootingSystem.setWeaponEquipped(finalEquipped);

        if (finalEquipped) {
            this.hudState.equippedTool = 'weapon';
            this.buildSystem.setActive(false);
        } else if (this.hudState.equippedTool === 'weapon') {
            this.hudState.equippedTool = null;
        }
        this.interactionSystem.isBlueprintActive = this.hudState.equippedTool === 'blueprint';
        this.onEquippedToolChange?.(this.hudState.equippedTool);
        this.emitState(true);
    }

    private isOwnFactionRoom(location: { id: string } | null | undefined): boolean {
        return location instanceof FactionGateRoom && this.interactionSystem.myFactionIds.has(location.factionId);
    }

    setBlueprintEquipped(equipped: boolean) {
        const currentLocation = this.locationManager.getCurrentLocation();
        const finalEquipped = (currentLocation?.id === 'main-world' || this.isOwnFactionRoom(currentLocation)) ? equipped : false;

        if (finalEquipped && this.hudState.equippedTool !== 'blueprint') {
            this.onNotification?.("📐 Press Q to choose what to place", 3000);
        }

        if (finalEquipped && this.hudState.isWeaponEquipped) {
            this.hudState.isWeaponEquipped = false;
            this.player.setWeaponVisible(false);
            this.shootingSystem.setWeaponEquipped(false);
        }

        this.hudState.equippedTool = finalEquipped ? 'blueprint' : (this.hudState.equippedTool === 'blueprint' ? null : this.hudState.equippedTool);
        this.interactionSystem.isBlueprintActive = this.hudState.equippedTool === 'blueprint';
        this.buildSystem.setActive(finalEquipped);
        this.onEquippedToolChange?.(this.hudState.equippedTool);
        this.emitState(true);
    }

    setNickname(nickname: string) {
        this.myNickname = nickname;
        this.networkManager.setNickname(nickname);
    }

    applyAndBroadcastSkin(url: string) {
        this.player.applySkinTexture(url);
        this.networkManager.sendSkinUpdate(url);
    }

    sendChatMessage(message: string) {
        this.networkManager.sendChatMessage(message);
    }

    sellToken(address: string, quantity?: number) {
        this.networkManager.sendSellToken(address, quantity);
    }

    buyShopItem(itemId: string, quantity: number = 1) {
        this.networkManager.sendShopBuyItem(itemId, quantity);
    }

    armPlaceable(itemId: string) {
        this.buildSystem.armPlaceable(itemId);
    }

    setSignText(signId: string, text: string): Promise<void> {
        return this.awaitSignSave(signId, () => this.networkManager.sendSignSetText(signId, text));
    }

    setSignDrawingUrl(signId: string, url: string): Promise<void> {
        return this.awaitSignSave(signId, () => this.networkManager.sendSignSetDrawingUrl(signId, url));
    }

    private awaitSignSave(signId: string, send: () => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pendingSignSave = { signId, resolve, reject };
            send();
            setTimeout(() => {
                if (this.pendingSignSave?.signId === signId) {
                    this.pendingSignSave.reject(new Error("Timed out waiting for the server"));
                    this.pendingSignSave = null;
                }
            }, 8000);
        });
    }

    public resolvePendingSignSave(signId: string) {
        if (this.pendingSignSave?.signId === signId) {
            this.pendingSignSave.resolve();
            this.pendingSignSave = null;
        }
    }

    public rejectPendingSignSave(message: string) {
        if (this.pendingSignSave) {
            this.pendingSignSave.reject(new Error(message));
            this.pendingSignSave = null;
        }
    }

    talkToQuestGiver(npc: string) {
        this.networkManager.sendNpcQuestInteract(npc);
    }

    markNpcMet(npcId: string) {
        this.networkManager.sendNpcMet(npcId);
    }

    selectBranch(branch: BranchId) {
        this.networkManager.sendBranchSelect(branch);
    }

    setQuestMarkers(markers: Record<string, QuestMarkerKind>) {
        this.questMarkerRequest = markers;
        this.applyQuestMarkers();
    }

    private applyQuestMarkers() {
        for (const sprite of this.questMarkers.values()) disposeQuestMarker(sprite);
        this.questMarkers.clear();

        for (const [interactionId, kind] of Object.entries(this.questMarkerRequest)) {
            const target = this.interactionSystem.findInteractable(interactionId);
            if (!target) continue;

            const box = new THREE.Box3().setFromObject(target);
            const worldY = target.getWorldPosition(new THREE.Vector3()).y;
            const height = Math.max(1.5, box.max.y - worldY) + 0.7;

            const marker = createQuestMarker(kind, height);
            target.add(marker);
            this.questMarkers.set(interactionId, marker);
        }
    }

    private updateQuestMarkers(delta: number) {
        if (this.questMarkers.size === 0) return;

        this.questMarkerTime += delta;
        for (const sprite of this.questMarkers.values()) {
            animateQuestMarker(sprite, this.questMarkerTime);
        }
    }

    learnSkill(nodeId: string) {
        this.networkManager.sendSkillLearn(nodeId);
    }

    bindAbility(slot: string, abilityId: string | null) {
        this.networkManager.sendAbilityBind(slot, abilityId);
    }

    castMeme(memeId: string) {
        this.networkManager.sendMemeCast(memeId);
    }

    public playLocalMeme(memeId: string, durationMs: number, radius: number) {
        const event: MemeCastEvent = {
            memeId,
            casterId: this.player.id,
            position: this.player.mesh.position.toArray(),
            radius,
            durationMs,
        };

        this.memeSystem.play(event, this.player.mesh);
        this.applyMemeToSelf(memeId, durationMs);
    }

    public handleMemeEffect(data: MemeCastEvent) {
        const caster = this.otherPlayers.get(data.casterId);
        this.memeSystem.play(data, caster && !caster.isHidden() ? caster.mesh : null);

        if (data.memeId !== "whale_splash") return;

        const centre = new THREE.Vector3(data.position[0], data.position[1], data.position[2]);
        const away = this.player.mesh.position.clone().sub(centre);
        if (away.lengthSq() < 1e-6 || away.length() > data.radius) return;

        const knockback = Number(MEME_ABILITIES_BY_ID.get("whale_splash")?.params.knockback ?? 0);
        this.player.applyHorizontalImpulse(away.normalize(), knockback);
    }

    private applyMemeToSelf(memeId: string, durationMs: number) {
        const params = MEME_ABILITIES_BY_ID.get(memeId)?.params ?? {};
        const back = this.cameraController.getForwardDirection().clone().multiplyScalar(-1);

        switch (memeId) {
            case "shrimp_squeak":
                this.player.applyHorizontalImpulse(back, Number(params.selfKnockback ?? 0));
                break;
            case "rug_pull":
                this.player.applyHorizontalImpulse(back, Number(params.dashBack ?? 0));
                break;
            case "moon_launch":
                this.player.launchUpward(Number(params.launchHeight ?? 0));
                break;
            case "crab_walk":
                this.player.setMemeMovement({
                    speedMult: Number(params.moveSpeedMult ?? 1),
                    yawOffset: params.strafeOnly ? Math.PI / 2 : 0,
                });
                this.memeMovementUntil = performance.now() + durationMs;
                break;
            case "pump_it":
                this.player.setMemeMovement({ jumpMult: Number(params.jumpMult ?? 1) });
                this.memeMovementUntil = performance.now() + durationMs;
                break;
            default:
                break;
        }
    }

    private updateMemeEffects(delta: number) {
        this.memeSystem.update(delta);
        this.player.setZoneSlow(this.abilitySystem.hostileSlowAt(this.player.mesh.position, this.localPlayerNetId ?? "", this.partyMemberIds));

        if (this.memeMovementUntil > 0 && performance.now() >= this.memeMovementUntil) {
            this.memeMovementUntil = 0;
            this.player.clearMemeMovement();
        }

        const ink = this.memeSystem.zoneCovering("ink_dump", this.player.mesh.position);
        const darkness = ink ? Number(MEME_ABILITIES_BY_ID.get("ink_dump")?.params.screenDarken ?? 0) : 0;
        if (darkness !== this.hudState.inkDarkness) {
            this.hudState.inkDarkness = darkness;
            this.emitState(true);
        }

        const copiumName = String(MEME_ABILITIES_BY_ID.get("copium_cloud")?.params.nicknameOverride ?? "WAGMI");
        this.otherPlayers.forEach((op) => {
            const inside = this.memeSystem.zoneCovering("copium_cloud", op.mesh.position);
            op.setNicknameOverride(inside ? copiumName : null);
        });
    }

    cycleFireMode() {
        const next = this.shootingSystem.nextFireMode();
        if (!next) {
            this.onNotification?.("No other fire modes unlocked yet", 2000);
            return;
        }
        this.networkManager.sendFireModeSet(next);
    }

    castAbility(abilityId: string) {
        const cameraPos = this.cameraController.camera.getWorldPosition(new THREE.Vector3());
        const aimPoint = cameraPos.add(this.cameraController.getForwardDirection().multiplyScalar(ABILITY_AIM_RANGE));

        const origin = this.player.mesh.position.clone();
        origin.y += ABILITY_CAST_HEIGHT;

        this.networkManager.sendAbilityCast(abilityId, {
            origin: origin.toArray(),
            direction: aimPoint.sub(origin).normalize().toArray(),
        });
    }

    respecSkills() {
        this.networkManager.sendSkillRespec();
    }

    acceptQuest(questId: string) {
        this.networkManager.sendQuestAccept(questId);
    }

    turnInQuest(questId: string) {
        this.networkManager.sendQuestTurnIn(questId);
    }

    talkToDispatcher() {
        this.networkManager.sendCanyonMapRequest();
    }

    startVoiceCapture() {
        this.voiceChat.startCapture();
    }

    stopVoiceCapture() {
        this.voiceChat.stopCapture();
    }

    warpCanyonSegment(segment: number) {
        this.networkManager.sendCanyonWarp(segment);
    }

    enterCanyonDungeon() {
        this.networkManager.sendCanyonEnterDungeon();
    }

    requestCosmetics() {
        this.networkManager.sendCosmeticListRequest();
    }

    buyCosmetic(itemId: CosmeticId) {
        this.networkManager.sendCosmeticBuy(itemId);
    }

    equipCosmetics(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        this.networkManager.sendCosmeticEquip(skinId, accessoryId);
    }

    requestCompanions() {
        this.networkManager.sendCompanionListRequest();
    }

    equipCompanion(companionId: CompanionId | null) {
        this.networkManager.sendCompanionEquip(companionId);
    }

    dustCompanion(itemId: CompanionId) {
        this.networkManager.sendCompanionDust(itemId);
    }

    combineFragments() {
        this.networkManager.sendCompanionCombine();
    }

    openCrate() {
        this.networkManager.sendCrateOpen();
    }

    setSpawnProtection(untilMs: number) {
        this.spawnProtectionUntil = untilMs;
        this.lastProtectionSecond = -1;
        if (untilMs <= Date.now()) {
            this.onSpawnProtectionChange?.(0);
        }
    }

    public notifyClientReadyIfLoaded() {
        if (this.isLoaded) this.networkManager.sendClientReady();
    }

    public isSpawnProtected(): boolean {
        return this.spawnProtectionUntil > Date.now();
    }

    private updateSpawnProtection() {
        const remaining = Math.max(0, this.spawnProtectionUntil - Date.now());
        const seconds = Math.ceil(remaining / 1000);
        if (seconds === this.lastProtectionSecond) return;
        this.lastProtectionSecond = seconds;
        this.onSpawnProtectionChange?.(seconds);
        this.player.setInvulnerableVisual(remaining > 0);
    }

    playEmote(key: EmoteKey) {
        if (isBodyEmote(key)) {
            const scene = this.locationManager.getCurrentLocation()?.scene;
            if (!scene) return;
            if (this.candleSystem.isBusy(this.player.id)) return;
            this.candleSystem.start(this.player.id, {
                mesh: this.player.mesh,
                playPose: (name) => this.player.playPose(name),
            }, scene);
            this.player.setMovementLocked(true);
        } else {
            this.emoteSystem.play(this.player.id, key, this.player.mesh);
        }
        this.networkManager.sendEmote(key);
    }

    public startRemoteBodyEmote(playerId: string, mesh: THREE.Object3D, playPose: (name: string | null) => void) {
        const scene = this.locationManager.getCurrentLocation()?.scene;
        if (!scene) return;
        this.candleSystem.start(playerId, { mesh, playPose }, scene);
    }

    private updateCandleEmote(delta: number) {
        this.candleSystem.update(delta);

        this.otherPlayers.forEach((op, id) => {
            if (!this.candleSystem.isDowned(id)) return;
            if (!op.isMoving()) return;
            this.candleSystem.stop(id);
        });

        if (!this.candleSystem.isBusy(this.player.id)) return;
        if (!this.candleSystem.isDowned(this.player.id)) return;
        if (!this.player.hasMovementInput()) return;

        this.player.setMovementLocked(false);
        this.candleSystem.stop(this.player.id);
    }

    joinFaction(factionId: string) {
        this.networkManager.sendFactionJoin(factionId);
    }

    leaveFaction(factionId: string) {
        this.networkManager.sendFactionLeave(factionId);
    }

    setDisplayedFaction(factionId: string) {
        this.networkManager.sendFactionSetDisplayed(factionId);
    }

    requestMyFactions() {
        this.networkManager.sendFactionMyListRequest();
    }

    searchFactions(ca?: string, name?: string) {
        this.networkManager.sendFactionSearch(ca, name);
    }

    listFactions(page?: number) {
        this.networkManager.sendFactionList(page);
    }

    requestFactionInfo(factionId?: string) {
        this.networkManager.sendFactionInfo(factionId);
    }

    requestPlayerProfile(wallet: string) {
        this.networkManager.sendPlayerProfileRequest(wallet);
    }

    requestLeaderboard(limit?: number) {
        this.networkManager.sendLeaderboardRequest(limit);
    }

    requestFactionLeaderboard(limit?: number) {
        this.networkManager.sendFactionLeaderboardRequest(limit);
    }

    requestFactionTaskList() {
        this.networkManager.sendFactionTaskListRequest();
    }

    acceptFactionTask(factionId: string, taskKey: string) {
        this.networkManager.sendFactionAcceptTask(factionId, taskKey);
    }

    claimFactionCreator(factionId: string) {
        this.networkManager.sendFactionClaimCreator(factionId);
    }

    refreshFactionViews(includeOwnFactions: boolean = true) {
        const now = performance.now();
        if (now - this.lastFactionViewRefresh < FACTION_VIEW_REFRESH_COOLDOWN_MS) {
            this.pendingOwnFactionRefresh ||= includeOwnFactions;
            return;
        }
        this.lastFactionViewRefresh = now;

        const withOwn = includeOwnFactions || this.pendingOwnFactionRefresh;
        this.pendingOwnFactionRefresh = false;

        this.requestFactionLeaderboard();
        this.requestFactionQuestList();
        if (withOwn) this.networkManager.sendFactionMyListRequest();

        const location = this.locationManager.getCurrentLocation();
        if (location instanceof MainHall) location.onRequestBoardData?.();
    }

    requestFactionQuestList() {
        this.networkManager.sendFactionQuestListRequest();
    }

    requestFactionQuestManageList(factionId: string) {
        this.networkManager.sendFactionQuestManageListRequest(factionId);
    }

    createFactionQuest(factionId: string, targetUrl: string, slotsTotal: number, rewardAsh: number) {
        this.networkManager.sendFactionQuestCreate(factionId, targetUrl, slotsTotal, rewardAsh);
    }

    claimFactionQuest(questId: string) {
        this.networkManager.sendFactionQuestClaim(questId);
    }

    sendFriendRequest(target: { wallet?: string; nickname?: string }) {
        this.networkManager.sendFriendRequest(target);
    }

    acceptFriendRequest(requestUserId: string) {
        this.networkManager.sendFriendRequestAccept(requestUserId);
    }

    declineFriendRequest(requestUserId: string) {
        this.networkManager.sendFriendRequestDecline(requestUserId);
    }

    removeFriend(friendUserId: string) {
        this.networkManager.sendFriendRemove(friendUserId);
    }

    requestFriendsList() {
        this.networkManager.sendFriendsListRequest();
    }

    searchFriends(query: string) {
        this.networkManager.sendFriendSearch(query);
    }

    sendMail(recipient: { wallet?: string; nickname?: string }, subject: string, body: string) {
        this.networkManager.sendMail(recipient, subject, body);
    }

    requestMailInbox() {
        this.networkManager.sendMailInboxRequest();
    }

    markMailRead(mailId: string) {
        this.networkManager.sendMailMarkRead(mailId);
    }

    requestTokenInfo(ca: string) {
        this.networkManager.requestTokenInfo(ca);
    }

    sendSupportTicket(subject: string, message: string) {
        this.networkManager.sendSupportTicket(subject, message);
    }

    blockPlayer(target: { wallet?: string; nickname?: string }) {
        this.networkManager.sendBlockUser(target);
    }

    unblockPlayer(blockedUserId: string) {
        this.networkManager.sendUnblockUser(blockedUserId);
    }

    requestBlockedList() {
        this.networkManager.sendBlockedListRequest();
    }

    sendPrivateMessage(toWallet: string, text: string) {
        this.networkManager.sendPrivateMessage(toWallet, text);
    }

    sendFactionChatMessage(factionId: string, message: string) {
        this.networkManager.sendFactionChatMessage(factionId, message);
    }

    inviteToFaction(toWallet: string, factionId: string) {
        this.networkManager.sendFactionInvite(toWallet, factionId);
    }

    sendTradeInvite(toWallet: string) {
        this.networkManager.sendTradeInvite(toWallet);
    }

    respondToTradeInvite(tradeId: string, accept: boolean) {
        this.networkManager.sendTradeInviteRespond(tradeId, accept);
    }

    setTradeOffer(tradeId: string, itemId: string | null, priceTnj: number | null) {
        this.networkManager.sendTradeSetOffer(tradeId, itemId, priceTnj);
    }

    setTradeReady(tradeId: string, ready: boolean) {
        this.networkManager.sendTradeSetReady(tradeId, ready);
    }

    submitTradePayment(tradeId: string, signature: string) {
        this.networkManager.sendTradeSubmitPayment(tradeId, signature);
    }

    cancelTrade(tradeId: string) {
        this.networkManager.sendTradeCancel(tradeId);
    }

    getInventory(): InventoryEntry[] {
        return this.inventory;
    }

    public teleportToSafeZone() {
        teleportToSafeZone(this);
    }

    public requestRespawn(target: RespawnTarget) {
        this.networkManager.sendRespawnRequest(target);
    }

    public teleportHome() {
        this.networkManager.sendHomeTeleport();
    }

    public depositToStorage(key: string, address: string, quantity: number) {
        this.networkManager.sendStorageDeposit(key, address, quantity);
    }

    public withdrawFromStorage(key: string, address: string, quantity: number) {
        this.networkManager.sendStorageWithdraw(key, address, quantity);
    }

    public invitePlayerToParty(wallet: string) {
        this.networkManager.sendPartyInvite(wallet);
    }

    public respondToPartyInvite(fromId: string, accept: boolean) {
        if (accept) this.networkManager.sendPartyAccept(fromId);
        else this.networkManager.sendPartyDecline(fromId);
    }

    public leaveParty() {
        this.networkManager.sendPartyLeave();
    }

    public kickFromParty(memberId: string) {
        this.networkManager.sendPartyKick(memberId);
    }

    public startArenaRun() {
        this.networkManager.sendArenaStart();
    }

    public joinDefusalQueue() {
        this.networkManager.sendDefusalQueue();
    }

    public leaveDefusalQueue() {
        this.networkManager.sendDefusalLeaveQueue();
    }

    public plantBomb() {
        this.networkManager.sendDefusalPlant();
    }

    public defuseBomb() {
        this.networkManager.sendDefusalDefuse();
    }

    public cancelDefusalChannel() {
        this.networkManager.sendDefusalCancel();
    }

    public readonly grenadeSystem = new GrenadeSystem();
    public defusalHoldingGrenade = false;
    private defusalWeaponId: string | null = null;
    private defusalViewModel: DefusalViewModel | null = null;
    private throwCooldown = 0;


    public applyDefusalHeld(itemId: string | null, holdingGrenade: boolean, holdingMelee = false) {
        this.defusalHoldingGrenade = holdingGrenade;
        this.defusalHoldingMelee = holdingMelee;

        if (this.defusalWeaponId === itemId) return;
        this.defusalWeaponId = itemId;

        if (!this.defusalViewModel) {
            this.defusalViewModel = new DefusalViewModel(this.cameraController.camera);
            this.shootingSystem.setMuzzleProvider(() => this.defusalViewModel?.getWorldMuzzle() ?? null);
            this.viewModelTuner.init(this.inputManager, this.defusalViewModel);
        }

        this.defusalViewModel.setWeapon(itemId);
        this.defusalViewModel.setVisible(itemId !== null);

        const item = itemId ? ARSENAL_BY_ID.get(itemId) : null;
        this.shootingSystem.setArsenalWeapon(
            item && (item.slot === "primary" || item.slot === "pistol") ? item : null
        );
        this.defusalViewModel.setScoped(item?.scoped === true);
        this.defusalViewModel.setScopeActive(false);
        this.cameraController.setScopeSteps(item?.scoped ? [2, 4] : null);
        this.onScopeStep?.(0);
    }

    public clearDefusalView() {
        this.defusalHoldingGrenade = false;
        this.defusalWeaponId = null;
        this.defusalViewModel?.setScopeActive(false);
        this.shootingSystem.setArsenalWeapon(null);
        this.cameraController.setScopeSteps(null);
        this.defusalViewModel?.setVisible(false);
        this.onScopeStep?.(0);
    }

    private updateDefusalView(delta: number) {
        if (!this.defusalViewModel) return;

        const item = this.defusalWeaponId ? ARSENAL_BY_ID.get(this.defusalWeaponId) : null;
        const state = this.player.getState();
        const velocity = state === "idle" ? 0 : state === "sprint" ? 9 : 5;

        this.defusalViewModel.update(
            delta,
            velocity,
            !this.player.isJumping(),
            item?.scoped === true && this.cameraController.isAimingState()
        );
    }

    public defusalHoldingMelee = false;
    private swingCooldown = 0;

    private updateMeleeSwing() {
        if (this.swingCooldown > 0) {
            this.swingCooldown -= 1;
            return;
        }
        if (!this.inputManager.isMouseJustPressed(0)) return;

        this.networkManager.sendDefusalMelee();
        this.defusalViewModel?.onSwing();
        this.swingCooldown = 24;
    }

    private updateScopeInput() {
        if (!this.cameraController.isFirstPerson()) return;
        if (this.inputManager.isMouseJustPressed(2)) this.cycleScope();
    }

    private updateGrenadeThrow() {
        if (this.throwCooldown > 0) {
            this.throwCooldown -= 1;
            return;
        }
        if (!this.inputManager.isMouseJustPressed(0)) return;

        const direction = this.cameraController.getForwardDirection();
        this.networkManager.sendDefusalThrow([direction.x, direction.y, direction.z]);
        this.throwCooldown = 30;
    }

    public cycleScope() {
        if (!this.cameraController.isFirstPerson()) return;
        const step = this.cameraController.cycleScope();
        this.defusalViewModel?.setScopeActive(step > 0);
        this.onScopeStep?.(step);
    }

    public buyDefusalItem(itemId: string) {
        this.networkManager.sendDefusalBuy(itemId);
    }

    public switchDefusalSlot(slot: string) {
        this.networkManager.sendDefusalSwitch(slot);
    }

    public joinArenaRun() {
        this.networkManager.sendArenaJoin();
    }

    public leaveArenaRun() {
        this.networkManager.sendArenaLeave();
    }

    private candleArena(): CandleArena | null {
        const location = this.locationManager.getCurrentLocation();
        return location instanceof CandleArena ? location : null;
    }

    public applyArenaCandle(health: number, maxHealth: number, wave: number) {
        this.candleArena()?.setCandleState(maxHealth > 0 ? health / maxHealth : 0, wave);
    }

    public flashArenaCandle(health: number, maxHealth: number) {
        const arena = this.candleArena();
        if (!arena) return;
        arena.setCandleState(maxHealth > 0 ? health / maxHealth : 0, this.arenaWave);
        arena.flashCandle();
    }

    public arenaWave = 0;
    private arenaDownMarkers = new Set<string>();

    public markArenaDown(playerId: string) {
        if (this.arenaDownMarkers.has(playerId)) return;
        const other = this.otherPlayers.get(playerId);
        if (!other) return;

        other.mesh.userData.interactionId = `arena-revive:${playerId}`;
        other.mesh.userData.interactionRadius = 4;
        this.interactionSystem.registerInteractable(other.mesh);
        this.arenaDownMarkers.add(playerId);
    }

    public clearArenaDown(playerId: string) {
        if (!this.arenaDownMarkers.has(playerId)) return;

        const other = this.otherPlayers.get(playerId);
        if (other) {
            delete other.mesh.userData.interactionId;
            this.interactionSystem.removeInteractable(other.mesh);
        }
        this.arenaDownMarkers.delete(playerId);
    }

    public clearArenaDownAll() {
        for (const id of Array.from(this.arenaDownMarkers)) this.clearArenaDown(id);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.restoreTimeoutId !== null) {
            clearTimeout(this.restoreTimeoutId);
            this.restoreTimeoutId = null;
        }
        window.removeEventListener("resize", this.handleResize);
        window.removeEventListener("orientationchange", this.handleResize);
        this.networkManager.disconnect();
        this.buildSession.dispose();
        this.inputManager.dispose();
        this.safeZone.dispose();
        this.shootingSystem.dispose();
        this.networkSystem.dispose();
        this.enemySystem.dispose();
        this.bossProjectiles.dispose();
        this.lootSystem.dispose();
        this.petSystem.dispose();
        this.voiceChat.dispose();

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            this.otherPlayers.forEach((op) => {
                op.dispose(currentLocation.scene);
            });
            this.player.dispose(currentLocation.scene);
        }

        this.otherPlayers.clear();
        this.emoteSystem.clear();
        this.candleSystem.clear();
        this.abilitySystem.dispose();
        this.memeSystem.dispose();
        disposeEmoteAssets();
        disposeSkinTextures();
        this.locationManager.dispose();
        this.renderer.dispose();
    }
}

export interface Game extends GameCallbacks { }
