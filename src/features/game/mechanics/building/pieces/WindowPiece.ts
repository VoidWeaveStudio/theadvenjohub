import * as THREE from 'three';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class WindowPiece extends BuildingPiece {
  constructor(id: string) {
    super(id, 'window');
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.window;
    const { x, y, z } = config.size;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1a,
      roughness: 0.8,
      flatShading: true,
    });

    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(x, 0.08, z + 0.02),
      frameMat
    );
    topFrame.position.y = y / 2;
    this.group.add(topFrame);

    const bottomFrame = new THREE.Mesh(
      new THREE.BoxGeometry(x, 0.08, z + 0.02),
      frameMat
    );
    bottomFrame.position.y = -y / 2;
    this.group.add(bottomFrame);

    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, y, z + 0.02),
      frameMat
    );
    leftFrame.position.x = -x / 2;
    this.group.add(leftFrame);

    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, y, z + 0.02),
      frameMat
    );
    rightFrame.position.x = x / 2;
    this.group.add(rightFrame);

    const centerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, y, z + 0.02),
      frameMat
    );
    this.group.add(centerFrame);

    const glassMat = new THREE.MeshStandardMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.3,
    });
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(x - 0.1, y - 0.1, z * 0.5),
      glassMat
    );
    this.group.add(glass);

    this.collisionBoxes = [];
  }
}