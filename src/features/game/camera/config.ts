// src/features/game/camera/config.ts

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

export type CameraConfig = typeof CAMERA_CONFIG;