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
    this.createCaveEntrance(rm);
  }

  private createCaveEntrance(rm: ResourceManager) {
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
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * (this.size * 0.45 - 45);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const data = rm.getModel("tree");
      if (!data) continue;
      const tree = data.scene;
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.8 + Math.random() * 0.6;
      tree.scale.setScalar(scale);
      this.scene.add(tree);

      const box = new THREE.Box3().setFromObject(tree);
      this.colliders.push(box);
    }
  }

  private createRocks(rm: ResourceManager) {
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * this.size * 0.8;
      const z = (Math.random() - 0.5) * this.size * 0.8;
      const dist = Math.sqrt(x * x + z * z);
      if (dist < 45) continue;

      const data = rm.getModel("rock");
      if (!data) continue;
      const rock = data.scene;
      rock.position.set(x, 0, z);
      rock.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 1.2;
      rock.scale.setScalar(s);
      this.scene.add(rock);

      const box = new THREE.Box3().setFromObject(rock);
      this.colliders.push(box);
    }
  }

  private createLighting() {
    const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 0.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
    sun.position.set(80, 150, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  getSpawnPoint(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  dispose() {
    this.terrain.dispose();
    this.gridSystem.dispose();
  }
}