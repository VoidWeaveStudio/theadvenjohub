// src/features/game/world/AssetBin.ts
import * as THREE from "three";

export class AssetBin {
    private readonly textures = new Set<THREE.Texture>();
    private readonly materials = new Set<THREE.Material>();
    private readonly geometries = new Set<THREE.BufferGeometry>();

    texture<T extends THREE.Texture>(texture: T): T {
        this.textures.add(texture);
        return texture;
    }

    material<T extends THREE.Material>(material: T): T {
        this.materials.add(material);
        return material;
    }

    geometry<T extends THREE.BufferGeometry>(geometry: T): T {
        this.geometries.add(geometry);
        return geometry;
    }

    dispose() {
        this.materials.forEach((material) => material.dispose());
        this.geometries.forEach((geometry) => geometry.dispose());
        this.textures.forEach((texture) => texture.dispose());
        this.materials.clear();
        this.geometries.clear();
        this.textures.clear();
    }
}
