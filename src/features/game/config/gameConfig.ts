// src/features/game/config/gameConfig.ts

export const CAMERA_CONFIG = {
    distance: 6.0,         
    heightOffset: 3.5,       
    focusHeight: 2.8,       
    smoothing: 8,         
    
    collisionRadius: 0.5,   
    collisionSteps: 15,     
    minHeight: 1.2,         
    enableCollision: true,  
    
    minPitch: -Math.PI / 8, 
    maxPitch: Math.PI / 2.5,
};


export const LOBBY_CAMERA_CONFIG = {
    ...CAMERA_CONFIG,
    heightOffset: 3.2,   
};


export const GAME_CAMERA_CONFIG = {
    ...CAMERA_CONFIG,
};


export const MOVEMENT_CONFIG = {
    speed: 7.0,            
    rotationSmoothness: 15.0, 
};


export const LOBBY_MOVEMENT_CONFIG = {
    speed: 5.0,              
    rotationSmoothness: 12.0,
};


export const GAME_MOVEMENT_CONFIG = {
    ...MOVEMENT_CONFIG,
};


export const PHYSICS_CONFIG = {
    gravity: -20.0,        
    jumpForce: 8.0,         
    groundLevel: 0,        
};


export const MOUSE_CONFIG = {
    sensitivity: 0.003,     
    minPitch: -1.2,         
    maxPitch: 1.2,         
};


export const WEAPON_CONFIG = {
    fireRate: 120,        
    maxAmmo: 30,             
    reloadTime: 2000,      
};


export const ANIMATION_CONFIG = {
    footstepInterval: 0.35,
};

export const COLLISION_CONFIG = {
    playerRadius: 0.25,    
    gridCellSize: 10,       
};


export type CameraConfig = typeof CAMERA_CONFIG;
export type MovementConfig = typeof MOVEMENT_CONFIG;
export type PhysicsConfig = typeof PHYSICS_CONFIG;
export type MouseConfig = typeof MOUSE_CONFIG;
export type WeaponConfig = typeof WEAPON_CONFIG;
export type AnimationConfig = typeof ANIMATION_CONFIG;
export type CollisionConfig = typeof COLLISION_CONFIG;