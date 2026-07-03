//src\features\game\world\MainWorld.ts
import * as THREE from "three";
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { Terrain } from "../Terrain";
import { GridSystem } from "../GridSystem";

export class MainWorld extends Location {
  public readonly size = 500;
  public gridSystem: GridSystem;
  private terrain: Terrain;
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
    arch.position.set(200, 0, -150);
    arch.rotation.x = Math.PI;
    this.scene.add(arch);

    const entranceGeo = new THREE.CircleGeometry(2.8, 32);
    const entranceMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const entrance = new THREE.Mesh(entranceGeo, entranceMat);
    entrance.position.set(200, 2.8, -150);
    this.scene.add(entrance);

    this.addPortal({
      id: "main-to-cave",
      position: new THREE.Vector3(200, 0, -150),
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

  private createVegetation(rm: ResourceManager) {
    const count = 180;
    const data = rm.getModel("tree");
    if (!data) {
      throw new Error("Tree model not found. Cannot create vegetation.");
    }

    const treeMesh = data.scene.children[0] as THREE.Mesh;
    if (!treeMesh || !treeMesh.geometry) {
      throw new Error("Invalid tree mesh structure.");
    }

    const geometry = treeMesh.geometry;
    const material = treeMesh.material as THREE.Material;

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

      position.set(x, 0, z);
      rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      const s = 0.8 + Math.random() * 0.6;
      scale.set(s, s, s);

      matrix.compose(position, rotation, scale);
      this.treeInstances.setMatrixAt(i, matrix);

      const colliderBox = new THREE.Box3(
        new THREE.Vector3(x - 0.5, 0, z - 0.5),
        new THREE.Vector3(x + 0.5, 4, z + 0.5)
      );
      this.colliders.push(colliderBox);
    }

    this.treeInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.treeInstances);
  }

  private createRocks(rm: ResourceManager) {
    const count = 40;
    const data = rm.getModel("rock");
    if (!data) {
      throw new Error("Rock model not found. Cannot create rocks.");
    }

    const rockMesh = data.scene.children[0] as THREE.Mesh;
    if (!rockMesh || !rockMesh.geometry) {
      throw new Error("Invalid rock mesh structure.");
    }

    const geometry = rockMesh.geometry;
    const material = rockMesh.material as THREE.Material;

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

      position.set(x, 0, z);
      rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      const s = 0.6 + Math.random() * 1.2;
      scale.set(s, s, s);

      matrix.compose(position, rotation, scale);
      this.rockInstances.setMatrixAt(i, matrix);

      const colliderBox = new THREE.Box3(
        new THREE.Vector3(x - 1, 0, z - 1),
        new THREE.Vector3(x + 1, 2, z + 1)
      );
      this.colliders.push(colliderBox);
    }

    this.rockInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.rockInstances);
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
    return new THREE.Vector3(0, 0, 0);
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