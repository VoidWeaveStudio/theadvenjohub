import * as THREE from 'three';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class DoorPiece extends BuildingPiece {
  private doorMesh: THREE.Mesh;
  private isOpen: boolean = false;
  private targetRotation: number = 0;
  private currentRotation: number = 0;
  private hingeOffset: THREE.Vector3;

  constructor(id: string) {
    super(id, 'door');
    this.hingeOffset = new THREE.Vector3();
    this.doorMesh = new THREE.Mesh();
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.door;
    const { x, y, z } = config.size;

    const doorGeo = new THREE.BoxGeometry(x, y, z);
    doorGeo.translate(x / 2, y / 2, 0); 

    const doorMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.7,
      metalness: 0.2,
      flatShading: true,
    });

    this.doorMesh = new THREE.Mesh(doorGeo, doorMat);
    this.doorMesh.castShadow = true;
    this.doorMesh.receiveShadow = true;
    this.doorMesh.name = 'door';
    this.group.add(this.doorMesh);

    const handleGeo = new THREE.BoxGeometry(0.05, 0.15, 0.08);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xccaa00,
      metalness: 0.9,
      roughness: 0.3,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(x * 0.8, y / 2, z / 2 + 0.04);
    this.group.add(handle);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1a,
      roughness: 0.8,
      flatShading: true,
    });

    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, y, z + 0.05),
      frameMat
    );
    leftFrame.position.set(-0.05, y / 2, 0);
    this.group.add(leftFrame);

    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, y, z + 0.05),
      frameMat
    );
    rightFrame.position.set(x + 0.05, y / 2, 0);
    this.group.add(rightFrame);

    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(x + 0.2, 0.1, z + 0.05),
      frameMat
    );
    topFrame.position.set(x / 2, y + 0.05, 0);
    this.group.add(topFrame);

    this.collisionBoxes = [];
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.targetRotation = this.isOpen ? -Math.PI / 2 : 0;
  }

  update(deltaTime: number): void {
    const speed = 5;
    const diff = this.targetRotation - this.currentRotation;
    if (Math.abs(diff) > 0.01) {
      this.currentRotation += diff * Math.min(1, speed * deltaTime);
      this.doorMesh.rotation.y = this.currentRotation;
    }
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }
}