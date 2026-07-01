// src/features/game/mechanics/building/types.ts
export type BuildingPieceType = 
  | 'wall' 
  | 'stairs' 
  | 'door' 
  | 'wall_with_doorway' 
  | 'window' 
  | 'floor';

export interface BuildingPieceData {
  id: string;
  type: BuildingPieceType;
  position: { x: number; y: number; z: number };
  rotation: number;
  collisionBox?: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
}

export interface BuildingPieceConfig {
  type: BuildingPieceType;
  name: string;
  icon: string;
  size: { x: number; y: number; z: number };
  color: number;
  hasCollision: boolean;
  isInteractive?: boolean;
}

export interface BuildingConfig {
  maxPieces: number;
  placeDistance: number;
  pieceTypes: BuildingPieceType[];
}