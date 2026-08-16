// src/features/game/world/locations/main-world/MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../../Location";
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
import { UndergrowthSystem } from "./systems/UndergrowthSystem";
import { WaterAmbienceSystem } from "./systems/WaterAmbienceSystem";
import { WorldLighting } from "./utils/worldLighting";
import { HarborSystem } from "./systems/HarborSystem";
import { RampartSystem } from "./systems/RampartSystem";
import { HoloTerminalSystem } from "./systems/HoloTerminalSystem";
import { FogCurtainSystem } from "./systems/FogCurtainSystem";
import type { WorldStatusData } from "../../../network/NetworkManager";
import { applyRadialFogAll } from "./utils/radialFog";
import {
  COVE_CENTER_RADIUS,
  PLAY_RADIUS,
  RAMPART_FOG_FAR,
  RAMPART_FOG_NEAR,
  RAMPART_VISIBLE_MARGIN,
  RING_INNER,
  SAFE_ZONE_RADIUS,
  SEA_LEVEL,
  TOWER_FLAT_RADIUS,
  TOWER_X,
  WORLD_SIZE,
} from "./worldConfig";

const HARBOR_ANCHOR_RADIUS = COVE_CENTER_RADIUS - 152;

const RAMPART_STAND_MARGIN = 1;

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
  public rampart: RampartSystem;
  public holoTerminal: HoloTerminalSystem;
  public fogCurtain: FogCurtainSystem;
  public grass: GrassField;
  public ripples: RippleSimulation | null = null;
  public trees: TreeScatterSystem;
  public undergrowth: UndergrowthSystem;
  private waterAmbience: WaterAmbienceSystem;
  public readonly lighting = new WorldLighting();

  private crystal: LiftCrystal | null = null;
  private cavePortalMesh: THREE.Object3D | null = null;
  private cavePortalEntry: Portal | null = null;
  private crystalBaseY = 0;
  private staticColliders: THREE.Box3[] = [];
  private solidPillars: { x: number; y: number; z: number; radius: number; height: number }[] = [];
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
    this.water = new WaterSystem(this.scene, this.terrain, this.lighting);
    this.rockRing = new RockRingSystem(this.scene, this.terrain);
    this.cavePortal = new CavePortalSystem(this.scene, this.terrain);
    this.harbor = new HarborSystem(this.scene, this.terrain, this.isLowEnd);
    this.rampart = new RampartSystem(this.scene, this.terrain, this.lighting.uniforms);
    this.holoTerminal = new HoloTerminalSystem(this.scene, this.terrain);
    this.fogCurtain = new FogCurtainSystem(this.scene, this.terrain, this.lighting.uniforms.uFogColor.value);
    this.grass = new GrassField(this.scene, this.terrain, this.lighting, this.isLowEnd);
    this.trees = new TreeScatterSystem(this.scene, this.terrain, this.isLowEnd);
    this.undergrowth = new UndergrowthSystem(this.scene, this.terrain, this.isLowEnd);
    this.waterAmbience = new WaterAmbienceSystem(this.terrain);

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
    this.undergrowth.create();
    this.trees.onCollidersChanged = () => this.rebuildColliders();
    this.undergrowth.onCollidersChanged = () => this.rebuildColliders();

    this.features.createGloomyTower();
    this.createLiftCrystal();
    this.holoTerminal.create();

    this.cavePortalMesh = this.cavePortal.create();

    this.buildStaticColliders();

    this.terrain.onChunksChanged = () => this.rebuildCameraColliders();


    this.rebuildColliders();
    this.rebuildCameraColliders();

    applyRadialFogAll(this.scene, this.lighting.uniforms);
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
    const terminal = this.holoTerminal.position;

    this.staticColliders = [
      new THREE.Box3(
        new THREE.Vector3(-1, this.crystalBaseY, -1),
        new THREE.Vector3(1, this.crystalBaseY + 3, 1)
      ),
      new THREE.Box3(
        new THREE.Vector3(terminal.x - 0.9, terminal.y, terminal.z - 0.9),
        new THREE.Vector3(terminal.x + 0.9, terminal.y + 1.6, terminal.z + 0.9)
      ),
    ];
  }

  public applyWorldStatus(status: WorldStatusData | null) {
    this.holoTerminal.setStatus(status);
    this.setWallRadius(status?.radius ?? null);

    const portal = status?.portal;
    this.setCavePortal(portal?.status === "active", portal?.x ?? 0, portal?.z ?? 0);
  }

  private setCavePortal(active: boolean, x: number, z: number) {
    this.cavePortal.setActive(active);
    this.trees.setPortalPosition(active ? x : null, active ? z : null);
    this.undergrowth.setPortalPosition(active ? x : null, active ? z : null);

    if (!active) {
      if (this.cavePortalEntry) {
        this.portals = this.portals.filter((entry) => entry !== this.cavePortalEntry);
        this.cavePortalEntry = null;
      }
      return;
    }

    this.cavePortal.setPosition(x, z);

    if (!this.cavePortalEntry && this.cavePortalMesh) {
      this.cavePortalEntry = {
        id: "main-to-cave",
        position: this.cavePortal.position.clone(),
        radius: 3.4,
        targetLocationId: "cave",
        targetSpawnPoint: new THREE.Vector3(0, 0, 0),
        mesh: this.cavePortalMesh,
      };
      this.portals.push(this.cavePortalEntry);
    }

    this.cavePortalEntry?.position.copy(this.cavePortal.position);
  }

  private setWallRadius(radius: number | null) {
    if (this.rampart.radius === radius) return;

    this.rampart.setRadius(radius);
    this.maxPlayerRadius = radius === null ? PLAY_RADIUS : radius + RAMPART_STAND_MARGIN;

    this.lighting.setRadialFog(
      radius === null ? null : radius + RAMPART_FOG_NEAR,
      radius === null ? null : radius + RAMPART_FOG_FAR
    );

    this.fogCurtain.setRadius(radius === null ? null : radius + RAMPART_FOG_FAR);
    this.setVisibleRadius(radius === null ? null : radius + RAMPART_VISIBLE_MARGIN);

    this.rebuildColliders();
    this.rebuildCameraColliders();
  }

  private setVisibleRadius(radius: number | null) {
    this.terrain.setVisibleRadius(radius);
    this.trees.setVisibleRadius(radius);
    this.undergrowth.setVisibleRadius(radius);
    this.grass.setVisibleRadius(radius);
    this.water.setVisibleRadius(radius);

    const limit = radius ?? Infinity;
    this.rockRing.setVisible(limit >= RING_INNER);
    this.harbor.setVisible(limit >= HARBOR_ANCHOR_RADIUS);
    this.features.setVisible(limit >= TOWER_X - TOWER_FLAT_RADIUS);
  }

  public addSolidPillar(x: number, y: number, z: number, radius: number, height: number) {
    this.solidPillars.push({ x, y, z, radius, height });
    this.rebuildColliders();
  }

  private rebuildColliders() {
    this.collisionGrid.clear();

    for (const collider of this.staticColliders) {
      this.collisionGrid.insert(collider);
    }

    for (const pillar of this.solidPillars) {
      this.collisionGrid.insertCylinder(
        new THREE.Vector3(pillar.x, pillar.y, pillar.z),
        pillar.radius,
        pillar.height
      );
    }


    for (const collider of this.harbor.getColliders()) {
      this.collisionGrid.insert(collider);
    }

    for (const collider of this.undergrowth.getColliders()) {
      this.collisionGrid.insert(collider);
    }

    for (const collider of this.trees.getColliders()) {
      this.collisionGrid.insert(collider);
    }

    this.rampart.applyColliders(this.collisionGrid);
  }

  private rebuildCameraColliders() {
    this.terrainCollisionGrid.clear();

    for (const collider of this.colliders) {
      this.terrainCollisionGrid.insert(collider);
    }

    for (const collider of this.terrain.getCameraColliders()) {
      this.terrainCollisionGrid.insert(collider);
    }

    this.rampart.applyColliders(this.terrainCollisionGrid);
  }

  public update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean, dayTime?: number) {
    this.time += delta;

    const limit = this.maxPlayerRadius ?? PLAY_RADIUS;
    const distance = Math.hypot(playerPosition.x, playerPosition.z);
    if (distance > limit) {
      const scale = limit / distance;
      playerPosition.x *= scale;
      playerPosition.z *= scale;
    }

    this.terrain.update(playerPosition.x, playerPosition.z);
    this.water.update(delta);
    this.updateRipples(delta, playerPosition);
    this.trees.update(delta, playerPosition.x, playerPosition.z);
    this.undergrowth.update(playerPosition.x, playerPosition.z);
    this.waterAmbience.update(delta, playerPosition);
    this.harbor.update(delta);
    this.cavePortal.update(delta);
    this.holoTerminal.update(delta);
    this.fogCurtain.update(delta);

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
    if (this.cavePortalEntry) {
      const toPortal = Math.hypot(
        playerPosition.x - this.cavePortal.position.x,
        playerPosition.z - this.cavePortal.position.z
      );
      if (toPortal < 6) return "Step into the rift to descend";
    }

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
    await this.undergrowth.whenReady();
  }

  dispose() {
    this.rockRing.dispose();
    this.rampart.dispose();
    this.holoTerminal.dispose();
    this.fogCurtain.dispose();
    this.harbor.dispose();
    this.grass.dispose();
    this.trees.dispose();
    this.undergrowth.dispose();
    this.waterAmbience.dispose();
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
