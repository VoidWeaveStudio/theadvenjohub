// src/features/game/map/types.ts
import * as THREE from 'three';

export type GameModeId = 
    | '5v5' | 'ffa'
    | 'rpg' | 'quest'
    | 'social' | 'lobby'
    | 'fishing' | 'racing';

export type MapId = string;

export interface GameModeConfig {
    id: GameModeId;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    defaultMapId: MapId;
    settings?: Record<string, unknown>;
}

export interface MapConfig {
    id: MapId;
    name: string;
    description: string;
    compatibleModes: GameModeId[];
    terrain: TerrainConfig;
    collisions: CollisionLayerConfig;
    spawnPoints: SpawnPointsConfig;
    interactables?: InteractableConfig[];
    metadata?: MapMetadata;
}

export interface TerrainConfig {
    type: 'procedural' | 'heightmap' | 'modular';
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
    groundLevel: number;
}

export type MaterialType = 'wood' | 'stone' | 'metal' | 'water' | 'brick' | 'concrete' | 'sand';

export interface CollisionLayerConfig {
    solid: CollisionBox3D[];
    water?: CollisionBox3D[];
    hazard?: CollisionBox3D[];
    trigger?: TriggerBox[];
    boundaries: CollisionBox3D[];
}

export interface CollisionBox3D {
    id?: string;
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
    properties?: {
        climbable?: boolean;
        breakable?: boolean;
        friction?: number;
        material?: MaterialType;
    };
}

export interface TriggerBox extends CollisionBox3D {
    triggerId: string;
    onEnter?: string;
    onExit?: string;
    oneShot?: boolean;
}

export interface SpawnPointsConfig {
    [teamId: string]: Array<{ x: number; y: number; z: number; yaw?: number }>;
}

export interface InteractableConfig {
    id: string;
    type: 'door' | 'portal' | 'npc' | 'chest' | 'fishing_spot' | 'vehicle';
    position: { x: number; y: number; z: number };
    rotation?: number;
    data?: Record<string, unknown>;
}

export interface MapMetadata {
    skybox?: string;
    ambientLight?: number;
    fog?: { color: number; near: number; far: number };
    music?: string;
    weather?: 'clear' | 'rain' | 'snow' | 'fog';
}