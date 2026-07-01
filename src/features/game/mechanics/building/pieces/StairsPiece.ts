import * as THREE from 'three';
import { BuildingPiece } from './BuildingPiece';
import { PIECE_CONFIGS } from '../config';

export class StairsPiece extends BuildingPiece {
  constructor(id: string) {
    super(id, 'stairs');
    this.build();
  }

  build(): void {
    const config = PIECE_CONFIGS.stairs;
    const { x, y, z } = config.size;
    const stepCount = 6;
    const stepHeight = y / stepCount;
    const stepDepth = z / stepCount;

    const stepMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });

    for (let i = 0; i < stepCount; i++) {
      const stepGeo = new THREE.BoxGeometry(x, stepHeight, stepDepth);
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, stepHeight * (i + 0.5), -z / 2 + stepDepth * (i + 0.5));
      step.castShadow = true;
      step.receiveShadow = true;
      this.group.add(step);
    }

    for (let i = 0; i < stepCount; i++) {
      this.collisionBoxes.push({
        minX: -x / 2,
        maxX: x / 2,
        minY: stepHeight * i,
        maxY: stepHeight * (i + 1),
        minZ: -z / 2 + stepDepth * i,
        maxZ: -z / 2 + stepDepth * (i + 1),
      });
    }
  }
}