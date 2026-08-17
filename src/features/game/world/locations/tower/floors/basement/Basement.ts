// src/features/game/world/locations/tower/floors/basement/Basement.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { createFallbackCoinTexture } from "./utils/meshFactory";
import { BasementEnvironmentSystem } from "./systems/BasementEnvironmentSystem";
import { CoinFeedSystem } from "./systems/CoinFeedSystem";
import { TokenColumnSystem } from "./systems/TokenColumnSystem";
import { GalaxyBackdrop } from "../token-gates/galaxy/GalaxyBackdrop";
import { PlayerBubbleField } from "../token-gates/galaxy/PlayerBubbleField";
import { FactionBubbleSystem } from "../token-gates/galaxy/FactionBubbleSystem";
import { GALAXY, ORBIT_OMEGA, galaxyOrbitTime, playerBubbleOrbit, orbitPosition } from "../token-gates/galaxy/GalaxyLayout";
import { StewardNpc } from "./systems/StewardNpc";
import { DragonSystem } from "./systems/DragonSystem";
import type { FlightZone, HeightProvider } from "../../../../Location";
import type { FactionGateData } from "../../../../../network/NetworkManager";

export type { MemeToken } from "./systems/CoinFeedSystem";

export const PLATFORM_RADIUS = 90;
export const GALAXY_PLANE_Y = -640;
const PLAYER_CLEARANCE = 2.2;
const ORBIT_LOCK_BAND = 6;

export class Basement extends TowerFloor {
    public maxPlayerRadius: number | null = GALAXY.maxRadius;
    public onInteractablesChanged: ((added: THREE.Object3D[], removed: THREE.Object3D[]) => void) | null = null;

    public readonly HOLE_Y = 37;
    public readonly SINK_Y = -5;

    public readonly textureCache = new Map<string, THREE.Texture>();
    public readonly textureLoader = new THREE.TextureLoader();

    public readonly environment: BasementEnvironmentSystem;
    public readonly coinFeed: CoinFeedSystem;
    public readonly columns: TokenColumnSystem;

    public readonly galaxyRoot: THREE.Group;
    public readonly backdrop: GalaxyBackdrop;
    public readonly bubbles: PlayerBubbleField;
    public readonly factions: FactionBubbleSystem;
    public readonly steward: StewardNpc;
    public readonly dragon: DragonSystem;

    public terrain: HeightProvider;
    public flightZone: FlightZone = {
        center: new THREE.Vector3(0, 0, 0),
        radius: PLATFORM_RADIUS,
        surfaceY: 0,
        maxRadius: GALAXY.maxRadius,
        minY: GALAXY_PLANE_Y - GALAXY.diskThickness * 4,
        maxY: 420,
    };

    private orbitTime = 0;

    private static readonly _local = new THREE.Vector3();
    private static readonly _push = new THREE.Vector3();
    private static readonly _scratch = { x: 0, y: 0, z: 0 };

    constructor() {
        super("tower-basement", "Crypto Universe");
        this.textureCache.set('fallback', createFallbackCoinTexture());

        this.environment = new BasementEnvironmentSystem(this);
        this.coinFeed = new CoinFeedSystem(this);
        this.columns = new TokenColumnSystem(this);

        this.galaxyRoot = new THREE.Group();
        this.galaxyRoot.position.set(0, GALAXY_PLANE_Y, 0);
        this.scene.add(this.galaxyRoot);

        this.backdrop = new GalaxyBackdrop(this.galaxyRoot, {
            withStars: false,
            withBackground: false,
            withLights: false,
        });
        this.bubbles = new PlayerBubbleField(this.galaxyRoot);
        this.factions = new FactionBubbleSystem(this.galaxyRoot);
        this.steward = new StewardNpc(this);
        this.dragon = new DragonSystem(this.scene, PLATFORM_RADIUS);

        this.terrain = {
            getHeightAt: (x, z) => (Math.hypot(x, z) <= PLATFORM_RADIUS ? 0 : -100000),
        };
    }

    public applyTextureFilters(texture: THREE.Texture | undefined | null) {
        if (!texture) return;
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
    }

