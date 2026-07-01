import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class WallWithDoorwayPiece extends BuildingPiece {
  constructor(id: string) {
    super(id, 'wall_with_doorway');
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.wall_with_doorway;
    const { x, y, z } = config.size;
    const doorWidth = 1.2;
    const doorHeight = 2.4;

    const wallMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    const leftWidth = (x - doorWidth) / 2;
    const leftGeo = new THREE.BoxGeometry(leftWidth, y, z);
    leftGeo.translate(-x / 2 + leftWidth / 2, y / 2, 0);

    const rightGeo = new THREE.BoxGeometry(leftWidth, y, z);
    rightGeo.translate(x / 2 - leftWidth / 2, y / 2, 0);

    const topHeight = y - doorHeight;
    const topGeo = new THREE.BoxGeometry(doorWidth, topHeight, z);
    topGeo.translate(0, doorHeight + topHeight / 2, 0);

    const merged = mergeGeometries([leftGeo, rightGeo, topGeo], false);
    if (merged) {
      const wall = new THREE.Mesh(merged, wallMat);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);
    }

    this.collisionBoxes = [
      {
        minX: -x / 2,
        maxX: -doorWidth / 2,
        minY: 0,
        maxY: y,
        minZ: -z / 2,
        maxZ: z / 2,
      },
      {
        minX: doorWidth / 2,
        maxX: x / 2,
        minY: 0,
        maxY: y,
        minZ: -z / 2,
        maxZ: z / 2,
      },
      {
        minX: -doorWidth / 2,
        maxX: doorWidth / 2,
        minY: doorHeight,
        maxY: y,
        minZ: -z / 2,
        maxZ: z / 2,
      },
    ];
  }
}