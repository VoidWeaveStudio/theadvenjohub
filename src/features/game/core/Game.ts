// src/features/game/core/Game.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CameraController } from "./CameraController";
import { ResourceManager } from "./ResourceManager";
import { NetworkManager, PlayerNetData, InventoryEntry } from "../network/NetworkManager";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";
import { SafeZone } from "../world/SafeZone";
import { ShootingSystem } from "../systems/ShootingSystem";
import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { NetworkSystem } from "../systems/NetworkSystem";
import { EnemySystem } from "../systems/EnemySystem";
import { LootSystem } from "../systems/LootSystem";
import { ChatMessage } from "../ui/Chat";
import { LocationManager } from "../world/LocationManager";
import { MainWorld } from "../world/locations/main-world/MainWorld";
import { Cave } from "../world/locations/Cave";
import { TowerFloor } from "../world/locations/tower/TowerFloor";
import { CollisionGrid } from "../world/CollisionGrid";
import { MainHall } from "../world/locations/tower/floors/MainHall";
import { TokenCanyon } from "../world/locations/token-gates/TokenCanyon";
import { apiPost } from "@/core/api/client";
import { computeDayTime, DayNightConfig } from "../utils/dayNightCycle";

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
}

export interface DamageEvent {
    id: number;
    direction: number;
    damage: number;
    timestamp: number;
}

interface PlayerLeaveLocationData {
    playerId: string;
    fromLocation: string;
    toLocation: string;
}

interface AuthData {
    playerId: string;
    nickname: string;
}

interface PlayerJoinData {
    id: string;
    nickname: string;
    locationId?: string;
    position?: number[];
    rotation?: number;
}

interface PlayerUpdateData {
    id: string;
    position: number[];
    rotation: number;
    pitch: number;
    state: string;
}

interface ShootData {
    id: string;
    origin: number[];
    direction: number[];
}

interface ChatData {
    id: string;
    sender: string;
    message: string;
    timestamp: number;
}

interface ProgressData {
    progress?: {
        locationId?: string;
        position: number[];
        rotation?: number;
    };
    nickname?: string;
}

interface DamageData {
    targetId: string;
    damage: number;
    attackerId: string;
}

interface DeathData {
    playerId: string;
    killerId: string;
}

interface PlayerRespawnData {
    id: string;
    health: number;
    position: number[];
}

interface LocalRespawnData {
    position: number[];
    health: number;
}

interface PlayerUpdatePayload {
    position: number[];
    rotation: number;
    pitch: number;
    state: string;
    jumping: boolean;
    velocityY: number;
    weaponEquipped: boolean;
    isShooting: boolean;
}

export class Game {
    private hitMarkTrigger: number = 0;
    private canvas: HTMLCanvasElement;
    private slug: string;
    private renderer: THREE.WebGLRenderer;
    private timer: THREE.Timer;
    private session: GameSession;

    private inputManager: InputManager;
    private cameraController: CameraController;
    private resourceManager: ResourceManager;
    private networkManager: NetworkManager;

    private player: Player;
    private otherPlayers: Map<string, OtherPlayer> = new Map();
    private safeZone: SafeZone;

    private shootingSystem: ShootingSystem;
    private safeZoneSystem: SafeZoneSystem;
    private interactionSystem: InteractionSystem;
    private networkSystem: NetworkSystem;
    private enemySystem: EnemySystem;
    private lootSystem: LootSystem;
    private locationManager: LocationManager;
    private inventory: InventoryEntry[] = [];
    private ash: number = 0;

    private isDead: boolean = false;
    private killerName: string | null = null;

    private damageAttackerId: string | null = null;
    private lastDamageTime: number = 0;
    private readonly DAMAGE_INDICATOR_DURATION = 2000;

    private isLoaded: boolean = false;
    private animationFrameId: number | null = null;
    private frameCount: number = 0;
    private disposed: boolean = false;

    private showFloorSelector: boolean = false;
    private localPlayerNetId: string | null = null;
    private dayNightConfig: DayNightConfig | null = null;
    private hasRestoredLocation: boolean = false;
    private restoreResolver: (() => void) | null = null;

    private hudState: HUDState = {
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
    };

    private lastStateEmit: number = 0;
    private stateEmitInterval: number = 100;

