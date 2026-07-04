//src\features\game\world\MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { Terrain } from "../Terrain";
import { GridSystem } from "../GridSystem";

export class MainWorld extends Location {
  public readonly size = 500;
  public gridSystem: GridSystem;
  public terrain: Terrain;
  private treeInstances: THREE.InstancedMesh | null = null;
  private rockInstances: THREE.InstancedMesh | null = null;

  constructor() {
    super("main-world", "TANJO World");
    this.terrain = new Terrain(this.size, 64);
    this.gridSystem = new GridSystem(this.size, 5);
  }

  create(rm: ResourceManager) {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 150, 700);

    this.terrain.create(this.scene);
    this.gridSystem.createVisualization(this.scene);
    this.createWater();
    this.createVegetation(rm);
    this.createRocks(rm);
    this.createLighting();
    this.createCaveEntrance();
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
      color: 0x3a7fd5,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.3,
    });

    const river = new THREE.Mesh(new THREE.PlaneGeometry(15, this.size), waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(120, 0.05, 0);
    this.scene.add(river);

    const lake = new THREE.Mesh(new THREE.CircleGeometry(35, 32), waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-100, 0.05, -90);
    this.scene.add(lake);
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
    if (!data) {
      console.warn("[MainWorld] Tree model not available, skipping vegetation");
      return;
    }

    const treeMesh = this.findFirstMesh(data.scene);
    if (!treeMesh || !treeMesh.geometry) {
      console.warn("[MainWorld] Invalid tree mesh structure, skipping vegetation");
      return;
    }

    console.log(`[MainWorld] Tree model loaded successfully: ${treeMesh.geometry.attributes.position.count} vertices`);

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
      const angle = Math.random() * Math.PI * 2;
      const r = clearZoneRadius + Math.random() * (this.size * 0.45 - clearZoneRadius);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

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
    console.log(`[MainWorld] Created ${count} tree instances`);
  }

  private createRocks(rm: ResourceManager) {
    const count = 40;
    const data = rm.getModel("rock");
    if (!data) {
      console.warn("[MainWorld] Rock model not available, skipping rocks");
      return;
    }

    const rockMesh = this.findFirstMesh(data.scene);
    if (!rockMesh || !rockMesh.geometry) {
      console.warn("[MainWorld] Invalid rock mesh structure, skipping rocks");
      return;
    }

    console.log(`[MainWorld] Rock model loaded successfully: ${rockMesh.geometry.attributes.position.count} vertices`);

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
      const x = (Math.random() - 0.5) * this.size * 0.8;
      const z = (Math.random() - 0.5) * this.size * 0.8;
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
    console.log(`[MainWorld] Created ${count} rock instances`);
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
    const spawnY = this.terrain.getHeightAt(0, 0);
    return new THREE.Vector3(0, spawnY, 0);
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
  }
}