import * as THREE from 'three';
import { BuildingPiece } from '../pieces/BuildingPiece';
import { WallPiece } from '../pieces/WallPiece';
import { StairsPiece } from '../pieces/StairsPiece';
import { DoorPiece } from '../pieces/DoorPiece';
import { WallWithDoorwayPiece } from '../pieces/WallWithDoorwayPiece';
import { WindowPiece } from '../pieces/WindowPiece';
import { FloorPiece } from '../pieces/FloorPiece';
import { BuildingPieceType, BuildingPieceData } from '../types';
import { CollisionSystem } from '../../../map/CollisionSystem';

export class BuildingManager {
  private pieces = new Map<string, BuildingPiece>();
  private scene: THREE.Scene;
  private collisionSystem: CollisionSystem;
  private counter: number = 0;

  constructor(scene: THREE.Scene, collisionSystem: CollisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
  }

  createPiece(type: BuildingPieceType): BuildingPiece {
    const id = `piece_${this.counter++}`;
    let piece: BuildingPiece;

    switch (type) {
      case 'wall':
        piece = new WallPiece(id);
        break;
      case 'stairs':
        piece = new StairsPiece(id);
        break;
      case 'door':
        piece = new DoorPiece(id);
        break;
      case 'wall_with_doorway':
        piece = new WallWithDoorwayPiece(id);
        break;
      case 'window':
        piece = new WindowPiece(id);
        break;
      case 'floor':
        piece = new FloorPiece(id);
        break;
      default:
        throw new Error(`Unknown piece type: ${type}`);
    }

    return piece;
  }

  placePiece(piece: BuildingPiece, x: number, y: number, z: number, rotation: number = 0): void {
    piece.setPosition(x, y, z);
    piece.setRotation(rotation);
    this.scene.add(piece.group);
    this.pieces.set(piece.id, piece);

    piece.getCollisionBoxes().forEach(box => {
      this.collisionSystem.addSolid(box);
    });
  }

  removePiece(id: string): boolean {
    const piece = this.pieces.get(id);
    if (!piece) return false;

    piece.getCollisionBoxes().forEach(box => {
      this.collisionSystem.removeSolid(box);
    });

    piece.dispose();
    this.pieces.delete(id);
    return true;
  }

  getPiece(id: string): BuildingPiece | undefined {
    return this.pieces.get(id);
  }

  getAllPieces(): BuildingPiece[] {
    return Array.from(this.pieces.values());
  }

  getPieceCount(): number {
    return this.pieces.size;
  }

  update(deltaTime: number): void {
    this.pieces.forEach(piece => {
      if (piece instanceof DoorPiece) {
        piece.update(deltaTime);
      }
    });
  }

  findNearestDoor(position: THREE.Vector3, maxDistance: number = 2): DoorPiece | null {
    let nearest: DoorPiece | null = null;
    let minDist = maxDistance;

    this.pieces.forEach(piece => {
      if (piece instanceof DoorPiece) {
        const dist = piece.group.position.distanceTo(position);
        if (dist < minDist) {
          minDist = dist;
          nearest = piece;
        }
      }
    });

    return nearest;
  }

  clear(): void {
    this.pieces.forEach(piece => {
      piece.getCollisionBoxes().forEach(box => {
        this.collisionSystem.removeSolid(box);
      });
      piece.dispose();
    });
    this.pieces.clear();
  }

  dispose(): void {
    this.clear();
  }
}