    private updateDamageIndicator() {
        if (this.damageAttackerId === null) return;

        const timeSinceDamage = Date.now() - this.lastDamageTime;
        if (timeSinceDamage > this.DAMAGE_INDICATOR_DURATION) {
            this.damageAttackerId = null;
            this.onDamageIndicatorUpdate?.(null, 0);
            return;
        }

        let attackerPos: THREE.Vector3 | null = null;
        
        const playerAttacker = this.otherPlayers.get(this.damageAttackerId);
        if (playerAttacker && !playerAttacker.isDead() && !playerAttacker.isHidden()) {
            attackerPos = playerAttacker.mesh.position;
        } else {
            const enemy = this.enemySystem.getEnemy(this.damageAttackerId);
            if (enemy) {
                attackerPos = enemy.mesh.position;
            }
        }

        if (!attackerPos) {
            this.damageAttackerId = null;
            this.onDamageIndicatorUpdate?.(null, 0);
            return;
        }

        const playerPos = this.player.mesh.position;
        const dx = attackerPos.x - playerPos.x;
        const dz = attackerPos.z - playerPos.z;
        const worldAngle = Math.atan2(dx, dz);
        const cameraYaw = this.cameraController.getYaw();

        let relativeAngle = worldAngle - cameraYaw;
        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

        this.onDamageIndicatorUpdate?.(this.damageAttackerId, relativeAngle);
    }

    public onHitMark?: () => void;
    public onStateChange?: (state: HUDState) => void;
    public onNotification?: (msg: string, duration?: number) => void;
    public onLoadStateChange?: (loading: boolean, message?: string) => void;
    public onChatMessage?: (message: ChatMessage) => void;
    public onNicknameLoaded?: (nickname: string) => void;
    public onDamageEvent?: (event: DamageEvent) => void;
    public onDeathStateChange?: (isDead: boolean, killerName: string | null) => void;
    public onDamageIndicatorUpdate?: (attackerId: string | null, direction: number) => void;

    public onFloorSelectorToggle?: (isOpen: boolean) => void;
    public onLocationChange?: (id: string) => void;

