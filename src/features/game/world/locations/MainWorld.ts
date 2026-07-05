// src/features/game/world/locations/MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { TerrainChunkManager } from "../TerrainChunkManager";
import { GridSystem } from "../GridSystem";
import { CollisionGrid } from "../CollisionGrid";

interface FogParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseY: number;
}

export class MainWorld extends Location {
  public readonly size = 1000;
  public terrain: TerrainChunkManager;
  public gridSystem: GridSystem;
  public collisionGrid: CollisionGrid;
  public terrainCollisionGrid: CollisionGrid;

  private treeInstances: Map<string, THREE.InstancedMesh> = new Map();
  private tree2Instances: Map<string, THREE.InstancedMesh> = new Map();
  private rockInstances: Map<string, THREE.InstancedMesh> = new Map();

  private treeGeometry: THREE.BufferGeometry | null = null;
  private treeMaterial: THREE.Material | null = null;
  private tree2Geometry: THREE.BufferGeometry | null = null;
  private tree2Material: THREE.Material | null = null;
  private rockGeometry: THREE.BufferGeometry | null = null;
  private rockMaterial: THREE.Material | null = null;

  private sun: THREE.DirectionalLight | null = null;
  private sunTarget: THREE.Object3D | null = null;

  private streamingRadius: number = 4;
  private loadedChunkKeys: Set<string> = new Set();

  private portalMesh: THREE.Object3D | null = null;
  private portalCollider: THREE.Box3 | null = null;
  private fogParticles: FogParticle[] = [];
  private fogGeometry: THREE.SphereGeometry | null = null;
  private fogMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly FOG_PARTICLE_COUNT = 300;
  private readonly FOG_RADIUS = 1;
  private readonly FOG_HEIGHT = 3;
  private portalPosition: THREE.Vector3 | null = null;
  private portalLight: THREE.PointLight | null = null;

  private grassGeometry: THREE.BufferGeometry | null = null;
  private grassMaterial: THREE.Material | null = null;
  private bush1Geometry: THREE.BufferGeometry | null = null;
  private bush1Material: THREE.Material | null = null;
  private bush2Geometry: THREE.BufferGeometry | null = null;
  private bush2Material: THREE.Material | null = null;

  private grassInstances: Map<string, THREE.InstancedMesh> = new Map();
  private bush1Instances: Map<string, THREE.InstancedMesh> = new Map();
  private bush2Instances: Map<string, THREE.InstancedMesh> = new Map();

  private readonly DECORATION_DRAW_DISTANCE = 60;

  private treeBillboardTexture: THREE.Texture | null = null;
  private treeBillboardMaterial: THREE.Material | null = null;
  private treeBillboardGeometry: THREE.BufferGeometry | null = null;
  private treeBillboardInstances: Map<string, THREE.InstancedMesh> = new Map();
  private readonly BILLBOARD_DISTANCE = 100;

  constructor() {
    super("main-world", "TANJO World");

    const portalX = 50;
    const portalZ = 0;
    const portalRadius = 8;

    const heightFunction = (x: number, z: number): number => {
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < 40) return 0;

      const distFromPortal = Math.sqrt(
        Math.pow(x - portalX, 2) +
        Math.pow(z - portalZ, 2)
      );
      if (distFromPortal < portalRadius) return 0;

      return (
        Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2 +
        Math.sin(x * 0.1 + 1.5) * Math.cos(z * 0.08 + 0.7) * 1.5 +
        Math.sin(x * 0.02) * Math.cos(z * 0.03) * 3
      );
    };

    this.terrain = new TerrainChunkManager(
      {
        chunkSize: 100,
        segmentsPerChunk: 32,
        worldSize: this.size,
      },
      heightFunction
    );

