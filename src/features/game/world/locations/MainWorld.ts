//src\features\game\world\locations\MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { TerrainChunkManager } from "../TerrainChunkManager";
import { GridSystem } from "../GridSystem";
import { CollisionGrid } from "../CollisionGrid";

export class MainWorld extends Location {
  public readonly size = 1000;
  public terrain: TerrainChunkManager;
  public gridSystem: GridSystem;
  public collisionGrid: CollisionGrid;

  private treeInstances: Map<string, THREE.InstancedMesh> = new Map();
  private rockInstances: Map<string, THREE.InstancedMesh> = new Map();

  private treeGeometry: THREE.BufferGeometry | null = null;
  private treeMaterial: THREE.Material | null = null;
  private rockGeometry: THREE.BufferGeometry | null = null;
  private rockMaterial: THREE.Material | null = null;

  private sun: THREE.DirectionalLight | null = null;
  private sunTarget: THREE.Object3D | null = null;

  private streamingRadius: number = 4;
  private loadedChunkKeys: Set<string> = new Set();

  constructor() {
    super("main-world", "TANJO World");

    const heightFunction = (x: number, z: number): number => {
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 40) return 0;
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
    this.createVegetationByChunks(rm);
    this.createRocksByChunks(rm);

    this.buildCollisionGrid();
    this.createLighting();
    this.createCaveEntrance();
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

  private createCaveEntrance() {
    const archGeo = new THREE.TorusGeometry(3, 0.5, 8, 16, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const arch = new THREE.Mesh(archGeo, archMat);

    const caveX = 250;
    const caveZ = -50;
    const caveY = this.terrain.getHeightAt(caveX, caveZ);
    arch.position.set(caveX, caveY, caveZ);
    arch.rotation.x = Math.PI;
    this.scene.add(arch);

    const entranceGeo = new THREE.CircleGeometry(2.8, 32);
    const entranceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const entrance = new THREE.Mesh(entranceGeo, entranceMat);
    entrance.position.set(caveX, caveY + 2.8, caveZ);
    this.scene.add(entrance);

    this.addPortal({
      id: "main-to-cave",
      position: new THREE.Vector3(caveX, caveY, caveZ),
      radius: 3,
      targetLocationId: "cave",
      targetSpawnPoint: new THREE.Vector3(0, 0, 0),
      mesh: arch,
    });
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

  private createVegetationByChunks(rm: ResourceManager) {
    if (!this.treeGeometry || !this.treeMaterial) return;

    const treesPerChunk = 60;
    const clearZoneRadius = 50;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      const instances = new THREE.InstancedMesh(
        this.treeGeometry!,
        this.treeMaterial!,
        treesPerChunk
      );
      instances.castShadow = true;
      instances.receiveShadow = true;

      let placed = 0;
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

        position.set(worldX, terrainHeight, worldZ);
        rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
        
        const s = 0.8 + Math.random() * 0.6;
        const heightMultiplier = 2.5 + Math.random() * 1.5;
        scale.set(s, s * heightMultiplier, s);

        matrix.compose(position, rotation, scale);
        instances.setMatrixAt(placed, matrix);

        const treeHeight = 4 * heightMultiplier;
        chunk.colliders.push(new THREE.Box3(
          new THREE.Vector3(worldX - 0.5, terrainHeight, worldZ - 0.5),
          new THREE.Vector3(worldX + 0.5, terrainHeight + treeHeight, worldZ + 0.5)
        ));

        placed++;
      }

      instances.count = placed;
      instances.instanceMatrix.needsUpdate = true;
      this.scene.add(instances);
      this.treeInstances.set(key, instances);
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

    this.rockInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.rockInstances.clear();

    if (this.treeGeometry) {
      this.treeGeometry.dispose();
      this.treeGeometry = null;
    }
    if (this.treeMaterial) {
      this.treeMaterial.dispose();
      this.treeMaterial = null;
    }
    if (this.rockGeometry) {
      this.rockGeometry.dispose();
      this.rockGeometry = null;
    }
    if (this.rockMaterial) {
      this.rockMaterial.dispose();
      this.rockMaterial = null;
    }

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }
}