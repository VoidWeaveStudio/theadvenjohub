// src/features/game/world/locations/tower/floors/main-hall/utils/textureQuality.ts
import * as THREE from "three";

let maxAnisotropy = 8;

export function configureTextureQuality(renderer: THREE.WebGLRenderer | undefined) {
    if (!renderer) return;
    maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
}

export function getAnisotropy(): number {
    return maxAnisotropy;
}
