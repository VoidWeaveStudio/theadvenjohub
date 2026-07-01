import * as THREE from 'three';
import { BuildingPieceType, BuildingPieceData } from '../types';
import { PIECE_CONFIGS } from '../config';
import { CollisionBox3D } from '../../../map/types';

export abstract class BuildingPiece {
  readonly group: THREE.Group;
  readonly id: string;
  readonly type: BuildingPieceType;
  protected collisionBoxes: CollisionBox3D[] = [];

  constructor(id: string, type: BuildingPieceType) {
    this.id = id;
    this.type = type;
    this.group = new THREE.Group();
    this.group.name = `piece_${id}`;
  }

  abstract build(): void;

  getCollisionBoxes(): CollisionBox3D[] {
    return this.collisionBoxes;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
    this.updateCollisionBoxes();
  }

  setRotation(angle: number): void {
    this.group.rotation.y = angle;
    this.updateCollisionBoxes();
  }

  protected updateCollisionBoxes(): void {
    const matrix = this.group.matrixWorld;
    this.collisionBoxes = this.collisionBoxes.map(box => {
      const min = new THREE.Vector3(box.minX, box.minY, box.minZ).applyMatrix4(matrix);
      const max = new THREE.Vector3(box.maxX, box.maxY, box.maxZ).applyMatrix4(matrix);
      return {
        minX: Math.min(min.x, max.x),
        maxX: Math.max(min.x, max.x),
        minY: Math.min(min.y, max.y),
        maxY: Math.max(min.y, max.y),
        minZ: Math.min(min.z, max.z),
        maxZ: Math.max(min.z, max.z),
      };
    });
  }

  setTransparent(opacity: number): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = opacity;
        mat.needsUpdate = true;
      }
    });
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }

  toData(): BuildingPieceData {
    const pos = this.group.position;
    return {
      id: this.id,
      type: this.type,
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: this.group.rotation.y,
    };
  }
}