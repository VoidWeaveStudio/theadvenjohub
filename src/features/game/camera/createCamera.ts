// src/features/game/camera/createCamera.ts
import * as THREE from 'three';
import { CAMERA_CONFIG, CameraConfig } from './config';

export function createCameraFromConfig(config: CameraConfig = CAMERA_CONFIG): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        config.fov,
        window.innerWidth / window.innerHeight,
        config.near,
        config.far,
    );
    
    camera.position.set(0, config.heightOffset, config.distance);
    camera.rotation.order = 'YXZ';
    
    return camera;
}