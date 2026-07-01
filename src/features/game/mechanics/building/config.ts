import { BuildingPieceConfig, BuildingPieceType } from './types';

export const BUILDING_CONFIG = {
  maxPieces: 50,
  placeDistance: 8,
  pieceTypes: ['wall', 'stairs', 'door', 'wall_with_doorway', 'window', 'floor'] as BuildingPieceType[],
};

export const PIECE_CONFIGS: Record<BuildingPieceType, BuildingPieceConfig> = {
  wall: {
    type: 'wall',
    name: 'Wall',
    icon: '🧱',
    size: { x: 4, y: 3, z: 0.2 },
    color: 0x8b8680,
    hasCollision: true,
  },
  stairs: {
    type: 'stairs',
    name: 'Stairs',
    icon: '🪜',
    size: { x: 2, y: 3, z: 4 },
    color: 0x8b6f47,
    hasCollision: true,
  },
  door: {
    type: 'door',
    name: 'Door',
    icon: '🚪',
    size: { x: 1.2, y: 2.4, z: 0.1 },
    color: 0x6b4423,
    hasCollision: false,
    isInteractive: true,
  },
  wall_with_doorway: {
    type: 'wall_with_doorway',
    name: 'Wall w/ Doorway',
    icon: '🚪🧱',
    size: { x: 4, y: 3, z: 0.2 },
    color: 0x8b8680,
    hasCollision: true,
  },
  window: {
    type: 'window',
    name: 'Window',
    icon: '🪟',
    size: { x: 1.5, y: 1, z: 0.1 },
    color: 0x88ccff,
    hasCollision: false,
  },
  floor: {
    type: 'floor',
    name: 'Floor',
    icon: '⬜',
    size: { x: 4, y: 0.2, z: 4 },
    color: 0x6b4423,
    hasCollision: true,
  },
};