    this.gridSystem = new GridSystem(this.size, 5);
    this.collisionGrid = new CollisionGrid(20);
    this.terrainCollisionGrid = new CollisionGrid(100);
  }

  create(rm: ResourceManager) {
    this.createAtmosphere();
    this.createSky();

    const chunks = this.terrain.generateAll(rm);
    for (const chunk of chunks) {
      this.scene.add(chunk.mesh);
      chunk.mesh.visible = true;
      this.loadedChunkKeys.add(`${chunk.chunkX},${chunk.chunkZ}`);
    }

    this.terrain.computeAllNormals();

    this.gridSystem.createVisualization(this.scene);

    this.prepareVegetationAssets(rm);
    this.prepareDecorationAssets(rm);
    this.prepareTreeBillboards(rm);
    this.createVegetationByChunks(rm);
    this.createRocksByChunks(rm);
    this.createDecorationsByChunks(rm);
    this.createTreeBillboardsByChunks();

    this.buildCollisionGrid();
    this.buildTerrainCollisionGrid();
    this.createLighting();
    this.createCaveEntrance(rm);
  }


  private prepareTreeBillboards(rm: ResourceManager) {
    const texture = rm.getTexture("tree-billboard");
    if (texture) {
      this.treeBillboardTexture = texture;

      this.treeBillboardMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      this.treeBillboardGeometry = new THREE.PlaneGeometry(4, 8);
    }
  }

  private createTreeBillboardsByChunks() {
    if (!this.treeBillboardGeometry || !this.treeBillboardMaterial) return;

    const billboardsPerChunk = 60;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      const billboardInstances = new THREE.InstancedMesh(
        this.treeBillboardGeometry!,
        this.treeBillboardMaterial!,
        billboardsPerChunk
      );

      billboardInstances.castShadow = false;
      billboardInstances.receiveShadow = false;

      let placed = 0;
      for (let i = 0; i < billboardsPerChunk; i++) {
        const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
        const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
        const worldX = chunk.worldX + localX;
        const worldZ = chunk.worldZ + localZ;

        if (this.isInSafeZone(worldX, worldZ)) continue;

        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        if (dist < 50) continue;

        const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
        position.set(worldX, terrainHeight, worldZ);

        const s = 0.8 + Math.random() * 0.6;
        scale.set(s, s, s);

        matrix.compose(position, new THREE.Quaternion(), scale);
        billboardInstances.setMatrixAt(placed, matrix);
        placed++;
      }

      billboardInstances.count = placed;
      billboardInstances.instanceMatrix.needsUpdate = true;
      this.scene.add(billboardInstances);
      this.treeBillboardInstances.set(key, billboardInstances);
    });
  }

  private buildTerrainCollisionGrid() {
    this.terrainCollisionGrid.clear();

    this.terrain.chunks.forEach(chunk => {
      const box = new THREE.Box3(
        new THREE.Vector3(chunk.worldX - chunk.chunkSize / 2, -10, chunk.worldZ - chunk.chunkSize / 2),
        new THREE.Vector3(chunk.worldX + chunk.chunkSize / 2, 10, chunk.worldZ + chunk.chunkSize / 2)
      );
      this.terrainCollisionGrid.insert(box);
    });

    this.terrain.chunks.forEach(chunk => {
      for (const collider of chunk.colliders) {
        this.terrainCollisionGrid.insert(collider);
      }
    });
  }

  private createAtmosphere() {
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);
  }

  private createSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0077ff');
    gradient.addColorStop(0.5, '#87ceeb');
    gradient.addColorStop(1, '#ffffff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    this.scene.background = texture;
  }

  private createCaveEntrance(rm: ResourceManager) {
    const caveX = 50;
    const caveZ = 0;
    const caveY = 0;
    const PORTAL_SINK = 0.5;

    this.portalPosition = new THREE.Vector3(caveX, caveY, caveZ);

    const portalData = rm.getModel("portal");
    if (portalData) {
      this.portalMesh = portalData.scene;

      const box = new THREE.Box3().setFromObject(this.portalMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.z);
      const targetMaxSize = 12;

      if (maxDimension > targetMaxSize) {
        const scale = targetMaxSize / maxDimension;
        this.portalMesh.scale.setScalar(scale);
      }

      this.scene.add(this.portalMesh);
      this.portalMesh.position.set(0, 0, 0);

      const scaledBox = new THREE.Box3().setFromObject(this.portalMesh);
      const center = scaledBox.getCenter(new THREE.Vector3());

      this.portalMesh.position.set(
        caveX - center.x,
        caveY - scaledBox.min.y - PORTAL_SINK,
        caveZ - center.z
      );

      this.portalMesh.updateMatrixWorld(true);

      this.clearVegetationAroundPortal(caveX, caveZ, 8);

      this.portalMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();

          if (name.includes('base') || name.includes('плита') || name.includes('plate')) {
            child.updateMatrixWorld(true);
            const childBox = new THREE.Box3().setFromObject(child);
            const surfaceY = childBox.max.y;

            const platformBox = new THREE.Box3(
              new THREE.Vector3(childBox.min.x, surfaceY - 0.01, childBox.min.z),
              new THREE.Vector3(childBox.max.x, surfaceY, childBox.max.z)
            );

            this.collisionGrid.insert(platformBox);
          }
          else if (name.includes('monolith') || name.includes('stone') || name.includes('камень')) {
            child.updateMatrixWorld(true);
            const childBox = new THREE.Box3().setFromObject(child);
            const surfaceY = childBox.max.y;

            const platformBox = new THREE.Box3(
              new THREE.Vector3(childBox.min.x, surfaceY - 0.01, childBox.min.z),
              new THREE.Vector3(childBox.max.x, surfaceY, childBox.max.z)
            );

            this.collisionGrid.insert(platformBox);
          }
        }
      });
    } else {
      const archGeo = new THREE.TorusGeometry(3, 0.5, 8, 16, Math.PI);
      const archMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      this.portalMesh = new THREE.Mesh(archGeo, archMat);
      this.portalMesh.position.set(caveX, caveY - PORTAL_SINK, caveZ);
      this.portalMesh.rotation.x = Math.PI;
      this.scene.add(this.portalMesh);
    }

    this.portalLight = new THREE.PointLight(0x4488ff, 2, 15);
    this.portalLight.position.set(caveX, caveY + 2 - PORTAL_SINK, caveZ);
    this.scene.add(this.portalLight);

    this.createFogParticles(caveX, caveY - PORTAL_SINK, caveZ);

    this.addPortal({
      id: "main-to-cave",
      position: new THREE.Vector3(caveX, caveY, caveZ),
      radius: 3,
      targetLocationId: "cave",
      targetSpawnPoint: new THREE.Vector3(0, 0, 0),
      mesh: this.portalMesh,
    });
  }

  private clearVegetationAroundPortal(centerX: number, centerZ: number, radius: number) {
    let treesRemoved = 0;
    let trees2Removed = 0;
    let rocksRemoved = 0;

    this.terrain.chunks.forEach((chunk, key) => {
      const trees = this.treeInstances.get(key);
      if (trees) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < trees.count; i++) {
          trees.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);

          const dist = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.z - centerZ, 2)
          );

          if (dist <= radius) {
            matrix.makeScale(0, 0, 0);
            trees.setMatrixAt(i, matrix);
            treesRemoved++;
          }
        }

        if (treesRemoved > 0) {
          trees.instanceMatrix.needsUpdate = true;
        }
      }

      const trees2 = this.tree2Instances.get(key);
      if (trees2) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < trees2.count; i++) {
          trees2.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);

          const dist = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.z - centerZ, 2)
          );

          if (dist <= radius) {
            matrix.makeScale(0, 0, 0);
            trees2.setMatrixAt(i, matrix);
            trees2Removed++;
          }
        }

        if (trees2Removed > 0) {
          trees2.instanceMatrix.needsUpdate = true;
        }
      }

      const rocks = this.rockInstances.get(key);
      if (rocks) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < rocks.count; i++) {
          rocks.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);

          const dist = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.z - centerZ, 2)
          );

          if (dist <= radius) {
            matrix.makeScale(0, 0, 0);
            rocks.setMatrixAt(i, matrix);
            rocksRemoved++;
          }
        }

        if (rocksRemoved > 0) {
          rocks.instanceMatrix.needsUpdate = true;
        }
      }
    });
  }

  private createFogParticles(centerX: number, centerY: number, centerZ: number) {
    this.fogGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    this.fogMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    for (let i = 0; i < this.FOG_PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(this.fogGeometry, this.fogMaterial);

      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.FOG_RADIUS;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;

      const y = centerY + (i / this.FOG_PARTICLE_COUNT) * this.FOG_HEIGHT;

      mesh.position.set(x, y, z);
      mesh.visible = true;
      this.scene.add(mesh);

      const maxLife = 4 + Math.random() * 2;

      this.fogParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          0.4 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.1
        ),
        life: (i / this.FOG_PARTICLE_COUNT) * maxLife,
        maxLife,
        baseY: centerY,
      });
    }
  }

  private updateFogParticles(delta: number) {
    if (!this.portalPosition || !this.fogParticles.length) return;

    for (const particle of this.fogParticles) {
      particle.life += delta;

      if (particle.life >= particle.maxLife) {
        particle.life = 0;

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.FOG_RADIUS;
        particle.mesh.position.set(
          this.portalPosition.x + Math.cos(angle) * radius,
          particle.baseY,
          this.portalPosition.z + Math.sin(angle) * radius
        );

        particle.velocity.set(
          (Math.random() - 0.5) * 0.1,
          0.4 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.1
        );

        particle.maxLife = 4 + Math.random() * 2;
      }

      particle.mesh.position.x += particle.velocity.x * delta;
      particle.mesh.position.y += particle.velocity.y * delta;
      particle.mesh.position.z += particle.velocity.z * delta;

      const lifeRatio = particle.life / particle.maxLife;
      let opacity = 0.25;

      if (lifeRatio < 0.1) {
        opacity = (lifeRatio / 0.1) * 0.25;
      }
      else if (lifeRatio > 0.85) {
        opacity = ((1 - lifeRatio) / 0.15) * 0.25;
      }

      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;

      const scale = 1.0 + lifeRatio * 0.5;
      particle.mesh.scale.setScalar(scale);
    }
  }

  private prepareVegetationAssets(rm: ResourceManager) {
    const treeData = rm.getModel("tree");
    if (treeData) {
      const treeMesh = this.findFirstMesh(treeData.scene);
      if (treeMesh && treeMesh.geometry) {
        const { geometry, material } = this.cloneAndRotateGeometry(treeMesh);
        this.treeGeometry = geometry;
        this.treeMaterial = material;
      }
    }

    const tree2Data = rm.getModel("tree2");
    if (tree2Data) {
      const tree2Mesh = this.findFirstMesh(tree2Data.scene);
      if (tree2Mesh && tree2Mesh.geometry) {
        const { geometry, material } = this.cloneAndRotateGeometry(tree2Mesh);
        this.tree2Geometry = geometry;
        this.tree2Material = material;
      }
    }

    const rockData = rm.getModel("rock");
    if (rockData) {
      const rockMesh = this.findFirstMesh(rockData.scene);
      if (rockMesh && rockMesh.geometry) {
        const { geometry, material } = this.cloneAndRotateGeometry(rockMesh);
        this.rockGeometry = geometry;
        this.rockMaterial = material;
      }
    }
  }

  private prepareDecorationAssets(rm: ResourceManager) {
    console.log(`\n=== PREPARING DECORATION ASSETS ===\n`);

    const prepareGeometry = (
      scene: THREE.Group,
      targetHeight: number,
      name: string
    ): { geometry: THREE.BufferGeometry; material: THREE.Material } | null => {
      console.log(`--- Processing ${name} ---`);

      const mesh = this.findFirstMesh(scene);
      if (!mesh || !mesh.geometry) {
        console.log(`✗ ERROR: No mesh found in scene\n`);
        return null;
      }

      console.log(`✓ Mesh found: "${mesh.name}"`);

      const geometry = mesh.geometry.clone();
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

      const tempMesh = new THREE.Mesh(geometry, material);
      const clonedBox = new THREE.Box3().setFromObject(tempMesh);
      const clonedSize = clonedBox.getSize(new THREE.Vector3());

      console.log(`✓ After clone:`);
      console.log(`  Cloned size: ${clonedSize.x.toFixed(3)} x ${clonedSize.y.toFixed(3)} x ${clonedSize.z.toFixed(3)}`);

      if (clonedSize.y > 100 || clonedSize.x > 100 || clonedSize.z > 100) {
        console.log(`✗ ERROR: Cloned size is too large, skipping\n`);
        return null;
      }

      const clonedCenter = clonedBox.getCenter(new THREE.Vector3());
      geometry.translate(-clonedCenter.x, -clonedCenter.y, -clonedCenter.z);

      const centeredMesh = new THREE.Mesh(geometry, material);
      const centeredBox = new THREE.Box3().setFromObject(centeredMesh);
      const centeredSize = centeredBox.getSize(new THREE.Vector3());

      const currentHeight = centeredSize.y;

      if (currentHeight < 0.001) {
        console.log(`✗ ERROR: Current height is too small, skipping scale\n`);
        return null;
      }

      const scaleFactor = targetHeight / currentHeight;
      geometry.scale(scaleFactor, scaleFactor, scaleFactor);

      const scaledMesh = new THREE.Mesh(geometry, material);
      const scaledBox = new THREE.Box3().setFromObject(scaledMesh);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      geometry.translate(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

      const finalMesh = new THREE.Mesh(geometry, material);
      const finalBox = new THREE.Box3().setFromObject(finalMesh);
      const finalSize = finalBox.getSize(new THREE.Vector3());

      console.log(`✓ ${name} ready - Final size: ${finalSize.x.toFixed(3)} x ${finalSize.y.toFixed(3)} x ${finalSize.z.toFixed(3)}\n`);

      return { geometry, material };
    };

    const grassData = rm.getModel("grass");
    if (grassData) {
      const result = prepareGeometry(grassData.scene, 0.4, "GRASS");
      if (result) {
        this.grassGeometry = result.geometry;
        this.grassMaterial = result.material;
      }
    }

    const bush1Data = rm.getModel("bush1");
    if (bush1Data) {
      const result = prepareGeometry(bush1Data.scene, 0.8, "BUSH1");
      if (result) {
        this.bush1Geometry = result.geometry;
        this.bush1Material = result.material;
      }
    }

    const bush2Data = rm.getModel("bush2");
    if (bush2Data) {
      const result = prepareGeometry(bush2Data.scene, 0.7, "BUSH2");
      if (result) {
        this.bush2Geometry = result.geometry;
        this.bush2Material = result.material;
      }
    }

    console.log(`=== END DECORATION ASSETS ===\n`);
  }

  private createVegetationByChunks(rm: ResourceManager) {
    const treesPerChunk = 60;
    const clearZoneRadius = 50;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      if (this.treeGeometry && this.treeMaterial) {
        const treeInstances = new THREE.InstancedMesh(
          this.treeGeometry!,
          this.treeMaterial!,
          treesPerChunk
        );
        treeInstances.castShadow = true;
        treeInstances.receiveShadow = true;

        let treePlaced = 0;
        for (let i = 0; i < treesPerChunk; i++) {
          let worldX: number, worldZ: number;
          let attempts = 0;

          do {
            const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
            const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
            worldX = chunk.worldX + localX;
            worldZ = chunk.worldZ + localZ;
            attempts++;
          } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

          if (this.isInSafeZone(worldX, worldZ)) continue;

          const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
          const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
          if (dist < clearZoneRadius) continue;

          const treeType = Math.random();
          if (treeType > 0.3) continue;

          position.set(worldX, terrainHeight, worldZ);
          rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));

          const baseSize = 0.8 + Math.random() * 0.6;
          const heightMultiplier = 2.5 + Math.random() * 1.5;
          const thicknessMultiplier = Math.sqrt(heightMultiplier);

          const scaleXZ = baseSize * thicknessMultiplier;
          const scaleY = baseSize * heightMultiplier;
          scale.set(scaleXZ, scaleY, scaleXZ);

          matrix.compose(position, rotation, scale);
          treeInstances.setMatrixAt(treePlaced, matrix);

          const treeHeight = 4 * heightMultiplier;
          const treeRadius = 0.5 * thicknessMultiplier;

          chunk.colliders.push(new THREE.Box3(
            new THREE.Vector3(worldX - treeRadius, terrainHeight, worldZ - treeRadius),
            new THREE.Vector3(worldX + treeRadius, terrainHeight + treeHeight, worldZ + treeRadius)
          ));

          treePlaced++;
        }

        treeInstances.count = treePlaced;
        treeInstances.instanceMatrix.needsUpdate = true;
        this.scene.add(treeInstances);
        this.treeInstances.set(key, treeInstances);
      }

      if (this.tree2Geometry && this.tree2Material) {
        const tree2Instances = new THREE.InstancedMesh(
          this.tree2Geometry!,
          this.tree2Material!,
          treesPerChunk
        );
        tree2Instances.castShadow = true;
        tree2Instances.receiveShadow = true;

        let tree2Placed = 0;
        for (let i = 0; i < treesPerChunk; i++) {
          let worldX: number, worldZ: number;
          let attempts = 0;

          do {
            const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
            const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
            worldX = chunk.worldX + localX;
            worldZ = chunk.worldZ + localZ;
            attempts++;
          } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

          if (this.isInSafeZone(worldX, worldZ)) continue;

          const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
          const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
          if (dist < clearZoneRadius) continue;

          const treeType = Math.random();
          if (treeType <= 0.3) continue;

          position.set(worldX, terrainHeight, worldZ);
          rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));

          const baseSize = 0.6 + Math.random() * 0.4;
          const heightMultiplier = 2.0 + Math.random() * 1.0;
          const thicknessMultiplier = Math.sqrt(heightMultiplier);

          const scaleXZ = baseSize * thicknessMultiplier;
          const scaleY = baseSize * heightMultiplier;
          scale.set(scaleXZ, scaleY, scaleXZ);

          matrix.compose(position, rotation, scale);
          tree2Instances.setMatrixAt(tree2Placed, matrix);

          const treeHeight = 4 * heightMultiplier;
          const treeRadius = 0.5 * thicknessMultiplier;

          chunk.colliders.push(new THREE.Box3(
            new THREE.Vector3(worldX - treeRadius, terrainHeight, worldZ - treeRadius),
            new THREE.Vector3(worldX + treeRadius, terrainHeight + treeHeight, worldZ + treeRadius)
          ));

          tree2Placed++;
        }

        tree2Instances.count = tree2Placed;
        tree2Instances.instanceMatrix.needsUpdate = true;
        this.scene.add(tree2Instances);
        this.tree2Instances.set(key, tree2Instances);
      }
    });
  }

  private createRocksByChunks(rm: ResourceManager) {
    if (!this.rockGeometry || !this.rockMaterial) return;

    const rocksPerChunk = 6;
    const clearZoneRadius = 50;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      const instances = new THREE.InstancedMesh(
        this.rockGeometry!,
        this.rockMaterial!,
        rocksPerChunk
      );
      instances.castShadow = true;
      instances.receiveShadow = true;

      let placed = 0;
      for (let i = 0; i < rocksPerChunk; i++) {
        let worldX: number, worldZ: number;
        let attempts = 0;

        do {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          worldX = chunk.worldX + localX;
          worldZ = chunk.worldZ + localZ;
          attempts++;
        } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

        if (this.isInSafeZone(worldX, worldZ)) continue;

        const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        if (dist < clearZoneRadius) continue;

        position.set(worldX, terrainHeight, worldZ);
        rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
        const s = 0.6 + Math.random() * 1.2;
        scale.set(s, s, s);

        matrix.compose(position, rotation, scale);
        instances.setMatrixAt(placed, matrix);

        chunk.colliders.push(new THREE.Box3(
          new THREE.Vector3(worldX - 1, terrainHeight, worldZ - 1),
          new THREE.Vector3(worldX + 1, terrainHeight + 2, worldZ + 1)
        ));

        placed++;
      }

      instances.count = placed;
      instances.instanceMatrix.needsUpdate = true;
      this.scene.add(instances);
      this.rockInstances.set(key, instances);
    });
  }

  private createDecorationsByChunks(rm: ResourceManager) {
    const grassPerChunk = 40;
    const bush1PerChunk = 8;
    const bush2PerChunk = 8;
    const clearZoneRadius = 30;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      if (this.grassGeometry && this.grassMaterial) {
        const grassInstances = new THREE.InstancedMesh(
          this.grassGeometry!,
          this.grassMaterial!,
          grassPerChunk
        );
        grassInstances.castShadow = false;
        grassInstances.receiveShadow = true;

        let grassPlaced = 0;
        for (let i = 0; i < grassPerChunk; i++) {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const worldX = chunk.worldX + localX;
          const worldZ = chunk.worldZ + localZ;

          if (this.isInSafeZone(worldX, worldZ)) continue;

          const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
          if (dist < clearZoneRadius) continue;

          const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
          position.set(worldX, terrainHeight, worldZ);
          rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
          const s = 0.8 + Math.random() * 0.4;
          scale.set(s, s, s);

          matrix.compose(position, rotation, scale);
          grassInstances.setMatrixAt(grassPlaced, matrix);
          grassPlaced++;
        }

        grassInstances.count = grassPlaced;
        grassInstances.instanceMatrix.needsUpdate = true;
        this.scene.add(grassInstances);
        this.grassInstances.set(key, grassInstances);
      }

      if (this.bush1Geometry && this.bush1Material) {
        const bush1Instances = new THREE.InstancedMesh(
          this.bush1Geometry!,
          this.bush1Material!,
          bush1PerChunk
        );
        bush1Instances.castShadow = false;
        bush1Instances.receiveShadow = true;

        let bush1Placed = 0;
        for (let i = 0; i < bush1PerChunk; i++) {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const worldX = chunk.worldX + localX;
          const worldZ = chunk.worldZ + localZ;

          if (this.isInSafeZone(worldX, worldZ)) continue;

          const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
          if (dist < clearZoneRadius) continue;

          const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
          position.set(worldX, terrainHeight, worldZ);
          rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
          const s = 0.7 + Math.random() * 0.6;
          scale.set(s, s, s);

          matrix.compose(position, rotation, scale);
          bush1Instances.setMatrixAt(bush1Placed, matrix);
          bush1Placed++;
        }

        bush1Instances.count = bush1Placed;
        bush1Instances.instanceMatrix.needsUpdate = true;
        this.scene.add(bush1Instances);
        this.bush1Instances.set(key, bush1Instances);
      }

      if (this.bush2Geometry && this.bush2Material) {
        const bush2Instances = new THREE.InstancedMesh(
          this.bush2Geometry!,
          this.bush2Material!,
          bush2PerChunk
        );
        bush2Instances.castShadow = false;
        bush2Instances.receiveShadow = true;

        let bush2Placed = 0;
        for (let i = 0; i < bush2PerChunk; i++) {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const worldX = chunk.worldX + localX;
          const worldZ = chunk.worldZ + localZ;

          if (this.isInSafeZone(worldX, worldZ)) continue;

          const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
          if (dist < clearZoneRadius) continue;

          const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
          position.set(worldX, terrainHeight, worldZ);
          rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
          const s = 0.6 + Math.random() * 0.5;
          scale.set(s, s, s);

          matrix.compose(position, rotation, scale);
          bush2Instances.setMatrixAt(bush2Placed, matrix);
          bush2Placed++;
        }

        bush2Instances.count = bush2Placed;
        bush2Instances.instanceMatrix.needsUpdate = true;
        this.scene.add(bush2Instances);
        this.bush2Instances.set(key, bush2Instances);
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

  private findFirstMesh(scene: THREE.Group): THREE.Mesh | null {
    let foundMesh: THREE.Mesh | null = null;

    scene.traverse((child) => {
      if (foundMesh) return;
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        foundMesh = child as THREE.Mesh;
      }
    });

    return foundMesh;
  }

  private cloneAndRotateGeometry(sourceMesh: THREE.Mesh): { geometry: THREE.BufferGeometry; material: THREE.Material } {
    const geometry = sourceMesh.geometry.clone();
    const material = Array.isArray(sourceMesh.material)
      ? sourceMesh.material[0]
      : sourceMesh.material;

    geometry.rotateX(-Math.PI / 2);

    return { geometry, material };
  }

  private isInSafeZone(x: number, z: number): boolean {
    const dist = Math.sqrt(x * x + z * z);
    return dist < 45;
  }

  private createLighting() {
    const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 0.7);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
    this.sun.castShadow = true;

    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.bias = -0.0005;

    this.sunTarget = new THREE.Object3D();
    this.sun.target = this.sunTarget;

    this.scene.add(this.sun);
    this.scene.add(this.sunTarget);
  }

  public update(playerPosition: THREE.Vector3, delta: number) {
    if (this.sun && this.sunTarget) {
      this.sun.position.set(
        playerPosition.x + 80,
        150,
        playerPosition.z + 60
      );
      this.sunTarget.position.copy(playerPosition);
      this.sunTarget.updateMatrixWorld();
    }

    this.updateStreaming(playerPosition.x, playerPosition.z);
    this.updateDecorationVisibility(playerPosition);
    this.updateTreeBillboardVisibility(playerPosition);
    this.updateFogParticles(delta);
  }

  private updateTreeBillboardVisibility(playerPosition: THREE.Vector3) {
    const billboardDistSq = this.BILLBOARD_DISTANCE * this.BILLBOARD_DISTANCE;

    this.loadedChunkKeys.forEach(key => {
      const chunk = this.terrain.chunks.get(key);
      if (!chunk) return;

      const dx = chunk.worldX - playerPosition.x;
      const dz = chunk.worldZ - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      const showBillboards = distSq > billboardDistSq;

      const billboards = this.treeBillboardInstances.get(key);
      if (billboards) {
        billboards.visible = showBillboards;
      }
    });
  }

  private updateDecorationVisibility(playerPosition: THREE.Vector3) {
    const drawDistanceSq = this.DECORATION_DRAW_DISTANCE * this.DECORATION_DRAW_DISTANCE;

    this.loadedChunkKeys.forEach(key => {
      const chunk = this.terrain.chunks.get(key);
      if (!chunk) return;

      const dx = chunk.worldX - playerPosition.x;
      const dz = chunk.worldZ - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      const isVisible = distSq <= drawDistanceSq;

      const grass = this.grassInstances.get(key);
      if (grass) grass.visible = isVisible;

      const bush1 = this.bush1Instances.get(key);
      if (bush1) bush1.visible = isVisible;

      const bush2 = this.bush2Instances.get(key);
      if (bush2) bush2.visible = isVisible;

      const trees = this.treeInstances.get(key);
      if (trees) {
        trees.visible = distSq <= (this.BILLBOARD_DISTANCE * this.BILLBOARD_DISTANCE);
      }

      const trees2 = this.tree2Instances.get(key);
      if (trees2) {
        trees2.visible = distSq <= (this.BILLBOARD_DISTANCE * this.BILLBOARD_DISTANCE);
      }
    });
  }

  private updateStreaming(playerX: number, playerZ: number) {
    const playerChunk = this.terrain.getChunkAtWorldPos(playerX, playerZ);
    if (!playerChunk) return;

    const toShow: string[] = [];
    const toHide: string[] = [];

    for (let dx = -this.streamingRadius; dx <= this.streamingRadius; dx++) {
      for (let dz = -this.streamingRadius; dz <= this.streamingRadius; dz++) {
        const cx = playerChunk.chunkX + dx;
        const cz = playerChunk.chunkZ + dz;
        const key = `${cx},${cz}`;
        const chunk = this.terrain.chunks.get(key);
        if (chunk && !this.loadedChunkKeys.has(key)) {
          toShow.push(key);
        }
      }
    }

    this.loadedChunkKeys.forEach(key => {
      const chunk = this.terrain.chunks.get(key);
      if (!chunk) return;
      const dx = Math.abs(chunk.chunkX - playerChunk.chunkX);
      const dz = Math.abs(chunk.chunkZ - playerChunk.chunkZ);

      if (dx > this.streamingRadius || dz > this.streamingRadius) {
        toHide.push(key);
      }
    });

    for (const key of toShow) {
      const chunk = this.terrain.chunks.get(key);
      if (chunk) {
        chunk.mesh.visible = true;
        const trees = this.treeInstances.get(key);
        if (trees) trees.visible = true;
        const trees2 = this.tree2Instances.get(key);
        if (trees2) trees2.visible = true;
        const rocks = this.rockInstances.get(key);
        if (rocks) rocks.visible = true;

        this.loadedChunkKeys.add(key);
      }
    }

    for (const key of toHide) {
      const chunk = this.terrain.chunks.get(key);
      if (chunk) {
        chunk.mesh.visible = false;
        const trees = this.treeInstances.get(key);
        if (trees) trees.visible = false;
        const trees2 = this.tree2Instances.get(key);
        if (trees2) trees2.visible = false;
        const rocks = this.rockInstances.get(key);
        if (rocks) rocks.visible = false;

        this.loadedChunkKeys.delete(key);
      }
    }
  }

  public getCollidersInRadius(center: THREE.Vector3, radius: number): THREE.Box3[] {
    return this.collisionGrid.query(center, new THREE.Vector3(radius * 2, radius * 2, radius * 2));
  }

  getSpawnPoint(): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 15;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = this.terrain.getHeightAt(x, z);
    return new THREE.Vector3(x, y, z);
  }

  dispose() {
    this.terrain.dispose();
    this.gridSystem.dispose();

    this.treeInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.treeInstances.clear();

    this.treeBillboardInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    if (this.treeBillboardGeometry) {
      this.treeBillboardGeometry.dispose();
      this.treeBillboardGeometry = null;
    }
    if (this.treeBillboardMaterial) {
      this.treeBillboardMaterial.dispose();
      this.treeBillboardMaterial = null;
    }
    if (this.treeBillboardTexture) {
      this.treeBillboardTexture.dispose();
      this.treeBillboardTexture = null;
    }

    this.tree2Instances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.tree2Instances.clear();

    this.rockInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.rockInstances.clear();

    this.grassInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.grassInstances.clear();

    this.bush1Instances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.bush1Instances.clear();

    this.bush2Instances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });


    this.bush2Instances.clear();



    if (this.treeGeometry) {
      this.treeGeometry.dispose();
      this.treeGeometry = null;
    }
    if (this.treeMaterial) {
      this.treeMaterial.dispose();
      this.treeMaterial = null;
    }
    if (this.tree2Geometry) {
      this.tree2Geometry.dispose();
      this.tree2Geometry = null;
    }
    if (this.tree2Material) {
      this.tree2Material.dispose();
      this.tree2Material = null;
    }
    if (this.rockGeometry) {
      this.rockGeometry.dispose();
      this.rockGeometry = null;
    }
    if (this.rockMaterial) {
      this.rockMaterial.dispose();
      this.rockMaterial = null;
    }

    if (this.grassGeometry) {
      this.grassGeometry.dispose();
      this.grassGeometry = null;
    }
    if (this.grassMaterial) {
      this.grassMaterial.dispose();
      this.grassMaterial = null;
    }
    if (this.bush1Geometry) {
      this.bush1Geometry.dispose();
      this.bush1Geometry = null;
    }
    if (this.bush1Material) {
      this.bush1Material.dispose();
      this.bush1Material = null;
    }
    if (this.bush2Geometry) {
      this.bush2Geometry.dispose();
      this.bush2Geometry = null;
    }
    if (this.bush2Material) {
      this.bush2Material.dispose();
      this.bush2Material = null;
    }

    for (const particle of this.fogParticles) {
      this.scene.remove(particle.mesh);
    }
    this.fogParticles = [];

    if (this.fogGeometry) {
      this.fogGeometry.dispose();
      this.fogGeometry = null;
    }
    if (this.fogMaterial) {
      this.fogMaterial.dispose();
      this.fogMaterial = null;
    }

    if (this.portalMesh) {
      this.scene.remove(this.portalMesh);
      this.portalMesh = null;
    }

    if (this.portalLight) {
      this.scene.remove(this.portalLight);
      this.portalLight = null;
    }

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }


}