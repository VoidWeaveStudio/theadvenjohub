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
import { CavePortalSystem } from "./systems/CavePortalSystem";
import { GrassField } from "./systems/GrassField";
import { RippleSimulation } from "./systems/RippleSimulation";
import { TreeScatterSystem } from "./systems/TreeScatterSystem";
import { WorldLighting } from "./utils/worldLighting";
import { HarborSystem } from "./systems/HarborSystem";
import { PLAY_RADIUS, SAFE_ZONE_RADIUS, SEA_LEVEL, WORLD_SIZE } from "./worldConfig";

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
  public cavePortal: CavePortalSystem;
  public harbor: HarborSystem;
  public grass: GrassField;
  public ripples: RippleSimulation | null = null;
  public trees: TreeScatterSystem;
  public readonly lighting = new WorldLighting();

  private crystal: LiftCrystal | null = null;
  private crystalBaseY = 0;
  private staticColliders: THREE.Box3[] = [];
  private time = 0;
  private static readonly _sunDirection = new THREE.Vector3(0.4, 0.8, 0.3);
  private static readonly _cameraWorld = new THREE.Vector3();
  private readonly lastWaterPosition = new THREE.Vector3();
  private wasInWater = false;
  private strokeTimer = 0;

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
    this.cavePortal = new CavePortalSystem(this.scene, this.terrain);
    this.harbor = new HarborSystem(this.scene, this.terrain, this.isLowEnd);
    this.grass = new GrassField(this.scene, this.terrain, this.lighting, this.isLowEnd);
    this.trees = new TreeScatterSystem(this.scene, this.terrain, this.isLowEnd);

    this.waterProvider = (x, z) => this.water.getWaterHeightAt(x, z);
  }

  create(rm: ResourceManager) {
    this.atmosphere.init();
    this.atmosphere.createLighting(this.isLowEnd);

    const spawn = this.getSpawnPoint();
    this.terrain.update(spawn.x, spawn.z);

    if (this.renderer) {
      this.terrain.setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    }

    this.water.create();

    if (this.renderer) {
      const bed = this.water.getDepthMap();
      const floatTargets =
        this.renderer.extensions.has("EXT_color_buffer_float") ||
        this.renderer.extensions.has("EXT_color_buffer_half_float");

      if (bed && floatTargets) {
        this.ripples = new RippleSimulation(this.renderer, bed, SEA_LEVEL, 90, 256);
        this.water.setRippleField(this.ripples.texture, this.ripples.bounds);
      }
    }
    this.rockRing.create();
    this.harbor.create();
    this.grass.create(this.renderer);
    this.trees.create();
    this.trees.onCollidersChanged = () => this.rebuildColliders();

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

    this.terrain.onChunksChanged = () => this.rebuildCameraColliders();


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


    for (const collider of this.harbor.getColliders()) {
      this.collisionGrid.insert(collider);
    }

    for (const collider of this.trees.getColliders()) {
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
    this.water.update(delta);
    this.updateRipples(delta, playerPosition);
    this.trees.update(delta, playerPosition.x, playerPosition.z);
    this.harbor.update(delta);
    this.cavePortal.update(delta);

    if (this.atmosphere.sun) {
      this.water.setSunDirection(
        MainWorld._sunDirection.copy(this.atmosphere.sun.position).normalize()
      );
    }

    this.atmosphere.update(delta, playerPosition, dayTime);
    this.features.update(delta, playerPosition, isEPressed ?? false);

    if (this.camera) {
      this.camera.getWorldPosition(MainWorld._cameraWorld);

      if (this.atmosphere.sun) {
        MainWorld._sunDirection.copy(this.atmosphere.sun.position).normalize();
      }

      this.lighting.update(delta, MainWorld._sunDirection, MainWorld._cameraWorld);
      this.lighting.applyToScene(this.scene, this.atmosphere.hemisphere, this.atmosphere.sun);
      this.grass.update(delta, this.camera, playerPosition);
    }

    if (this.crystal) {
      this.crystal.update(delta);
      this.crystal.group.position.y = this.crystalBaseY + Math.sin(this.time * 1.5) * 0.2;
    }
  }

  private updateRipples(delta: number, playerPosition: THREE.Vector3) {
    const simulation = this.ripples;
    if (!simulation) return;

    simulation.recenter(playerPosition.x, playerPosition.z);

    const waterLevel = this.water.getWaterHeightAt(playerPosition.x, playerPosition.z);
    const inWater = waterLevel !== null && playerPosition.y < waterLevel + 0.6;

    const moveX = playerPosition.x - this.lastWaterPosition.x;
    const moveZ = playerPosition.z - this.lastWaterPosition.z;
    const speed = Math.hypot(moveX, moveZ) / Math.max(delta, 1e-4);

    if (inWater) {
      if (!this.wasInWater) {
        simulation.addDrop(playerPosition.x, playerPosition.z, 2.6, 0.85);
        this.strokeTimer = 0;
      }

      this.strokeTimer -= delta;
      if (this.strokeTimer <= 0 && speed > 0.4) {
        const length = Math.hypot(moveX, moveZ) || 1;
        simulation.addDrop(
          playerPosition.x,
          playerPosition.z,
          1.5 + Math.min(speed, 6) * 0.12,
          0.16 + Math.min(speed, 6) * 0.035,
          moveX / length,
          moveZ / length
        );
        this.strokeTimer = 0.28;
      }
    } else if (this.wasInWater) {
      simulation.addDrop(playerPosition.x, playerPosition.z, 2.2, 0.6);
    }

    this.wasInWater = inWater;
    this.lastWaterPosition.copy(playerPosition);

    simulation.step(delta);
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

  public override async whenReady() {
  }

  dispose() {
    this.rockRing.dispose();
    this.harbor.dispose();
    this.grass.dispose();
    this.trees.dispose();
    this.ripples?.dispose();
    this.ripples = null;
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
