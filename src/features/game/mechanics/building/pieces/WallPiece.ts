import * as THREE from 'three';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class WallPiece extends BuildingPiece {
  constructor(id: string) {
    super(id, 'wall');
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.wall;
    const { x, y, z } = config.size;

    const wallGeo = new THREE.BoxGeometry(x, y, z);
    const wallMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = y / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0x606060 });
    for (let i = 1; i < 6; i++) {
      const lineGeo = new THREE.BoxGeometry(x, 0.02, z + 0.01);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.y = i * 0.5;
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