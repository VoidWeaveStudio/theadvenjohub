//src\features\game\world\SafeZone.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

export class SafeZone {
  private radius: number = 30;
  private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private crystal!: THREE.Group;
  private textSprite!: THREE.Sprite;
  private time: number = 0;

  create(scene: THREE.Scene, resourceManager: ResourceManager) {
    const data = resourceManager.getModel("crystal");
    if (!data) {
      throw new Error("Crystal model not found. Cannot create safe zone.");
    }

    this.crystal = data.scene;
    this.crystal.position.set(0, 3, 0);
    this.crystal.scale.setScalar(1.2);
    scene.add(this.crystal);

    const light = new THREE.PointLight(0x00ffff, 2, 25);
    light.position.set(0, 4, 0);
    scene.add(light);

    const ringGeo = new THREE.RingGeometry(this.radius - 0.5, this.radius, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    scene.add(ring);

    const discGeo = new THREE.CircleGeometry(this.radius - 0.5, 64);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    scene.add(disc);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0, 255, 255, 0.95)";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00aaff";
    ctx.shadowBlur = 20;
    ctx.fillText("EVENTS", 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    this.textSprite = new THREE.Sprite(textMat);
    this.textSprite.position.set(0, 6.5, 0);
    this.textSprite.scale.set(8, 2, 1);
    scene.add(this.textSprite);

    this.crystal.userData.interactionId = "crystal";
  }

  update(delta: number) {
    this.time += delta;
    
    this.crystal.rotation.y = this.time * 0.5;
    this.crystal.position.y = 3 + Math.sin(this.time * 1.2) * 0.4;
    this.textSprite.position.y = 6.5 + Math.sin(this.time * 1.2) * 0.4;
  }

  getInteractableObject(): THREE.Object3D {
    return this.crystal;
  }

  getPosition(): THREE.Vector3 {
    return this.position;
  }

  getRadius(): number {
    return this.radius;
  }

  dispose() {
  }
}