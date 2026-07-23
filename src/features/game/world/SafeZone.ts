// src/features/game/world/SafeZone.ts
import * as THREE from "three";
import { Terrain } from "./Terrain";

export class SafeZone {
  private radius: number = 12;
  private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private ring!: THREE.Mesh;
  private disc!: THREE.Mesh;
  private terrain: Terrain | null = null;

  create(
    scene: THREE.Scene,
    terrain?: Terrain,
    centerPosition?: THREE.Vector3,
    radius?: number
  ) {
    this.terrain = terrain || null;
    if (centerPosition) this.position = centerPosition.clone();
    if (radius) this.radius = radius;

    const { x: cx, z: cz } = this.position;
    const groundY = this.terrain ? this.terrain.getHeightAt(cx, cz) : 0;

    const ringGeo = new THREE.RingGeometry(this.radius - 0.5, this.radius, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(cx, groundY + 0.05, cz);
    scene.add(this.ring);

    const discGeo = new THREE.CircleGeometry(this.radius - 0.5, 64);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(discGeo, discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.set(cx, groundY + 0.03, cz);
    scene.add(this.disc);
  }

  update(_delta: number) {
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