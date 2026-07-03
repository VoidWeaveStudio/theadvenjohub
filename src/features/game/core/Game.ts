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
        console.log("🎮 [Game] Constructor called");
        console.log("   - Slug:", slug);
        console.log("   - Server URL:", session.serverUrl);
        console.log("   - User ID:", session.userId);

        this.canvas = canvas;
        this.slug = slug;
        this.session = session;

        console.log("🎨 [Game] Creating THREE.Scene...");
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 150, 700);

        console.log("🖥️ [Game] Creating WebGLRenderer...");
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

        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        console.log(`   - Renderer size: ${width}x${height}`);
        console.log(`   - Pixel ratio: ${Math.min(window.devicePixelRatio, 2)}`);

        this.clock = new THREE.Clock();

        console.log("⌨️ [Game] Creating InputManager...");
        this.inputManager = new InputManager(canvas);

        console.log("📷 [Game] Creating CameraController...");
        this.cameraController = new CameraController();

        console.log("📦 [Game] Creating ResourceManager...");
        this.resourceManager = new ResourceManager();

        console.log("🌐 [Game] Creating NetworkManager...");
        this.networkManager = new NetworkManager();

        console.log("🗺️ [Game] Creating LocationManager...");
        this.locationManager = new LocationManager(this.renderer, this.cameraController.camera);

        console.log("👤 [Game] Creating Player...");
        this.player = new Player();

        console.log("🌍 [Game] Creating World...");
        this.world = new World();

        console.log("🛡️ [Game] Creating SafeZone...");
        this.safeZone = new SafeZone();

        console.log("🔫 [Game] Creating systems...");
        this.shootingSystem = new ShootingSystem();
        this.safeZoneSystem = new SafeZoneSystem();
        this.interactionSystem = new InteractionSystem();
        this.networkSystem = new NetworkSystem(this.networkManager);

        this.scene.add(this.cameraController.yawObject);
        console.log("✅ [Game] Constructor complete");
    }

    async init() {
        console.log("🚀 [Game] === STARTING INIT ===");
        this.onLoadStateChange?.(true);

        console.log("📦 [Game] Loading resources...");
        const resourceStart = performance.now();
        await this.resourceManager.loadAll();
        console.log(`✅ [Game] Resources loaded in ${(performance.now() - resourceStart).toFixed(0)}ms`);

        console.log("🗺️ [Game] Registering locations...");
        this.locationManager.registerLocations(this.resourceManager);

        console.log("🌍 [Game] Creating world...");
        const worldStart = performance.now();
        this.world.create(this.scene, this.resourceManager);
        console.log(`✅ [Game] World created in ${(performance.now() - worldStart).toFixed(0)}ms`);

        console.log("🛡️ [Game] Creating safe zone...");
        this.safeZone.create(this.scene, this.resourceManager);

        console.log("👤 [Game] Creating player...");
        this.player.create(this.scene, this.resourceManager);
        this.player.setDependencies(this.inputManager, this.cameraController, this.world.getColliderBoxes());

        console.log("📷 [Game] Setting camera target...");
        this.cameraController.setTarget(this.player.mesh);

        console.log("🗺️ [Game] Loading initial location 'main-world'...");
        const locationStart = performance.now();
        await this.locationManager.loadLocation("main-world");
        console.log(`✅ [Game] Location loaded in ${(performance.now() - locationStart).toFixed(0)}ms`);

        this.locationManager.onLocationChange = (id: string) => {
            console.log(`🗺️ [Game] Location changed to: ${id}`);
            this.onNotification?.(`📍 Entered: ${id}`, 2000);
        };

        console.log("🔫 [Game] Initializing ShootingSystem...");
        this.shootingSystem.init(
            this.scene,
            this.player,
            this.inputManager,
            this.cameraController,
            this.resourceManager,
            this.networkManager
        );

        console.log("🛡️ [Game] Initializing SafeZoneSystem...");
        this.safeZoneSystem.init(this.safeZone);

        console.log("👆 [Game] Initializing InteractionSystem...");
        this.interactionSystem.init(this.scene, this.player, this.inputManager, this.safeZone);

        console.log("🌐 [Game] Initializing NetworkSystem...");
        this.networkSystem.init();

        console.log("🔗 [Game] Registering colliders...");
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
            console.log(`🔒 [Game] Pointer lock state: ${locked}`);
            if (!locked && !this.isPaused) {
                this.setPaused(true);
            } else if (locked && this.isPaused) {
                this.setPaused(false);
            }
        };

        console.log("🌐 [Game] Setting up network...");
        this.setupNetwork();

        this.isLoaded = true;
        this.onLoadStateChange?.(false);
        this.emitState(true);

        console.log("🎬 [Game] Starting animation loop...");
        this.animate();

        console.log("📐 [Game] Attaching resize handler...");
        window.addEventListener("resize", this.handleResize);
        window.addEventListener("orientationchange", this.handleResize);

        console.log("🎉 [Game] === INIT COMPLETE ===");
    }

    private setupNetwork() {
        console.log("🌐 [Game] Connecting to server...");
        this.networkManager.connect(this.session);

        this.networkManager.onPlayerJoin = (data) => {
            console.log(`👥 [Game] Player joined: ${data.nickname} (${data.id})`);
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
            console.log(`👥 [Game] Player left: ${playerId}`);
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

        this.networkManager.onAuthenticated = (data) => {
            console.log(`✅ [Game] Authenticated as: ${data.nickname} (${data.playerId})`);
        };

        this.networkManager.onProgressLoaded = (data) => {
            console.log("💾 [Game] Progress loaded from server:", data);
        };

        this.networkManager.onAuthError = (error) => {
            console.error("❌ [Game] Auth error:", error);
        };

        this.networkManager.onConnected = () => {
            console.log("🔗 [Game] Connected to server");
        };

        this.networkManager.onDisconnected = () => {
            console.log("🔌 [Game] Disconnected from server");
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
                console.log(`🚪 [Game] Teleporting to: ${portal.targetLocationId}`);
                await this.locationManager.teleportTo(portal, this.player);
            }
        }

        const delta = Math.min(this.clock.getDelta(), 0.1);

        if (!this.isPaused) {
            const moveDir = new THREE.Vector3();
            if (this.inputManager.isKeyPressed("KeyW")) moveDir.z -= 1;
            if (this.inputManager.isKeyPressed("KeyS")) moveDir.z += 1;
            if (this.inputManager.isKeyPressed("KeyA")) moveDir.x -= 1;
            if (this.inputManager.isKeyPressed("KeyD")) moveDir.x += 1;

            if (moveDir.lengthSq() > 0 && Math.random() < 0.01) {
                console.log(`🚶 [Game] Moving: ${moveDir.toArray().map(v => v.toFixed(2)).join(', ')}`);
            }

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
        const container = this.canvas.parentElement;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;

        console.log(`📐 [Game] Resize: ${width}x${height}`);

        this.cameraController.resize(width, height);

        this.renderer.setSize(width, height, false);

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    };

    setPaused(paused: boolean) {
        console.log(`⏸️ [Game] Paused: ${paused}`);
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
        console.log("🧹 [Game] Disposing...");
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
        this.world.dispose();
        this.otherPlayers.forEach((op) => op.dispose(this.scene));
        this.otherPlayers.clear();
        this.player.dispose(this.scene);
        this.renderer.dispose();
        this.scene.clear();
        console.log("✅ [Game] Disposed");
    }
}