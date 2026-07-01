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
    
    fov: 75,
    near: 0.1,
    far: 1000,
};

export const LOBBY_CAMERA_CONFIG = {
    ...CAMERA_CONFIG,
    heightOffset: 3.2,
    far: 500,
};

export const MOVEMENT_CONFIG = {
    speed: 7.0,            
    rotationSmoothness: 15.0, 
};

export const LOBBY_MOVEMENT_CONFIG = {
    speed: 5.0,              
    rotationSmoothness: 12.0,
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
    
    damage: 25,
    shootingAnimationDuration: 200, 
    bulletTrailLength: 3.0,
    bulletLifetime: 0.08, 
    bulletPoolSize: 50,
    muzzleOffsetY: 1.5,
};

export const ANIMATION_CONFIG = {
    footstepInterval: 0.35,
    
    isMovingThreshold: {
        self: 0.01,
        other: 0.05,
    },
    
    deathAnimationDuration: 1.25,
    deathFallAngle: Math.PI / 2,
};

export const COLLISION_CONFIG = {
    playerRadius: 0.25,    
    gridCellSize: 10,       
};

export const PLAYER_CONFIG = {
    hitFlashDuration: 0.3,
    hitFlashIntensity: 5,
    spawnProtectionDuration: 3000, 
    
    height: 1.8,
    groundOffset: 0,
};

export const UI_CONFIG = {
    killFeed: {
        duration: 5000, 
        maxEntries: 5,
    },
    damageIndicators: {
        duration: 2000, 
    },
    hitMarker: {
        duration: 200, 
    },
    healthBar: {
        lowHealthThreshold: 30,
        mediumHealthThreshold: 70,
    },
};

export const CHAT_CONFIG = {
    maxMessages: 50,
    visibleMessages: 8,
    maxMessageLength: 200,
};

export const GAME_CONFIG = {
    maxPlayers: {
        '5v5': 10,
        'ffa': 20,
    },
    matchDuration: 600000,
    killsToWin: 50,
};

// Типы
export type CameraConfig = typeof CAMERA_CONFIG;
export type MovementConfig = typeof MOVEMENT_CONFIG;
export type PhysicsConfig = typeof PHYSICS_CONFIG;
export type MouseConfig = typeof MOUSE_CONFIG;
export type WeaponConfig = typeof WEAPON_CONFIG;
export type AnimationConfig = typeof ANIMATION_CONFIG;
export type CollisionConfig = typeof COLLISION_CONFIG;
export type PlayerConfig = typeof PLAYER_CONFIG;
export type UIConfig = typeof UI_CONFIG;
export type ChatConfig = typeof CHAT_CONFIG;
export type GameConfig = typeof GAME_CONFIG;