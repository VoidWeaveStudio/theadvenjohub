// src/features/game/world/locations/main-world/MainWorld.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { LiftCrystal } from "../../liftCrystal";

import { AtmosphereSystem } from "./systems/AtmosphereSystem";
import { FeatureSystem } from "./systems/FeatureSystem";
import { TerrainSystem } from "./systems/TerrainSystem";
import { WaterSystem } from "./systems/WaterSystem";
import { RockRingSystem } from "./systems/RockRingSystem";
import { ScatterSystem } from "./systems/ScatterSystem";
import { GrassSystem } from "./systems/GrassSystem";
import { CavePortalSystem } from "./systems/CavePortalSystem";
import { PLAY_RADIUS, SAFE_ZONE_RADIUS, WORLD_SIZE } from "./worldConfig";

export class MainWorld extends Location {
  public readonly size = WORLD_SIZE;
  public terrain: TerrainSystem;
  public collisionGrid: CollisionGrid;
  public terrainCollisionGrid: CollisionGrid;
  public maxPlayerRadius = PLAY_RADIUS;

  public atmosphere: AtmosphereSystem;
  public features: FeatureSystem;
  public water: WaterSystem;
  public rockRing: RockRingSystem;
  public scatter: ScatterSystem;
  public grass: GrassSystem;
  public cavePortal: CavePortalSystem;

  private crystal: LiftCrystal | null = null;
  private crystalBaseY = 0;
  private staticColliders: THREE.Box3[] = [];
  private time = 0;

  private readonly isLowEnd = (typeof navigator !== "undefined" && navigator.hardwareConcurrency != null)
    ? navigator.hardwareConcurrency <= 4
    : false;

  constructor() {
    super("main-world", "TANJO World");

    this.collisionGrid = new CollisionGrid(20);
    this.terrainCollisionGrid = new CollisionGrid(100);
    this.cameraCollisionGrid = this.terrainCollisionGrid;

    this.terrain = new TerrainSystem(this.scene);
    this.atmosphere = new AtmosphereSystem(this);
    this.features = new FeatureSystem(this);
    this.water = new WaterSystem(this.scene, this.terrain);
    this.rockRing = new RockRingSystem(this.scene, this.terrain);
    this.scatter = new ScatterSystem(this.scene, this.terrain, this.isLowEnd);
    this.grass = new GrassSystem(this.scene, this.terrain, this.isLowEnd);
    this.cavePortal = new CavePortalSystem(this.scene, this.terrain);

    this.waterProvider = (x, z) => this.water.getWaterHeightAt(x, z);
  }

  create(_rm: ResourceManager) {
    this.atmosphere.init();
    this.atmosphere.createLighting(this.isLowEnd);

    const spawn = this.getSpawnPoint();
    this.terrain.update(spawn.x, spawn.z);

    this.water.create();
    this.rockRing.create();
    this.scatter.create();
    this.grass.create();

    this.features.createGloomyTower();
    this.createLiftCrystal();

    const portal = this.cavePortal.create();
    this.addPortal({
      id: "main-to-cave",
      position: this.cavePortal.position.clone(),
      radius: 3.4,
      targetLocationId: "cave",
      targetSpawnPoint: new THREE.Vector3(0, 0, 0),
      mesh: portal,
    });

    this.buildStaticColliders();

    this.scatter.onCollidersChanged = () => this.rebuildColliders();
    this.terrain.onChunksChanged = () => this.rebuildCameraColliders();

    this.scatter.update(spawn.x, spawn.z);
    this.grass.update(0, spawn.x, spawn.z);

    this.rebuildColliders();
    this.rebuildCameraColliders();
  }

  private createLiftCrystal() {
    this.crystal = new LiftCrystal();

    const groundY = this.terrain.getHeightAt(0, 0);
    this.crystal.group.position.set(0, groundY, 0);
    this.crystal.group.userData.interactionId = "tower-crystal";
    this.crystalBaseY = groundY;

    this.scene.add(this.crystal.group);
  }

  private buildStaticColliders() {
    this.staticColliders = [
      new THREE.Box3(
        new THREE.Vector3(-1, this.crystalBaseY, -1),
        new THREE.Vector3(1, this.crystalBaseY + 3, 1)
      ),
    ];
  }

  private rebuildColliders() {
    this.collisionGrid.clear();

    for (const collider of this.staticColliders) {
      this.collisionGrid.insert(collider);
    }

    for (const collider of this.scatter.getColliders()) {
      this.collisionGrid.insert(collider);
    }
  }

  private rebuildCameraColliders() {
    this.terrainCollisionGrid.clear();

    for (const collider of this.colliders) {
      this.terrainCollisionGrid.insert(collider);
    }

    for (const collider of this.terrain.getCameraColliders()) {
      this.terrainCollisionGrid.insert(collider);
    }
  }

  public update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean, dayTime?: number) {
    this.time += delta;

    const distance = Math.hypot(playerPosition.x, playerPosition.z);
    if (distance > PLAY_RADIUS) {
      const scale = PLAY_RADIUS / distance;
      playerPosition.x *= scale;
      playerPosition.z *= scale;
    }

    this.terrain.update(playerPosition.x, playerPosition.z);
    this.scatter.update(playerPosition.x, playerPosition.z);
    this.grass.update(delta, playerPosition.x, playerPosition.z);
    this.water.update(delta);
    this.cavePortal.update(delta);

    this.atmosphere.update(delta, playerPosition, dayTime);
    this.features.update(delta, playerPosition, isEPressed ?? false);

    if (this.crystal) {
      this.crystal.update(delta);
      this.crystal.group.position.y = this.crystalBaseY + Math.sin(this.time * 1.5) * 0.2;
    }
  }

  public getInteractables(): THREE.Object3D[] {
    return this.crystal ? [this.crystal.group] : [];
  }

  public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
    const toPortal = Math.hypot(
      playerPosition.x - this.cavePortal.position.x,
      playerPosition.z - this.cavePortal.position.z
    );
    if (toPortal < 6) return "Step into the rift to descend";

    return this.features.getInteractionPrompt(playerPosition);
  }

  getSpawnPoint(): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const radius = SAFE_ZONE_RADIUS * (0.3 + Math.random() * 0.5);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return new THREE.Vector3(x, this.terrain.getHeightAt(x, z), z);
  }

  dispose() {
    this.grass.dispose();
    this.scatter.dispose();
    this.rockRing.dispose();
    this.water.dispose();
    this.cavePortal.dispose();
    this.terrain.dispose();
    this.atmosphere.dispose();
    this.features.dispose();
    this.crystal?.dispose();
    this.crystal = null;

    this.collisionGrid.clear();
    this.terrainCollisionGrid.clear();

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }
}
