import * as THREE from 'three';
import { BuildingPiece } from '../pieces/BuildingPiece';
import { BuildingPieceType } from '../types';
import { BuildingManager } from './BuildingManager';

export class BuildingPreview {
  private previewPiece: BuildingPiece | null = null;
  private scene: THREE.Scene;
  private buildingManager: BuildingManager;
  private isValid: boolean = true;

  constructor(scene: THREE.Scene, buildingManager: BuildingManager) {
    this.scene = scene;
    this.buildingManager = buildingManager;
  }

  show(type: BuildingPieceType): void {
    this.hide();
    this.previewPiece = this.buildingManager.createPiece(type);
    this.previewPiece.setTransparent(0.5);
    this.scene.add(this.previewPiece.group);
  }

  hide(): void {
    if (this.previewPiece) {
      this.scene.remove(this.previewPiece.group);
      this.previewPiece.dispose();
      this.previewPiece = null;
    }
  }

  updatePosition(x: number, y: number, z: number, rotation: number = 0): void {
    if (!this.previewPiece) return;
    this.previewPiece.setPosition(x, y, z);
    this.previewPiece.setRotation(rotation);
    this.updateColor();
  }

  setValid(valid: boolean): void {
    this.isValid = valid;
    this.updateColor();
  }

  private updateColor(): void {
    if (!this.previewPiece) return;
    
    const color = this.isValid ? 0x00ff00 : 0xff0000;
    this.previewPiece.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(color);
        mat.emissiveIntensity = 0.3;
      }
    });
  }

  getPiece(): BuildingPiece | null {
    return this.previewPiece;
  }

  dispose(): void {
    this.hide();
  }
}