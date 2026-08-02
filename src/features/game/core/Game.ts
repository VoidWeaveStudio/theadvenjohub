// src/features/game/core/Game.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CameraController } from "./CameraController";
import { ResourceManager } from "./ResourceManager";
import { NetworkManager, InventoryEntry } from "../network/NetworkManager";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";
import { SafeZone } from "../world/SafeZone";
import { ShootingSystem } from "../systems/ShootingSystem";
import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { NetworkSystem } from "../systems/NetworkSystem";
import { EnemySystem } from "../systems/EnemySystem";
import { LootSystem } from "../systems/LootSystem";
import { BuildSystem } from "../systems/BuildSystem";
import { VoiceChatSystem } from "../systems/VoiceChatSystem";
import { LocationManager } from "../world/LocationManager";
import { MainHall } from "../world/locations/tower/floors/MainHall";
import { MainWorld } from "../world/locations/main-world/MainWorld";
import { computeDayTime, DayNightConfig } from "../utils/dayNightCycle";
import { applyLocationMovementConfig, configureLocationSpecifics, syncMainWorldEntry } from "./GameLocationTransition";
import { registerNetworkHandlers } from "./GameNetworkHandlers";
import type { GameCallbacks } from "./GameCallbacks";
import { createGameRenderer } from "./GameRenderer";
import { updateDamageIndicator } from "./GameDamageIndicator";
import { restoreToSavedProgress, waitForProgressRestore, teleportToSafeZone } from "./GameLocationOrchestration";
import { SoundManager } from "./SoundManager";

export interface GameSession {
    gameToken: string;
    serverUrl: string;
    userId: string;
    wallet: string;
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
    isWeaponEquipped: boolean;
    equippedTool: "weapon" | "blueprint" | null;
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
    public readonly interactionSystem: InteractionSystem;
    private networkSystem: NetworkSystem;
    public readonly enemySystem: EnemySystem;
    public readonly lootSystem: LootSystem;
    public readonly buildSystem: BuildSystem;
    public readonly voiceChat: VoiceChatSystem;
    public readonly locationManager: LocationManager;
    public inventory: InventoryEntry[] = [];
    public ash: number = 0;
    public placeables: Record<string, number> = {};
    private pendingSignSave: { signId: string; resolve: () => void; reject: (err: Error) => void } | null = null;

    public isDead: boolean = false;
    public killerName: string | null = null;

    public damageAttackerId: string | null = null;
    public lastDamageTime: number = 0;
    public readonly DAMAGE_INDICATOR_DURATION = 2000;

    private isLoaded: boolean = false;
    private animationFrameId: number | null = null;
    private frameCount: number = 0;
    private disposed: boolean = false;
    private isChangingLocation: boolean = false;

    private showFloorSelector: boolean = false;
    public localPlayerNetId: string | null = null;
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
        isWeaponEquipped: true,
        equippedTool: "weapon",
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

    constructor(canvas: HTMLCanvasElement, slug: string, session: GameSession) {
        this.canvas = canvas;
        this.slug = slug;
        this.session = session;

        const container = canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;

        this.renderer = createGameRenderer(canvas, width, height);

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
        this.buildSystem = new BuildSystem();
        this.voiceChat = new VoiceChatSystem();
    }


