//src\features\game\core\Game.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CameraController } from "./CameraController";
import { ResourceManager } from "./ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";
import { SafeZone } from "../world/SafeZone";
import { ShootingSystem } from "../systems/ShootingSystem";
import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { NetworkSystem } from "../systems/NetworkSystem";
import { ChatMessage } from "../ui/Chat";
import { LocationManager } from "../world/LocationManager";
import { MainWorld } from "../world/locations/MainWorld";

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
}

export interface DamageEvent {
    id: number;
    direction: number;
    damage: number;
    timestamp: number;
}

export class Game {
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
    private locationManager: LocationManager;

    private isDead: boolean = false;
    private killerName: string | null = null;

    private damageAttackerId: string | null = null;
    private lastDamageTime: number = 0;
    private readonly DAMAGE_INDICATOR_DURATION = 2000;

    private isLoaded: boolean = false;
    private animationFrameId: number | null = null;
    private frameCount: number = 0;

    private localPlayerNetId: string | null = null;

    private hudState: HUDState = {
        health: 100,
        maxHealth: 100,
        ammo: 30,
        maxAmmo: 30,
        reserve: 90,
        online: 1,
        inSafeZone: true,
        prompt: null,
    };

    private lastStateEmit: number = 0;
    private stateEmitInterval: number = 100;

    private updateDamageIndicator() {
        if (this.damageAttackerId === null) {
            return;
        }

        const timeSinceDamage = Date.now() - this.lastDamageTime;
        if (timeSinceDamage > this.DAMAGE_INDICATOR_DURATION) {
            this.damageAttackerId = null;
            this.onDamageIndicatorUpdate?.(null, 0);
            return;
        }

        const attacker = this.otherPlayers.get(this.damageAttackerId);
        if (!attacker || attacker.isDead()) {
            this.damageAttackerId = null;
            this.onDamageIndicatorUpdate?.(null, 0);
            return;
        }

        const playerPos = this.player.mesh.position;
        const attackerPos = attacker.mesh.position;
        const dx = attackerPos.x - playerPos.x;
        const dz = attackerPos.z - playerPos.z;
        const worldAngle = Math.atan2(dx, dz);

        const cameraYaw = this.cameraController.getYaw();

        let relativeAngle = worldAngle - cameraYaw;

        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;


        this.onDamageIndicatorUpdate?.(this.damageAttackerId, relativeAngle);
    }

    public onStateChange?: (state: HUDState) => void;
    public onNotification?: (msg: string, duration?: number) => void;
    public onLoadStateChange?: (loading: boolean) => void;
    public onChatMessage?: (message: ChatMessage) => void;
    public onNicknameLoaded?: (nickname: string) => void;
    public onDamageEvent?: (event: DamageEvent) => void;
    public onDeathStateChange?: (isDead: boolean, killerName: string | null) => void;

