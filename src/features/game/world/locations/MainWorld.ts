//src\features\game\world\MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { Terrain } from "../Terrain";
import { GridSystem } from "../GridSystem";

interface LakeConfig {
  centerX: number;
  centerZ: number;
  radius: number;
  depth: number;
  beachWidth: number;
  beachHeight: number;
}

export class MainWorld extends Location {
  public readonly size = 500;
  public gridSystem: GridSystem;
  public terrain: Terrain;
  private treeInstances: THREE.InstancedMesh | null = null;
  private rockInstances: THREE.InstancedMesh | null = null;

  private waterMeshes: THREE.Mesh[] = [];
  private waterTime: number = 0;

  private lakes: LakeConfig[] = [
    { centerX: -100, centerZ: -90, radius: 40, depth: 5, beachWidth: 6, beachHeight: 1.2 },
    { centerX: 80, centerZ: 100, radius: 25, depth: 4, beachWidth: 5, beachHeight: 1.0 },
    { centerX: -50, centerZ: 150, radius: 15, depth: 3, beachWidth: 4, beachHeight: 0.8 },
    { centerX: 150, centerZ: -80, radius: 20, depth: 3.5, beachWidth: 5, beachHeight: 1.0 },
  ];

  constructor() {
    super("main-world", "TANJO World");
    this.terrain = new Terrain(this.size, 64);
    this.gridSystem = new GridSystem(this.size, 5);
  }

  create(rm: ResourceManager) {
    this.createSky();

    this.terrain.create(this.scene);

    for (const lake of this.lakes) {
      this.terrain.createWaterDepression(
        lake.centerX,
        lake.centerZ,
        lake.radius,
        lake.depth,
        lake.beachWidth,
        lake.beachHeight
      );
    }

    this.gridSystem.createVisualization(this.scene);
    this.createWater();
    this.createVegetation(rm);
    this.createRocks(rm);
    this.createLighting();
    this.createCaveEntrance();
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

  public updateSky(_playerPosition: THREE.Vector3) {
  }

  private createCaveEntrance() {
    const archGeo = new THREE.TorusGeometry(3, 0.5, 8, 16, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const arch = new THREE.Mesh(archGeo, archMat);

    const caveY = this.terrain.getHeightAt(200, -150);
    arch.position.set(200, caveY, -150);
    arch.rotation.x = Math.PI;
    this.scene.add(arch);

    const entranceGeo = new THREE.CircleGeometry(2.8, 32);
    const entranceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const entrance = new THREE.Mesh(entranceGeo, entranceMat);
    entrance.position.set(200, caveY + 2.8, -150);
    this.scene.add(entrance);

    this.addPortal({
      id: "main-to-cave",
      position: new THREE.Vector3(200, caveY, -150),
      radius: 3,
      targetLocationId: "cave",
      targetSpawnPoint: new THREE.Vector3(0, 0, 0),
      mesh: arch,
    });
  }

  private createWater() {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a8fd5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.1,
      emissive: 0x0a4f7a,
      emissiveIntensity: 0.15,
    });

    for (const lake of this.lakes) {
      const centerOriginalHeight = this.terrain.getOriginalHeightAt(lake.centerX, lake.centerZ);
      const waterLevel = centerOriginalHeight - lake.depth;

      const lakeGeometry = new THREE.CircleGeometry(lake.radius - 0.5, 64);

      const lakeMesh = new THREE.Mesh(lakeGeometry, waterMat.clone());
      lakeMesh.rotation.x = -Math.PI / 2;
      lakeMesh.position.set(lake.centerX, waterLevel + 0.05, lake.centerZ);
      lakeMesh.receiveShadow = true;

      lakeMesh.userData.originalY = waterLevel + 0.05;
      lakeMesh.userData.phase = Math.random() * Math.PI * 2;

      this.scene.add(lakeMesh);
      this.waterMeshes.push(lakeMesh);
    }
  }

