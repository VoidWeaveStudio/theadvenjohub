export interface Player {
    id: string;
    username: string;
    wallet?: string;
    team: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    health: number;
    kills: number;
    deaths: number;
    isAlive: boolean;
}

export interface PlayerAnimationData {
    walkPhase: number;
    isMoving: boolean;
    hitFlash: number;
    deathAnimation: number;
}

export interface CollisionBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface GameState {
    players: Player[];
    myHealth: number;
    myKills: number;
    myDeaths: number;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    gameStatus: 'waiting' | 'playing' | 'ended';
    scores: Record<string | number, number>;
    winner: any;
}

export type GameMode = '5v5' | 'ffa';