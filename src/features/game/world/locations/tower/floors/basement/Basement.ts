// src/features/game/world/locations/tower/floors/basement/Basement.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { createFallbackCoinTexture } from "./utils/meshFactory";
import { BasementEnvironmentSystem } from "./systems/BasementEnvironmentSystem";
import { CoinFeedSystem } from "./systems/CoinFeedSystem";
import { TokenColumnSystem } from "./systems/TokenColumnSystem";

export type { MemeToken } from "./systems/CoinFeedSystem";

export class Basement extends TowerFloor {
    public maxPlayerRadius = 40;

    public readonly HOLE_Y = 18.5;
    public readonly SINK_Y = -5;

    public readonly textureCache = new Map<string, THREE.Texture>();
    public readonly textureLoader = new THREE.TextureLoader();

    public readonly environment: BasementEnvironmentSystem;
    public readonly coinFeed: CoinFeedSystem;
    public readonly columns: TokenColumnSystem;

    constructor() {
        super("tower-basement", "Gloomy Tower Basement");
        this.textureCache.set('fallback', createFallbackCoinTexture());

        this.environment = new BasementEnvironmentSystem(this);
        this.coinFeed = new CoinFeedSystem(this);
        this.columns = new TokenColumnSystem(this);
    }

    public applyTextureFilters(texture: THREE.Texture) {
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
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.columns.update(delta);
        this.environment.update(delta);
        this.coinFeed.update(delta);
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 8);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables: THREE.Object3D[] = [];
        if (this.environment.basementCrystal) interactables.push(this.environment.basementCrystal);
        interactables.push(...this.columns.columns.map(c => c.group));
        return interactables;
    }

    dispose() {
        this.columns.dispose();
        this.coinFeed.dispose();
        this.environment.dispose();

        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
        super.dispose();
    }
}