  public updateWater(delta: number) {
    this.waterTime += delta;

    for (const waterMesh of this.waterMeshes) {
      const originalY = waterMesh.userData.originalY || waterMesh.position.y;
      const phase = waterMesh.userData.phase || 0;

      const waveHeight = 0.05;
      const waveFrequency = 1.5;
      const offsetY = Math.sin(this.waterTime * waveFrequency + phase) * waveHeight;

      waterMesh.position.y = originalY + offsetY;

      const material = waterMesh.material as THREE.MeshStandardMaterial;
      const baseOpacity = 0.85;
      const opacityVariation = Math.sin(this.waterTime * 2 + phase) * 0.05;
      material.opacity = baseOpacity + opacityVariation;
    }
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

  private createVegetation(rm: ResourceManager) {
    const count = 180;
    const data = rm.getModel("tree");
    if (!data) return;

    const treeMesh = this.findFirstMesh(data.scene);
    if (!treeMesh || !treeMesh.geometry) return;

    const { geometry, material } = this.cloneAndRotateGeometry(treeMesh);

    this.treeInstances = new THREE.InstancedMesh(geometry, material, count);
    this.treeInstances.castShadow = true;
    this.treeInstances.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    const clearZoneRadius = 50;

    for (let i = 0; i < count; i++) {
      let x: number, z: number;
      let attempts = 0;

      do {
        const angle = Math.random() * Math.PI * 2;
        const r = clearZoneRadius + Math.random() * (this.size * 0.45 - clearZoneRadius);
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        attempts++;
      } while ((this.isInWater(x, z) || this.isInSafeZone(x, z)) && attempts < 10);

      if (this.isInWater(x, z) || this.isInSafeZone(x, z)) continue;

      const terrainHeight = this.terrain.getHeightAt(x, z);

      position.set(x, terrainHeight, z);
      rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      const s = 0.8 + Math.random() * 0.6;
      scale.set(s, s, s);

      matrix.compose(position, rotation, scale);
      this.treeInstances.setMatrixAt(i, matrix);

      const colliderBox = new THREE.Box3(
        new THREE.Vector3(x - 0.5, terrainHeight, z - 0.5),
        new THREE.Vector3(x + 0.5, terrainHeight + 4, z + 0.5)
      );
      this.colliders.push(colliderBox);
    }

    this.treeInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.treeInstances);
  }

  private createRocks(rm: ResourceManager) {
    const count = 40;
    const data = rm.getModel("rock");
    if (!data) return;

    const rockMesh = this.findFirstMesh(data.scene);
    if (!rockMesh || !rockMesh.geometry) return;

    const { geometry, material } = this.cloneAndRotateGeometry(rockMesh);

    this.rockInstances = new THREE.InstancedMesh(geometry, material, count);
    this.rockInstances.castShadow = true;
    this.rockInstances.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    const clearZoneRadius = 50;

    for (let i = 0; i < count; i++) {
      let x: number, z: number;
      let attempts = 0;

      do {
        x = (Math.random() - 0.5) * this.size * 0.8;
        z = (Math.random() - 0.5) * this.size * 0.8;
        attempts++;
      } while ((this.isInWater(x, z) || this.isInSafeZone(x, z)) && attempts < 10);

      if (this.isInWater(x, z) || this.isInSafeZone(x, z)) continue;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < clearZoneRadius) continue;

      const terrainHeight = this.terrain.getHeightAt(x, z);

      position.set(x, terrainHeight, z);
      rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      const s = 0.6 + Math.random() * 1.2;
      scale.set(s, s, s);

      matrix.compose(position, rotation, scale);
      this.rockInstances.setMatrixAt(i, matrix);

      const colliderBox = new THREE.Box3(
        new THREE.Vector3(x - 1, terrainHeight, z - 1),
        new THREE.Vector3(x + 1, terrainHeight + 2, z + 1)
      );
      this.colliders.push(colliderBox);
    }

    this.rockInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.rockInstances);
  }

  private isInSafeZone(x: number, z: number): boolean {
    const dist = Math.sqrt(x * x + z * z);
    return dist < 45;
  }

  private isInWater(x: number, z: number): boolean {
    for (const lake of this.lakes) {
      const dist = Math.sqrt((x - lake.centerX) ** 2 + (z - lake.centerZ) ** 2);
      if (dist < lake.radius + lake.beachWidth) return true;
    }
    return false;
  }

  private createLighting() {
    const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 0.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
    sun.position.set(80, 150, 60);
    sun.castShadow = true;

    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.0005;

    this.scene.add(sun);
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

    if (this.treeInstances) {
      this.treeInstances.dispose();
    }
    if (this.rockInstances) {
      this.rockInstances.dispose();
    }

    for (const mesh of this.waterMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        mat.dispose();
      }
    }
    this.waterMeshes = [];

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }
}