    create(rm: ResourceManager) {
        this.environment.create(rm);
        this.coinFeed.createOrbitCoins();
        this.columns.createColumns(rm);
        this.columns.startUpdater();
        this.coinFeed.startBackgroundTasks();

        this.backdrop.create();
        this.factions.onInteractablesChanged = (added, removed) => this.onInteractablesChanged?.(added, removed);
        this.factions.start();
        this.steward.create(rm);
    }

    public setAccountCount(count: number) {
        this.bubbles.setCount(count);
    }

    public setOwnBubbleIndex(index: number | null) {
        this.bubbles.setOwnIndex(index);
    }

    public setWaypointIndex(index: number | null) {
        this.bubbles.setWaypointIndex(index);
    }

    public setViewportHeight(height: number) {
        this.bubbles.setViewportHeight(height);
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        this.factions.handleFactionGatesState(list);
    }

    public addLocalGate(data: FactionGateData) {
        this.factions.addLocalGate(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.factions.getFactionGateInfo(factionId);
    }

    public isOnPlatform(position: THREE.Vector3): boolean {
        return Math.hypot(position.x, position.z) <= PLATFORM_RADIUS;
    }

    public getBubbleWorldPosition(index: number, out: THREE.Vector3): THREE.Vector3 {
        orbitPosition(playerBubbleOrbit(index), this.orbitTime, Basement._scratch);
        return out.set(Basement._scratch.x, Basement._scratch.y + GALAXY_PLANE_Y, Basement._scratch.z);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        const previousOrbitTime = this.orbitTime;
        this.orbitTime = galaxyOrbitTime();

        this.columns.update(delta);
        this.environment.update(delta);
        this.coinFeed.update(delta);
        this.steward.update(delta);
        this.dragon.update(delta);

        Basement._local.copy(playerPosition).sub(this.galaxyRoot.position);

        this.backdrop.update(this.orbitTime);
        this.bubbles.update(this.orbitTime, Basement._local);
        this.factions.update(delta, this.orbitTime);

        if (!this.isOnPlatform(playerPosition)) {
            this.resolveBubbleContacts(playerPosition, previousOrbitTime);
        }
    }

    private resolveBubbleContacts(playerPosition: THREE.Vector3, previousOrbitTime: number) {
        const local = Basement._local.copy(playerPosition).sub(this.galaxyRoot.position);
        const push = Basement._push;
        const contacts = this.factions.getContacts().concat(this.bubbles.getNearContacts());

        for (const contact of contacts) {
            push.subVectors(local, contact.position);
            const distance = push.length();
            const clearance = contact.radius + PLAYER_CLEARANCE;
            if (distance >= clearance || distance < 0.0001) continue;

            push.multiplyScalar((clearance - distance) / distance);
            local.add(push);

            if (contact.orbit && distance < clearance + ORBIT_LOCK_BAND) {
                const angleDelta = ORBIT_OMEGA * (this.orbitTime - previousOrbitTime);
                if (Math.abs(angleDelta) > 1e-6 && Math.abs(angleDelta) < 1) {
                    const cos = Math.cos(angleDelta);
                    const sin = Math.sin(angleDelta);
                    const x = local.x;
                    const z = local.z;
                    local.x = x * cos - z * sin;
                    local.z = x * sin + z * cos;
                }
            }
        }

        playerPosition.copy(local).add(this.galaxyRoot.position);
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 0, 14);
    }

    public override async whenReady() {
        await this.columns.whenReady();
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables: THREE.Object3D[] = [];
        if (this.environment.basementCrystal) interactables.push(this.environment.basementCrystal);
        if (this.steward.group) interactables.push(this.steward.group);
        interactables.push(...this.columns.columns.map(c => c.group));
        interactables.push(...this.factions.getInteractables());
        interactables.push(...this.bubbles.getInteractables());
        return interactables;
    }

    dispose() {
        this.dragon.dispose();
        this.steward.dispose();
        this.factions.dispose();
        this.bubbles.dispose();
        this.backdrop.dispose();
        this.scene.remove(this.galaxyRoot);

        this.columns.dispose();
        this.coinFeed.dispose();
        this.environment.dispose();

        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
        super.dispose();
    }
}
