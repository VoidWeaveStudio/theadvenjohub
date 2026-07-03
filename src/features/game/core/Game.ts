//src\features\game\core\Game.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { CameraController } from "./CameraController";
import { ResourceManager } from "./ResourceManager";
import { NetworkManager } from "../network/NetworkManager";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";
import { World } from "../world/World";
import { SafeZone } from "../world/SafeZone";
import { ShootingSystem } from "../systems/ShootingSystem";
import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { NetworkSystem } from "../systems/NetworkSystem";
import { ChatMessage } from "../ui/Chat";
import { LocationManager } from "../world/LocationManager";

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

export class Game {
    private canvas: HTMLCanvasElement;
    private slug: string;
    private scene: THREE.Scene;
    private renderer: THREE.WebGLRenderer;
    private clock: THREE.Clock;

    private session: GameSession;


    private inputManager: InputManager;
    private cameraController: CameraController;
    private resourceManager: ResourceManager;
    private networkManager: NetworkManager;

    private player: Player;
    private otherPlayers: Map<string, OtherPlayer> = new Map();
    private world: World;
    private safeZone: SafeZone;

    private shootingSystem: ShootingSystem;
    private safeZoneSystem: SafeZoneSystem;
    private interactionSystem: InteractionSystem;
    private networkSystem: NetworkSystem;
    private locationManager: LocationManager;

    private isPaused: boolean = false;
    private isLoaded: boolean = false;
    private animationFrameId: number | null = null;

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

    public onStateChange?: (state: HUDState) => void;
    public onNotification?: (msg: string, duration?: number) => void;
    public onLoadStateChange?: (loading: boolean) => void;
    public onChatMessage?: (message: ChatMessage) => void;
    public onNicknameLoaded?: (nickname: string) => void;

    constructor(canvas: HTMLCanvasElement, slug: string, session: GameSession) {
        this.canvas = canvas;
        this.slug = slug;
        this.session = session;
        this.canvas = canvas;
        this.slug = slug;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 150, 700);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.clock = new THREE.Clock();

        this.inputManager = new InputManager(canvas);
        this.cameraController = new CameraController();
        this.resourceManager = new ResourceManager();
        this.networkManager = new NetworkManager();

        this.locationManager = new LocationManager(this.renderer, this.cameraController.camera);

        this.player = new Player();
        this.world = new World();
        this.safeZone = new SafeZone();

        this.shootingSystem = new ShootingSystem();
        this.safeZoneSystem = new SafeZoneSystem();
        this.interactionSystem = new InteractionSystem();
        this.networkSystem = new NetworkSystem(this.networkManager);

        this.scene.add(this.cameraController.yawObject);
    }

    async init() {
        this.onLoadStateChange?.(true);
        await this.resourceManager.loadAll();

        this.locationManager.registerLocations(this.resourceManager);

        this.world.create(this.scene, this.resourceManager);
        this.safeZone.create(this.scene, this.resourceManager);

        this.player.create(this.scene, this.resourceManager);
        this.player.setDependencies(this.inputManager, this.cameraController, this.world.getColliderBoxes());

        this.cameraController.setTarget(this.player.mesh);

        await this.locationManager.loadLocation("main-world");

        this.locationManager.onLocationChange = (id: string) => {
            this.onNotification?.(`📍 Entered: ${id}`, 2000);
        };

        this.shootingSystem.init(
            this.scene,
            this.player,
            this.inputManager,
            this.cameraController,
            this.resourceManager,
            this.networkManager
        );
        this.safeZoneSystem.init(this.safeZone);
        this.interactionSystem.init(this.scene, this.player, this.inputManager, this.safeZone);
        this.networkSystem.init();

        for (const c of this.world.getColliders()) {
            this.shootingSystem.registerCollidable(c.mesh);
        }
        this.interactionSystem.registerInteractable(this.safeZone.getInteractableObject());

        this.interactionSystem.onNotification = (msg, duration) => {
            this.onNotification?.(msg, duration);
        };
        this.interactionSystem.onPrompt = (text) => {
            this.hudState.prompt = text;
            this.emitState(true);
        };

        this.inputManager.onPointerLockStateChange = (locked) => {
            if (!locked && !this.isPaused) {
                this.setPaused(true);
            } else if (locked && this.isPaused) {
                this.setPaused(false);
            }
        };

        this.setupNetwork();
        this.isLoaded = true;
        this.onLoadStateChange?.(false);
        this.emitState(true);
        this.animate();

        window.addEventListener("resize", this.handleResize);
    }

    private setupNetwork() {
        this.networkManager.connect(this.session);

        this.networkManager.onPlayerJoin = (data) => {
            const op = new OtherPlayer(data.id, data.nickname);
            op.create(this.scene, this.resourceManager);
            op.updateFromNetwork(data);
            this.otherPlayers.set(data.id, op);
            this.shootingSystem.registerOtherPlayer(data.id, op.mesh);
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

                op.dispose(this.scene);
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

        const portal = this.locationManager.checkPortals(this.player.mesh.position);
        if (portal) {
            this.interactionSystem.onPrompt?.(`[E] Enter ${portal.targetLocationId}`);
            if (this.inputManager.isKeyJustPressed("KeyE")) {
                await this.locationManager.teleportTo(portal, this.player);
            }
        }

        const delta = Math.min(this.clock.getDelta(), 0.1);

        if (!this.isPaused) {
            const colliders = this.world.getColliderBoxes();
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
            this.networkSystem.update(delta);
            this.otherPlayers.forEach((op) => op.update(delta));

            this.networkManager.sendPlayerUpdate({
                position: this.player.mesh.position.toArray(),
                rotation: this.player.mesh.rotation.y,
                pitch: this.cameraController.getPitch(),
                animation: "idle",
            });

            this.emitState(false);
        }

        this.locationManager.render();
    };

    private handleResize = () => {
        this.cameraController.resize(window.innerWidth, window.innerHeight);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    setPaused(paused: boolean) {
        this.isPaused = paused;
        this.inputManager.setEnabled(!paused);
        if (paused && document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    setNickname(nickname: string) {
        this.networkManager.setNickname(nickname);
    }

    sendChatMessage(message: string) {
        this.networkManager.sendChatMessage(message);
    }

    getWorld(): World {
        return this.world;
    }

    dispose() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        window.removeEventListener("resize", this.handleResize);
        this.networkManager.disconnect();
        this.inputManager.dispose();
        this.safeZone.dispose();
        this.shootingSystem.dispose();
        this.networkSystem.dispose();
        this.locationManager.dispose();
        this.world.dispose();
        this.otherPlayers.forEach((op) => op.dispose(this.scene));
        this.otherPlayers.clear();
        this.player.dispose(this.scene);
        this.renderer.dispose();
        this.scene.clear();
    }
}