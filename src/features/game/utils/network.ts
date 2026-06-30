// src/features/game/utils/network.ts

export interface Position3D {
    x: number;
    y: number;
    z: number;
}

export interface Rotation3D {
    x: number;
    y: number;
    z: number;
}


export function unpackPosition(pos: any): Position3D {
    if (Array.isArray(pos)) {
        return { 
            x: pos[0] ?? 0, 
            y: pos[1] ?? 0, 
            z: pos[2] ?? 0 
        };
    }
    return {
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        z: pos?.z ?? 0,
    };
}


export function unpackRotation(rot: any): Rotation3D {
    if (Array.isArray(rot)) {
        return { 
            x: rot[0] ?? 0, 
            y: rot[1] ?? 0, 
            z: rot[2] ?? 0 
        };
    }
    return {
        x: rot?.x ?? 0,
        y: rot?.y ?? 0,
        z: rot?.z ?? 0,
    };
}


export function packPosition(pos: Position3D): [number, number, number] {
    return [pos.x, pos.y, pos.z];
}


export function packRotation(rot: Rotation3D): [number, number, number] {
    return [rot.x, rot.y, rot.z];
}