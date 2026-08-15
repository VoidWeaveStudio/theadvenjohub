// src/features/game/world/locations/main-world/utils/towerTextures.ts
import * as THREE from "three";

export interface TowerTextureSet {
    map: THREE.Texture;
    normalMap: THREE.Texture;
    aoRoughMap: THREE.Texture;
}

const BASE_PATH = "/models/textures/tower";
const loader = new THREE.TextureLoader();

function load(name: string, srgb: boolean, repeatX: number, repeatY: number): THREE.Texture {
    const texture = loader.load(`${BASE_PATH}/${name}.webp`);

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 8;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

export function loadTowerTextures(slug: string, repeatX: number, repeatY: number): TowerTextureSet {
    return {
        map: load(`${slug}_Diffuse`, true, repeatX, repeatY),
        normalMap: load(`${slug}_nor_gl`, false, repeatX, repeatY),
        aoRoughMap: load(`${slug}_arm`, false, repeatX, repeatY),
    };
}

export function applyTowerTextures(
    material: THREE.MeshStandardMaterial,
    textures: TowerTextureSet
): THREE.MeshStandardMaterial {
    material.map = textures.map;
    material.normalMap = textures.normalMap;
    material.aoMap = textures.aoRoughMap;
    material.roughnessMap = textures.aoRoughMap;
    material.metalnessMap = textures.aoRoughMap;
    material.needsUpdate = true;

    return material;
}
