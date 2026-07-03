//src\features\game\types\index.ts
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface PlayerData {
    id: string;
    nickname: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    maxHealth: number;
    isAlive: boolean;
    skin: string;
}

export interface WeaponData {
    id: string;
    type: 'rifle' | 'pistol' | 'shotgun';
    damage: number;
    fireRate: number;
    ammo: number;
    maxAmmo: number;
}

export interface GameState {
    players: Map<string, PlayerData>;
    localPlayerId: string;
    onlineCount: number;
}

export interface NetworkMessage {
    type: string;
    payload: any;
    timestamp: number;
}

export interface SafeZoneConfig {
    center: Vector3;
    radius: number;
}

export interface GameConfig {
    serverUrl: string;
    maxPlayers: number;
    safeZone: SafeZoneConfig;
    worldSize: { width: number; height: number };
}