    async init() {
        this.onLoadStateChange?.(true, "Initializing core assets...");

        SoundManager.getInstance().loadCritical().then(() => {
            SoundManager.getInstance().loadLazy();
        });

        this.resourceManager.onProgress = (progress, message) => {
            this.onLoadStateChange?.(true, `${message} ${Math.round(progress)}%`);
        };

        const criticalResult = await this.resourceManager.loadCritical();

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
                this.onLoadStateChange?.(true, "Setting up world...");

                this.locationManager.registerLocations(this.resourceManager);
                const currentLocation = await this.locationManager.loadLocation("tower-main-hall");
                if (this.disposed) return;

                if (!currentLocation) {
                    throw new Error("Failed to load tower-main-hall location");
                }

                this.locationManager.onLocationChange = (id: string) => {
                    this.onNotification?.(` Entered: ${id}`, 2000);
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

                const getGroundHeight = (x: number, z: number) => {
                    const currentLoc = this.locationManager.getCurrentLocation();
                    if (currentLoc instanceof MainWorld) {
                        return currentLoc.terrain.getHeightAt(x, z);
                    }
                    return 0;
                };

                this.enemySystem.init(currentLocation.scene, this.networkManager, getGroundHeight);
                this.lootSystem.init(currentLocation.scene, this.networkManager, this.player, getGroundHeight);
                this.buildSystem.init(currentLocation.scene, currentLocation.id, this.networkManager, this.player, this.inputManager, getGroundHeight, this.interactionSystem, this.session.userId);
                this.buildSystem.onNotification = (msg, duration) => {
                    this.onNotification?.(msg, duration);
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
                    this.onOpenVendorUI?.();
                };

                this.interactionSystem.onOpenSola = () => {
                    this.onOpenSolaUI?.();
                };

                this.interactionSystem.onOpenCanyonMap = () => {
                    this.onOpenCanyonMapUI?.();
                };

                this.interactionSystem.onOpenFactionBroker = () => {
                    this.onOpenFactionBrokerUI?.();
                };

                this.interactionSystem.onOpenAlfredo = () => {
                    this.onOpenAlfredoUI?.();
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

                this.onLoadStateChange?.(true, "Restoring your last position...");
                await this.waitForProgressRestore();
                if (this.disposed) return;

                this.isLoaded = true;
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
        options?: { position?: number[]; rotation?: number; silent?: boolean }
    ) {
        if (this.isChangingLocation) return;
        this.isChangingLocation = true;

        try {
            this.onLoadStateChange?.(true, "Traveling to new location...");

            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (this.disposed) return;

            const previousLocation = this.locationManager.getCurrentLocation();

            this.enemySystem.clear();
            this.lootSystem.clear();
            this.buildSystem.clear();

            const newLocation = await this.locationManager.loadLocation(targetLocationId);
            if (this.disposed) return;
            if (!newLocation || !previousLocation || newLocation === previousLocation) {
                this.onLoadStateChange?.(false);
                return;
            }

            this.networkManager.sendLocationChange(newLocation.id);
            this.shootingSystem.clearAllEffects();

            previousLocation.scene.remove(this.player.mesh);
            newLocation.scene.add(this.player.mesh);

            previousLocation.scene.remove(this.cameraController.yawObject);
            newLocation.scene.add(this.cameraController.yawObject);

            this.otherPlayers.forEach((op) => {
                if (!op.isHidden()) {
                    previousLocation.scene.remove(op.mesh);
                    previousLocation.scene.remove(op.getHitbox());
                    newLocation.scene.add(op.mesh);
                    newLocation.scene.add(op.getHitbox());
                }
            });

            this.locationManager.evictLocation(previousLocation.id);

            this.shootingSystem.setScene(newLocation.scene);
            this.interactionSystem.setScene(newLocation.scene);
            this.interactionSystem.clearInteractables();
            this.enemySystem.setScene(newLocation.scene);
            this.lootSystem.setScene(newLocation.scene);
            this.buildSystem.setScene(newLocation.scene, newLocation.id);

            this.shootingSystem.prewarm();
            await this.lootSystem.prewarm();
            if (this.disposed) return;
            this.renderer.compile(newLocation.scene, this.cameraController.camera);
            this.shootingSystem.endPrewarm();
            this.lootSystem.endPrewarm();

            const newLocationInteractables = newLocation.getInteractables();
            newLocationInteractables.forEach(obj => {
                this.interactionSystem.registerInteractable(obj);
            });

            applyLocationMovementConfig(this, newLocation);
            configureLocationSpecifics(this, newLocation);

            if (newLocation.id !== 'main-world' && this.hudState.equippedTool === 'blueprint') {
                this.setBlueprintEquipped(false);
            }

            const spawnPoint = options?.position
                ? new THREE.Vector3(options.position[0], options.position[1], options.position[2])
                : newLocation.getSpawnPoint();
            this.player.teleportTo(spawnPoint);
            this.cameraController.yawObject.position.copy(spawnPoint);
            if (options?.rotation !== undefined) {
                this.player.mesh.rotation.y = options.rotation;
            }

            if (!options?.silent) {
                this.onNotification?.(`📍 Teleported to ${newLocation.name}`, 2000);
            }
            this.onLocationChange?.(newLocation.id);

            if (newLocation instanceof MainWorld) {
                await syncMainWorldEntry(this, newLocation);
                if (this.disposed) return;
            }

            this.onLoadStateChange?.(false);
        } finally {
            this.isChangingLocation = false;
        }
    }

    public async restoreToSavedProgress(progress?: { locationId?: string; position: number[]; rotation?: number }) {
        return restoreToSavedProgress(this, progress);
    }

    private waitForProgressRestore(timeoutMs = 6000): Promise<void> {
        return waitForProgressRestore(this, timeoutMs);
    }

    private setupNetwork() {
        registerNetworkHandlers(this);
    }

    public updateOnlineCount() {
        let visibleCount = 1;
        const nearbyIds = new Set<string>();
        this.otherPlayers.forEach((op, id) => {
            if (!op.isHidden()) {
                visibleCount++;
                nearbyIds.add(id);
            }
        });
        this.hudState.online = visibleCount;
        this.voiceChat.syncPeers(nearbyIds);
        this.emitState(true);
    }

    public emitState(force: boolean = false) {
        const now = performance.now();
        if (!force && now - this.lastStateEmit < this.stateEmitInterval) return;
        this.lastStateEmit = now;
        const ammoState = this.shootingSystem.getAmmoState();
        this.hudState.health = this.player.health;
        this.hudState.ammo = ammoState.ammo;
        this.hudState.maxAmmo = ammoState.maxAmmo;
        this.hudState.reserve = ammoState.reserve;
        this.hudState.isReloading = ammoState.isReloading;
        this.onStateChange?.({ ...this.hudState });
    }

    private animate = async () => {
        if (this.disposed) return;
        this.animationFrameId = requestAnimationFrame(this.animate);

        if (!this.isLoaded) {
            this.locationManager.render();
            return;
        }

        this.frameCount++;

        const portal = this.locationManager.checkPortals(this.player.mesh.position);
        const isEJustPressed = this.inputManager.isKeyJustPressed("KeyE");

        if (portal) {
            this.interactionSystem.onPrompt?.(`[E] Enter ${portal.targetLocationId}`);
            if (isEJustPressed) {
                await this.changeLocation(portal.targetLocationId);
            }
        }

        this.timer.update();
        const delta = Math.min(this.timer.getDelta(), 0.1);

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            updateDamageIndicator(this);
            this.player.update(delta, isEJustPressed);
            if (this.isDead && this.inputManager.isKeyJustPressed("Space")) {
                this.networkManager.sendRespawnRequest();
            }
            this.cameraController.update(delta, this.inputManager);

            const inSafe = (currentLocation instanceof MainHall) && this.safeZoneSystem.isInSafeZone(this.player.mesh.position);

            if (this.hudState.inSafeZone !== inSafe) {
                this.hudState.inSafeZone = inSafe;
                this.emitState(true);
            }

            if (!inSafe) {
                this.shootingSystem.update(delta);
                this.enemySystem.update(delta);
            } else {
                this.player.getWeapon().update(delta);
            }
            this.lootSystem.update(delta);
            this.buildSystem.update(delta);

            if (currentLocation.update) {
                const dayTime = this.dayNightConfig
                    ? computeDayTime(Date.now(), this.dayNightConfig)
                    : undefined;
                currentLocation.update(this.player.mesh.position, delta, isEJustPressed, dayTime);
            }

            this.interactionSystem.update(delta, isEJustPressed);

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

            this.networkSystem.update(delta);
            this.otherPlayers.forEach((op) => op.update(delta));

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

        this.locationManager.render();
    };

    private handleResize = () => {
        const container = this.canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        this.cameraController.resize(width, height);
        this.renderer.setSize(width, height, false);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    };

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

    setBlueprintEquipped(equipped: boolean) {
        const currentLocation = this.locationManager.getCurrentLocation();
        const finalEquipped = currentLocation?.id === 'main-world' ? equipped : false;

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

    talkToQuestGiver(questId: string) {
        this.networkManager.sendQuestInteract(questId);
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

    createFaction(ca: string) {
        this.networkManager.sendFactionCreate(ca);
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

    getInventory(): InventoryEntry[] {
        return this.inventory;
    }

    public teleportToSafeZone() {
        teleportToSafeZone(this);
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
        this.inputManager.dispose();
        this.safeZone.dispose();
        this.shootingSystem.dispose();
        this.networkSystem.dispose();
        this.enemySystem.dispose();
        this.lootSystem.dispose();
        this.voiceChat.dispose();

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            this.otherPlayers.forEach((op) => {
                op.dispose(currentLocation.scene);
            });
            this.player.dispose(currentLocation.scene);
        }

        this.otherPlayers.clear();
        this.locationManager.dispose();
        this.renderer.dispose();
    }
}

export interface Game extends GameCallbacks { }
