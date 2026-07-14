//src\features\game\world\locations\main-world\MainWorld.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { TerrainChunkManager } from "../../TerrainChunkManager";
import { GridSystem } from "../../GridSystem";
import { CollisionGrid } from "../../CollisionGrid";

import { AtmosphereSystem } from "./systems/AtmosphereSystem";
import { VegetationSystem } from "./systems/VegetationSystem";
import { FeatureSystem } from "./systems/FeatureSystem";
import { PortalSystem } from "./systems/PortalSystem";

export class MainWorld extends Location {
  public readonly size = 500;
  public terrain: TerrainChunkManager;
  public gridSystem: GridSystem;
  public collisionGrid: CollisionGrid;
  public terrainCollisionGrid: CollisionGrid;

  public atmosphere: AtmosphereSystem;
  public vegetation: VegetationSystem;
  public features: FeatureSystem;
  public portal: PortalSystem;

  private readonly isLowEnd = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null)
    ? navigator.hardwareConcurrency <= 4
    : false;

  constructor() {
    super("main-world", "TANJO World");

    const towerX = 300;
    const towerZ = 0;
    const towerClearRadius = 180;

    const portalX = 50;
    const portalZ = 0;
    const portalRadius = 8;

    const heightFunction = (x: number, z: number): number => {
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < 40) return 0;

      const distFromPortal = Math.sqrt(Math.pow(x - portalX, 2) + Math.pow(z - portalZ, 2));
      if (distFromPortal < portalRadius) return 0;

      const distFromTower = Math.sqrt(Math.pow(x - towerX, 2) + Math.pow(z - towerZ, 2));
      if (distFromTower < towerClearRadius) return 0;

      return (
        Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2 +
        Math.sin(x * 0.1 + 1.5) * Math.cos(z * 0.08 + 0.7) * 1.5 +
        Math.sin(x * 0.02) * Math.cos(z * 0.03) * 3
      );
    };

    this.terrain = new TerrainChunkManager({ chunkSize: 100, segmentsPerChunk: 64, worldSize: this.size }, heightFunction);
    this.gridSystem = new GridSystem(this.size, 5);
    this.collisionGrid = new CollisionGrid(20);
    this.terrainCollisionGrid = new CollisionGrid(100);

    this.atmosphere = new AtmosphereSystem(this);
    this.vegetation = new VegetationSystem(this);
    this.features = new FeatureSystem(this);
    this.portal = new PortalSystem(this);
  }

  create(rm: ResourceManager) {
    this.atmosphere.init();
    this.atmosphere.createLighting(this.isLowEnd);

    const chunks = this.terrain.generateAll(rm);
    for (const chunk of chunks) {
      this.scene.add(chunk.mesh);
      chunk.mesh.visible = true;
    }

    this.gridSystem.createVisualization(this.scene);
    this.vegetation.prepareAssets(rm);
    this.vegetation.createVegetationByChunks(rm);
    this.vegetation.createRocksByChunks(rm);
    this.vegetation.createDecorationsByChunks(rm);

    this.buildCollisionGrid();
    this.buildTerrainCollisionGrid();

    this.portal.createCaveEntrance(rm);
    this.features.createOcean();
    this.features.createBoundaryColliders();
    this.features.createGloomyTower();
  }

  private buildTerrainCollisionGrid() {
    this.terrainCollisionGrid.clear();
    this.terrain.chunks.forEach(chunk => {
      this.terrainCollisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(chunk.worldX - chunk.chunkSize / 2, -10, chunk.worldZ - chunk.chunkSize / 2),
        new THREE.Vector3(chunk.worldX + chunk.chunkSize / 2, 10, chunk.worldZ + chunk.chunkSize / 2)
      ));
      for (const collider of chunk.colliders) {
        this.terrainCollisionGrid.insert(collider);
      }
    });
  }

  private buildCollisionGrid() {
    this.collisionGrid.clear();
    this.terrain.chunks.forEach(chunk => {
      for (const collider of chunk.colliders) {
        this.collisionGrid.insert(collider);
      }
    });
  }

  public update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
    const LIMIT = 235;
    playerPosition.x = THREE.MathUtils.clamp(playerPosition.x, -LIMIT, LIMIT);
    playerPosition.z = THREE.MathUtils.clamp(playerPosition.z, -LIMIT, LIMIT);

    this.atmosphere.update(delta, playerPosition);
    this.portal.updateFogParticles(delta);
    this.vegetation.updateStreamingAndVisibility(playerPosition.x, playerPosition.z);
    
    this.features.update(delta, playerPosition, isEPressed ?? false);
  }

  public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
    return this.features.getInteractionPrompt(playerPosition);
  }

  public getCollidersInRadius(center: THREE.Vector3, radius: number): THREE.Box3[] {
    return this.collisionGrid.query(center, new THREE.Vector3(radius * 2, radius * 2, radius * 2));
  }

  getSpawnPoint(): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 15;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    return new THREE.Vector3(x, this.terrain.getHeightAt(x, z), z);
  }

  dispose() {
    this.terrain.dispose();
    this.gridSystem.dispose();
    this.atmosphere.dispose();
    this.vegetation.dispose();
    this.portal.dispose();

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }
}