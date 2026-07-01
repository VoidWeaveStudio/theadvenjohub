import * as THREE from 'three';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class FloorPiece extends BuildingPiece {
  constructor(id: string) {
    super(id, 'floor');
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.floor;
    const { x, y, z } = config.size;

    const floorMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });

    const floorGeo = new THREE.BoxGeometry(x, y, z);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = y / 2;
    floor.castShadow = true;
    floor.receiveShadow = true;
    this.group.add(floor);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0x4a2f1a });
    for (let i = 1; i < 4; i++) {
      const lineGeo = new THREE.BoxGeometry(0.02, y + 0.01, z);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(-x / 2 + i * (x / 4), y / 2, 0);
      this.group.add(line);
    }

    this.collisionBoxes = [{
      minX: -x / 2,
      maxX: x / 2,
      minY: 0,
      maxY: y,
      minZ: -z / 2,
      maxZ: z / 2,
    }];
  }
}