    public onOpenTokenUI?: (tokenData: any) => void;
    public onOpenVendorUI?: () => void;
    public onInventoryChange?: (inventory: InventoryEntry[], ash: number) => void;
    public onSellResult?: (data: { address: string; quantitySold: number; ashEarned: number; marketCap: number }) => void;

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

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });

        const container = canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;

        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

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
    }


    async init() {
        this.onLoadStateChange?.(true, "Initializing core assets...");

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

                const getCollisionGrid = (loc: any): CollisionGrid | undefined => loc.collisionGrid;

                if (currentLocation instanceof MainWorld) {
                    this.player.setTerrain(currentLocation.terrain);
                    this.player.setCollisionGrid(currentLocation.collisionGrid);
                    this.cameraController.setCollisionGrid(currentLocation.terrainCollisionGrid);
                    this.player.setMaxRadius(235);
                } else if (currentLocation instanceof Cave) {
                    this.player.setTerrain(currentLocation as any);
                    this.player.setCollisionGrid(currentLocation.collisionGrid);
                    this.cameraController.setCollisionGrid(currentLocation.collisionGrid);
                    this.player.setMaxRadius(50);
                } else if (currentLocation instanceof TowerFloor) {
                    this.player.setTerrain(null);
                    this.player.setCollisionGrid(currentLocation.collisionGrid);
                    this.cameraController.setCollisionGrid(currentLocation.collisionGrid);
                    if (currentLocation.id === 'tower-basement') {
                        this.player.setMaxRadius(40);
                    } else {
                        this.player.setMaxRadius(9999);
                    }
                }

                currentLocation.scene.add(this.cameraController.yawObject);
                this.cameraController.setTarget(this.player.mesh);

                if (currentLocation instanceof MainHall) {
                    this.safeZone.create(
                        currentLocation.scene,
                        undefined,
                        new THREE.Vector3(0, 0, 0),
                        12
                    );
                }

                const collisionGrid = getCollisionGrid(currentLocation);

                this.shootingSystem.init(
                    currentLocation.scene,
                    this.player,
                    this.inputManager,
                    this.cameraController,
                    this.resourceManager,
                    this.networkManager,
                    this.otherPlayers,
                    currentLocation,
                    collisionGrid
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

    private async changeLocation(
        targetLocationId: string,
        options?: { position?: number[]; rotation?: number; silent?: boolean }
    ) {
        this.onLoadStateChange?.(true, "Traveling to new location...");

        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (this.disposed) return;

        const previousLocation = this.locationManager.getCurrentLocation();

        this.enemySystem.clear();
        this.lootSystem.clear();

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

        const getCollisionGrid = (loc: any): CollisionGrid | undefined => loc.collisionGrid;

        if (newLocation instanceof MainWorld) {
            this.player.setTerrain(newLocation.terrain);
            this.player.setCollisionGrid(newLocation.collisionGrid);
            this.cameraController.setCollisionGrid(newLocation.terrainCollisionGrid);
            this.player.setMaxRadius(235);
            this.shootingSystem.setLocation(newLocation, newLocation.collisionGrid);
        } else if (newLocation instanceof Cave) {
            this.player.setTerrain(newLocation as any);
            this.player.setCollisionGrid(newLocation.collisionGrid);
            this.cameraController.setCollisionGrid(newLocation.collisionGrid);
            this.player.setMaxRadius(50);
            this.shootingSystem.setLocation(newLocation, newLocation.collisionGrid);
        } else if (newLocation instanceof TowerFloor) {
            this.player.setTerrain(null);
            this.player.setCollisionGrid(newLocation.collisionGrid);
            this.cameraController.setCollisionGrid(newLocation.collisionGrid);
            if (newLocation.id === 'tower-basement') {
                this.player.setMaxRadius(40);
            } else {
                this.player.setMaxRadius(9999);
            }
            this.shootingSystem.setLocation(newLocation, newLocation.collisionGrid);
        } else if (newLocation instanceof TokenCanyon) {
            this.player.setTerrain(null);
            this.player.setCollisionGrid(newLocation.collisionGrid);
            this.cameraController.setCollisionGrid(newLocation.collisionGrid);
            this.player.setMaxRadius(140);
            this.shootingSystem.setLocation(newLocation, newLocation.collisionGrid);
        } else {
            this.shootingSystem.setLocation(newLocation, getCollisionGrid(newLocation) || null);
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
            this.onLoadStateChange?.(true, "Syncing with server...");
            this.lootSystem.preloadTokenTextures();
            await this.enemySystem.waitForInitialSync();
            if (this.disposed) return;
        }

        this.onLoadStateChange?.(false);
    }

    private async restoreToSavedProgress(progress?: { locationId?: string; position: number[]; rotation?: number }) {
        try {
            const currentId = this.locationManager.getCurrentLocation()?.id;
            if (progress?.locationId && progress.locationId !== currentId) {
                await this.changeLocation(progress.locationId, {
                    position: progress.position,
                    rotation: progress.rotation,
                    silent: true,
                });
            } else if (progress?.position) {
                const pos = new THREE.Vector3(progress.position[0], progress.position[1], progress.position[2]);
                this.player.teleportTo(pos);
                this.cameraController.yawObject.position.copy(pos);
                if (progress.rotation !== undefined) {
                    this.player.mesh.rotation.y = progress.rotation;
                }
            }
        } catch (error) {
            console.error("Failed to restore saved location:", error);
        } finally {
            this.restoreResolver?.();
            this.restoreResolver = null;
        }
    }

    private waitForProgressRestore(timeoutMs = 6000): Promise<void> {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            this.restoreResolver = finish;
            setTimeout(finish, timeoutMs);
        });
    }

    private setupNetwork() {
        this.networkManager.onPlayerLeaveLocation = (data: PlayerLeaveLocationData) => {
            const op = this.otherPlayers.get(data.playerId);
            if (!op) return;
            const currentLocation = this.locationManager.getCurrentLocation();
            if (!currentLocation) return;
            if (currentLocation.id === data.fromLocation) {
                currentLocation.scene.remove(op.mesh);
                currentLocation.scene.remove(op.getHitbox());
                this.shootingSystem.unregisterOtherPlayer(data.playerId);
                op.setHidden(true);
                this.onChatMessage?.({
                    id: `system-${Date.now()}`, sender: "System",
                    message: `${op.nickname} left the area`,
                    timestamp: Date.now(), type: "system",
                });
            }
        };

        this.networkManager.onPlayerJoinLocation = (data: PlayerNetData) => {
            const currentLocation = this.locationManager.getCurrentLocation();
            if (!currentLocation) return;
            const locationId = data.locationId || 'main-world';
            if (currentLocation.id === locationId) {
                let op = this.otherPlayers.get(data.id);
                if (!op) {
                    op = new OtherPlayer(data.id, data.nickname);
                    op.create(currentLocation.scene, this.resourceManager);
                    this.otherPlayers.set(data.id, op);
                } else {
                    currentLocation.scene.add(op.mesh);
                    currentLocation.scene.add(op.getHitbox());
                    op.setHidden(false);
                }
                this.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
                op.updateFromNetwork(data);
                this.updateOnlineCount();
                this.onChatMessage?.({
                    id: `system-${Date.now()}`, sender: "System",
                    message: `${data.nickname} entered the area`,
                    timestamp: Date.now(), type: "system",
                });
            }
        };

        this.networkManager.setSessionRefresher(async () => {
            try {
                const fresh = await apiPost<GameSession>("/api/game/session", { gameSlug: this.slug });
                this.session = fresh;
                return fresh;
            } catch {
                return null;
            }
        });

        this.networkManager.onSessionRevoked = () => {
            this.onNotification?.("⚠️ Connected from another tab/device", 5000);
        };

        this.networkManager.onReconnectFailed = () => {
            this.onNotification?.("❌ Lost connection to game server", 5000);
        };

        this.networkManager.connect(this.session);

        this.networkManager.onAuthenticated = (data: AuthData) => {
            this.localPlayerNetId = data.playerId;
            this.onNicknameLoaded?.(data.nickname);

            setTimeout(() => {
                if (this.hasRestoredLocation) return;
                this.hasRestoredLocation = true;
                this.restoreResolver?.();
                this.restoreResolver = null;
            }, 800);
        };

        this.networkManager.onInit = (playerIds) => {
            const known = new Set(playerIds);
            const currentLocation = this.locationManager.getCurrentLocation();
            for (const [id, op] of Array.from(this.otherPlayers.entries())) {
                if (known.has(id)) continue;
                if (currentLocation && !op.isHidden()) op.dispose(currentLocation.scene);
                this.otherPlayers.delete(id);
                this.shootingSystem.unregisterOtherPlayer(id);
            }
            this.updateOnlineCount();
        };

        this.networkManager.onPlayerJoin = (data: PlayerJoinData) => {
            if (data.id === this.localPlayerNetId) return;
            const currentLocation = this.locationManager.getCurrentLocation();
            if (!currentLocation) return;
            const playerLocation = data.locationId || 'main-world';
            if (playerLocation !== currentLocation.id) {
                if (!this.otherPlayers.has(data.id)) {
                    const op = new OtherPlayer(data.id, data.nickname);
                    op.setHidden(true);
                    this.otherPlayers.set(data.id, op);
                    this.updateOnlineCount();
                }
                return;
            }
            let op = this.otherPlayers.get(data.id);
            if (!op) {
                op = new OtherPlayer(data.id, data.nickname);
                op.create(currentLocation.scene, this.resourceManager);
                this.otherPlayers.set(data.id, op);
            } else if (op.isHidden()) {
                currentLocation.scene.add(op.mesh);
                currentLocation.scene.add(op.getHitbox());
                op.setHidden(false);
            }
            this.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
            op.updateFromNetwork(data);
            this.updateOnlineCount();
            this.onChatMessage?.({
                id: `system-${Date.now()}`, sender: "System",
                message: `${data.nickname} joined the game`,
                timestamp: Date.now(), type: "system",
            });
        };

        this.networkManager.onPlayerLeave = (playerId: string) => {
            const op = this.otherPlayers.get(playerId);
            if (op) {
                this.onChatMessage?.({
                    id: `system-${Date.now()}`, sender: "System",
                    message: `${op.nickname} left the game`,
                    timestamp: Date.now(), type: "system",
                });
                const currentLocation = this.locationManager.getCurrentLocation();
                if (currentLocation && !op.isHidden()) op.dispose(currentLocation.scene);
                this.otherPlayers.delete(playerId);
                this.shootingSystem.unregisterOtherPlayer(playerId);
                this.updateOnlineCount();
            }
        };

        this.networkManager.onPlayerUpdate = (data: PlayerUpdateData) => {
            const op = this.otherPlayers.get(data.id);
            if (!op || op.isHidden()) return;
            op.updateFromNetwork(data);
        };

        this.networkManager.onShoot = (data: ShootData) => {
            if (data.id === this.localPlayerNetId) return;
            this.shootingSystem.handleNetworkShoot({ origin: data.origin, direction: data.direction });
        };

        this.networkManager.onCount = (count: number) => {
            this.hudState.online = count;
            this.emitState(true);
        };

        this.networkManager.onChatMessage = (data: ChatData) => {
            this.onChatMessage?.({
                id: data.id, sender: data.sender,
                message: data.message, timestamp: data.timestamp, type: "player",
            });
        };

        this.networkManager.onProgressLoaded = (data: ProgressData) => {
            if (data?.nickname) this.onNicknameLoaded?.(data.nickname);

            if (!this.hasRestoredLocation) {
                this.hasRestoredLocation = true;
                this.restoreToSavedProgress(data?.progress);
            }
        };

        this.networkManager.onPlayerDamaged = (data: DamageData) => {
            if (data.attackerId?.startsWith('enemy-')) {
                this.enemySystem.handleEnemyAttack(data.attackerId);
            }

            if (data.targetId === this.localPlayerNetId) {
                this.player.takeDamage(data.damage);
                this.hudState.health = this.player.health;
                this.emitState(true);
                this.damageAttackerId = data.attackerId;
                this.lastDamageTime = Date.now();
                const attacker = this.otherPlayers.get(data.attackerId);
                const enemyAttacker = this.enemySystem.getEnemy(data.attackerId);
                let direction = 0;
                if (attacker && !attacker.isHidden()) {
                    const playerPos = this.player.mesh.position;
                    const attackerPos = attacker.mesh.position;
                    direction = Math.atan2(attackerPos.x - playerPos.x, attackerPos.z - playerPos.z);
                } else if (enemyAttacker) {
                    const playerPos = this.player.mesh.position;
                    const attackerPos = enemyAttacker.mesh.position;
                    direction = Math.atan2(attackerPos.x - playerPos.x, attackerPos.z - playerPos.z);
                } else {
                    direction = this.cameraController.getYaw() + Math.PI;
                }
                this.onDamageEvent?.({
                    id: Date.now() + Math.random(),
                    direction, damage: data.damage, timestamp: Date.now(),
                });
            }
        };

        this.networkManager.onPlayerDeath = (data: DeathData) => {
            if (data.playerId === this.localPlayerNetId) {
                this.isDead = true;
                const killer = this.otherPlayers.get(data.killerId);
                this.killerName = killer?.nickname || (data.killerId.startsWith('enemy-') ? 'Enemy' : 'Unknown');
                this.onDeathStateChange?.(true, this.killerName);
            } else {
                const op = this.otherPlayers.get(data.playerId);
                if (op && !op.isHidden()) {
                    op.setDead(true);
                    this.onChatMessage?.({
                        id: `system-${Date.now()}`, sender: "System",
                        message: `${op.nickname} was eliminated`,
                        timestamp: Date.now(), type: "system",
                    });
                }
            }
        };

        this.networkManager.onPlayerRespawn = (data: PlayerRespawnData) => {
            const op = this.otherPlayers.get(data.id);
            if (op && !op.isHidden()) {
                op.setDead(false);
                op.setHealth(data.health);
                op.updateFromNetwork({
                    position: data.position, rotation: op.mesh.rotation.y,
                    pitch: 0, state: 'idle', alive: true, health: data.health,
                });
            }
        };

        this.networkManager.onRespawn = (data: LocalRespawnData) => {
            this.player.mesh.position.fromArray(data.position);
            this.player.setHealth(data.health);
            this.hudState.health = this.player.health;
            this.emitState(true);
            this.onNotification?.('✨ Respawned!', 2000);
            this.isDead = false;
            this.killerName = null;
            this.onDeathStateChange?.(false, null);
        };

        this.networkManager.onDayNightSync = (data) => {
            this.dayNightConfig = data;
        };

        this.networkManager.onEnemyState = (list) => {
            this.enemySystem.handleEnemyState(list);
        };

        this.networkManager.onEnemyDamaged = (data) => {
            this.enemySystem.handleEnemyDamaged(data);
        };

        this.networkManager.onEnemyDeath = (data) => {
            this.enemySystem.handleEnemyDeath(data);
        };

        this.networkManager.onEnemyRespawn = (data) => {
            this.enemySystem.handleEnemyRespawn(data);
        };

        this.networkManager.onLootState = (list) => {
            this.lootSystem.handleLootState(list);
        };

        this.networkManager.onLootSpawn = (data) => {
            this.lootSystem.handleLootSpawn(data);
        };

        this.networkManager.onLootDespawn = (id) => {
            this.lootSystem.handleLootDespawn(id);
        };

        this.networkManager.onInventoryUpdate = ({ inventory, ash }) => {
            this.inventory = inventory;
            this.ash = ash;
            this.onInventoryChange?.(inventory, ash);
        };

        this.networkManager.onSellResult = (data) => {
            this.onSellResult?.(data);
            this.onNotification?.(`💨 Sold ${data.quantitySold}x for ${data.ashEarned} ash`, 2500);
        };

        this.networkManager.onServerError = (message) => {
            this.onNotification?.(`⚠️ ${message}`, 2500);
        };
    }

    private updateOnlineCount() {
        let visibleCount = 1;
        this.otherPlayers.forEach((op) => { if (!op.isHidden()) visibleCount++; });
        this.hudState.online = visibleCount;
        this.emitState(true);
    }

    private emitState(force: boolean = false) {
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
            this.updateDamageIndicator();
            this.player.update(delta);
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
        this.hudState.isWeaponEquipped = equipped;
        this.player.setWeaponVisible(equipped);
        this.emitState(true);
    }

    setNickname(nickname: string) {
        this.networkManager.setNickname(nickname);
    }

    sendChatMessage(message: string) {
        this.networkManager.sendChatMessage(message);
    }

    sellToken(address: string, quantity?: number) {
        this.networkManager.sendSellToken(address, quantity);
    }

    getInventory(): InventoryEntry[] {
        return this.inventory;
    }

    public teleportToTower() {
        const currentLocation = this.locationManager.getCurrentLocation();
        if (!currentLocation) return;

        if (currentLocation.id !== 'tower-main-hall') {
            this.changeLocation('tower-main-hall').then(() => {
                this.onNotification?.("🗼 Teleported to Tower Main Hall", 2500);
            });
            return;
        }

        this.onNotification?.("🗼 You are already in the Tower Main Hall", 2500);
    }

    public teleportToSafeZone() {
        const currentLocation = this.locationManager.getCurrentLocation();
        if (!currentLocation) return;

        if (currentLocation.id !== 'tower-main-hall') {
            this.changeLocation('tower-main-hall').then(() => {
                const hall = this.locationManager.getCurrentLocation();
                if (hall) {
                    const safePoint = hall.getSpawnPoint();
                    this.player.teleportTo(safePoint);
                    this.cameraController.yawObject.position.copy(safePoint);
                    this.networkManager.sendPlayerUpdate({
                        position: safePoint.toArray(),
                        rotation: this.player.mesh.rotation.y,
                        pitch: this.cameraController.getPitch(),
                        state: 'idle', jumping: false, velocityY: 0,
                        weaponEquipped: this.hudState.isWeaponEquipped, isShooting: false,
                    });
                    this.onNotification?.("🛡️ Teleported to Safe Zone", 2500);
                }
            });
            return;
        }

        const safePoint = currentLocation.getSpawnPoint();
        this.player.teleportTo(safePoint);
        this.cameraController.yawObject.position.copy(safePoint);

        if (this.isDead) {
            this.isDead = false;
            this.killerName = null;
            this.onDeathStateChange?.(false, null);
        }

        this.networkManager.sendPlayerUpdate({
            position: safePoint.toArray(),
            rotation: this.player.mesh.rotation.y,
            pitch: this.cameraController.getPitch(),
            state: 'idle', jumping: false, velocityY: 0,
            weaponEquipped: this.hudState.isWeaponEquipped, isShooting: false,
        });

        this.onNotification?.("🛡️ Teleported to Safe Zone", 2500);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
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

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            this.otherPlayers.forEach((op) => {
                if (!op.isHidden()) op.dispose(currentLocation.scene);
            });
            this.player.dispose(currentLocation.scene);
        }

        this.otherPlayers.clear();
        this.locationManager.dispose();
        this.renderer.dispose();
    }
}