    public onDamageIndicatorUpdate?: (attackerId: string | null, direction: number) => void;

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
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        this.timer = new THREE.Timer();
        this.inputManager = new InputManager(canvas);
        this.cameraController = new CameraController();
        this.resourceManager = new ResourceManager();
        this.networkManager = new NetworkManager();
        this.locationManager = new LocationManager(this.renderer, this.cameraController.camera);
        this.player = new Player();
        this.safeZone = new SafeZone();
        this.shootingSystem = new ShootingSystem();
        this.safeZoneSystem = new SafeZoneSystem();
        this.interactionSystem = new InteractionSystem();
        this.networkSystem = new NetworkSystem(this.networkManager);
    }

    async init() {
        this.onLoadStateChange?.(true);

        await this.resourceManager.loadAll();
        this.locationManager.registerLocations(this.resourceManager);

        const currentLocation = await this.locationManager.loadLocation("main-world");

        if (!currentLocation) {
            throw new Error("Failed to load main-world location");
        }

        this.locationManager.onLocationChange = (id: string) => {
            this.onNotification?.(`📍 Entered: ${id}`, 2000);
        };

        this.player.create(currentLocation.scene, this.resourceManager);
        this.player.setDependencies(this.inputManager, this.cameraController, currentLocation.colliders);

        if (currentLocation instanceof MainWorld) {
            this.player.setTerrain(currentLocation.terrain);
        }

        currentLocation.scene.add(this.cameraController.yawObject);
        this.cameraController.setTarget(this.player.mesh);

        this.safeZone.create(currentLocation.scene, this.resourceManager);

        this.shootingSystem.init(
            currentLocation.scene,
            this.player,
            this.inputManager,
            this.cameraController,
            this.resourceManager,
            this.networkManager,
            this.otherPlayers,
            currentLocation
        );

        this.safeZoneSystem.init(this.safeZone);
        this.interactionSystem.init(currentLocation.scene, this.player, this.inputManager, this.safeZone);
        this.networkSystem.init();

        this.interactionSystem.registerInteractable(this.safeZone.getInteractableObject());

        this.interactionSystem.onNotification = (msg, duration) => {
            this.onNotification?.(msg, duration);
        };
        this.interactionSystem.onPrompt = (text) => {
            this.hudState.prompt = text;
            this.emitState(true);
        };

        this.setupNetwork();

        this.isLoaded = true;
        this.onLoadStateChange?.(false);
        this.emitState(true);

        this.animate();

        window.addEventListener("resize", this.handleResize);
        window.addEventListener("orientationchange", this.handleResize);
    }

    private setupNetwork() {
        this.networkManager.connect(this.session);

        this.networkManager.onAuthenticated = (data) => {
            this.localPlayerNetId = data.playerId;
            this.onNicknameLoaded?.(data.nickname);
        };

        this.networkManager.onPlayerJoin = (data) => {
            if (data.id === this.localPlayerNetId) return;

            const currentLocation = this.locationManager.getCurrentLocation();
            if (!currentLocation) return;

            const op = new OtherPlayer(data.id, data.nickname);
            op.create(currentLocation.scene, this.resourceManager);
            op.updateFromNetwork(data);
            this.otherPlayers.set(data.id, op);
            this.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
            this.hudState.online = this.otherPlayers.size + 1;
            this.emitState(true);

            this.onChatMessage?.({
                id: `system-${Date.now()}`,
                sender: "System",
                message: `${data.nickname} joined the game`,
                timestamp: Date.now(),
                type: "system",
            });
        };

        this.networkManager.onPlayerLeave = (playerId) => {
            const op = this.otherPlayers.get(playerId);
            if (op) {
                this.onChatMessage?.({
                    id: `system-${Date.now()}`,
                    sender: "System",
                    message: `${op.nickname} left the game`,
                    timestamp: Date.now(),
                    type: "system",
                });

                const currentLocation = this.locationManager.getCurrentLocation();
                if (currentLocation) {
                    op.dispose(currentLocation.scene);
                }

                this.otherPlayers.delete(playerId);
                this.shootingSystem.unregisterOtherPlayer(playerId);
                this.hudState.online = this.otherPlayers.size + 1;
                this.emitState(true);
            }
        };

        this.networkManager.onPlayerUpdate = (data) => {
            const op = this.otherPlayers.get(data.id);
            if (op) op.updateFromNetwork(data);
        };

        this.networkManager.onShoot = (data) => {
            this.shootingSystem.handleNetworkShoot({
                origin: data.origin,
                direction: data.direction,
            });
        };

        this.networkManager.onCount = (count) => {
            this.hudState.online = count;
            this.emitState(true);
        };

        this.networkManager.onChatMessage = (data) => {
            this.onChatMessage?.({
                id: data.id,
                sender: data.sender,
                message: data.message,
                timestamp: data.timestamp,
                type: "player",
            });
        };

        this.networkManager.onProgressLoaded = (data) => {
            if (data?.progress?.position) {
                this.player.mesh.position.fromArray(data.progress.position);
            }

            if (data?.nickname) {
                this.onNicknameLoaded?.(data.nickname);
            }
        };

        this.networkManager.onPlayerDamaged = (data) => {
            if (data.targetId === this.localPlayerNetId) {
                this.player.takeDamage(data.damage);
                this.hudState.health = this.player.health;
                this.emitState(true);

                this.damageAttackerId = data.attackerId;
                this.lastDamageTime = Date.now();


                if (!this.isDead) {

                }

                const attacker = this.otherPlayers.get(data.attackerId);
                let direction = 0;

                if (attacker) {
                    const playerPos = this.player.mesh.position;
                    const attackerPos = attacker.mesh.position;
                    direction = Math.atan2(
                        attackerPos.x - playerPos.x,
                        attackerPos.z - playerPos.z
                    );
                } else {
                    direction = this.cameraController.getYaw() + Math.PI;
                }

                this.onDamageEvent?.({
                    id: Date.now() + Math.random(),
                    direction,
                    damage: data.damage,
                    timestamp: Date.now(),
                });
            }
        };

        this.networkManager.onPlayerDeath = (data) => {
            if (data.playerId === this.localPlayerNetId) {
                this.isDead = true;
                const killer = this.otherPlayers.get(data.killerId);
                this.killerName = killer?.nickname || 'Unknown';
                this.onDeathStateChange?.(true, this.killerName);
            } else {
                const op = this.otherPlayers.get(data.playerId);
                if (op) {
                    op.setDead(true);
                    this.onChatMessage?.({
                        id: `system-${Date.now()}`,
                        sender: "System",
                        message: `${op.nickname} was eliminated`,
                        timestamp: Date.now(),
                        type: "system",
                    });
                }
            }
        };

        this.networkManager.onPlayerRespawn = (data) => {
            const op = this.otherPlayers.get(data.id);
            if (op) {
                op.setDead(false);
                op.setHealth(data.health);
                op.updateFromNetwork({
                    position: data.position,
                    rotation: op.mesh.rotation.y,
                    pitch: 0,
                    state: 'idle',
                    alive: true,
                    health: data.health,
                });
            }
        };

        this.networkManager.onRespawn = (data) => {
            this.player.mesh.position.fromArray(data.position);
            this.player.setHealth(data.health);
            this.hudState.health = this.player.health;
            this.emitState(true);
            this.onNotification?.('✨ Respawned!', 2000);

            this.isDead = false;
            this.killerName = null;
            this.onDeathStateChange?.(false, null);
        };
    }

    private emitState(force: boolean = false) {
        const now = performance.now();
        if (!force && now - this.lastStateEmit < this.stateEmitInterval) {
            return;
        }

        this.lastStateEmit = now;

        const ammoState = this.shootingSystem.getAmmoState();
        this.hudState.health = this.player.health;
        this.hudState.ammo = ammoState.ammo;
        this.hudState.maxAmmo = ammoState.maxAmmo;
        this.hudState.reserve = ammoState.reserve;
        this.onStateChange?.({ ...this.hudState });
    }

    private animate = async () => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        if (!this.isLoaded) {
            this.locationManager.render();
            return;
        }

        this.frameCount++;

        const portal = this.locationManager.checkPortals(this.player.mesh.position);
        if (portal) {
            this.interactionSystem.onPrompt?.(`[E] Enter ${portal.targetLocationId}`);
            if (this.inputManager.isKeyJustPressed("KeyE")) {
                await this.locationManager.teleportTo(portal, this.player);
            }
        }

        this.timer.update();
        const delta = Math.min(this.timer.getDelta(), 0.1);

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            this.updateDamageIndicator();
            this.player.update(delta);
            this.cameraController.update(delta, this.inputManager);

            const inSafe = this.safeZoneSystem.isInSafeZone(this.player.mesh.position);
            if (this.hudState.inSafeZone !== inSafe) {
                this.hudState.inSafeZone = inSafe;
                this.emitState(true);
            }

            if (!inSafe) {
                this.shootingSystem.update(delta);
            } else {
                this.player.getWeapon().update(delta);
            }

            this.interactionSystem.update(delta);
            this.safeZone.update(delta);
            this.networkSystem.update(delta);
            this.otherPlayers.forEach((op) => {
                op.update(delta);
            });

            this.networkManager.sendPlayerUpdate({
                position: this.player.mesh.position.toArray(),
                rotation: this.player.mesh.rotation.y,
                pitch: this.cameraController.getPitch(),
                state: this.player.getState(),
                jumping: this.player.isJumping(),
                velocityY: this.player.getVelocityY(),
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

    setNickname(nickname: string) {
        this.networkManager.setNickname(nickname);
    }

    sendChatMessage(message: string) {
        this.networkManager.sendChatMessage(message);
    }

    dispose() {
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
        this.locationManager.dispose();

        const currentLocation = this.locationManager.getCurrentLocation();
        if (currentLocation) {
            this.otherPlayers.forEach((op) => op.dispose(currentLocation.scene));
            this.player.dispose(currentLocation.scene);
        }

        this.otherPlayers.clear();
        this.renderer.dispose();
    }
}