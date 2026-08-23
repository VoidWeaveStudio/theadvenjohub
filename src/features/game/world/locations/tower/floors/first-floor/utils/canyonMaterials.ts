// src/features/game/world/locations/tower/floors/first-floor/utils/canyonMaterials.ts
import * as THREE from "three";
import { CanyonBiome } from "./canyonBiomes";

const propTrunkCache = new Map<string, THREE.MeshStandardMaterial>();
export function getCanyonPropTrunkMaterial(biome: CanyonBiome): THREE.MeshStandardMaterial {
    const cached = propTrunkCache.get(biome.key);
    if (cached) return cached;

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(biome.rockTint).multiplyScalar(0.85),
        roughness: 0.92,
        metalness: 0,
    });
    propTrunkCache.set(biome.key, material);
    return material;
}

const propAccentCache = new Map<string, THREE.MeshStandardMaterial>();
export function getCanyonPropAccentMaterial(biome: CanyonBiome): THREE.MeshStandardMaterial {
    const cached = propAccentCache.get(biome.key);
    if (cached) return cached;

    const accent = new THREE.Color(biome.accent);
    const material = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: biome.propStyle === "cactus" ? 0.12 : 1.1,
        roughness: biome.propStyle === "ice" ? 0.2 : 0.55,
        metalness: 0,
    });
    propAccentCache.set(biome.key, material);
    return material;
}

const sealCache = new Map<string, THREE.MeshBasicMaterial>();
export function getCanyonSealMaterial(biome: CanyonBiome): THREE.MeshBasicMaterial {
    const cached = sealCache.get(biome.key);
    if (cached) return cached;

    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(biome.veinColor),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
    });
    sealCache.set(biome.key, material);
    return material;
}

let arrowGeometryCache: THREE.ShapeGeometry | null = null;
export function getArrowGeometry(): THREE.ShapeGeometry {
    if (arrowGeometryCache) return arrowGeometryCache;
    const shape = new THREE.Shape();
    shape.moveTo(0, 2.4);
    shape.lineTo(1.2, 0.6);
    shape.lineTo(0.5, 0.6);
    shape.lineTo(0.5, -1.4);
    shape.lineTo(-0.5, -1.4);
    shape.lineTo(-0.5, 0.6);
    shape.lineTo(-1.2, 0.6);
    shape.closePath();
    arrowGeometryCache = new THREE.ShapeGeometry(shape);
    return arrowGeometryCache;
}

let arrowMaterialCache: THREE.MeshBasicMaterial | null = null;
export function getArrowMaterial(): THREE.MeshBasicMaterial {
    if (arrowMaterialCache) return arrowMaterialCache;
    arrowMaterialCache = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    return arrowMaterialCache;
}

export function isCachedMaterial(mat: THREE.Material): boolean {
    for (const cached of propTrunkCache.values()) if (cached === mat) return true;
    for (const cached of propAccentCache.values()) if (cached === mat) return true;
    for (const cached of sealCache.values()) if (cached === mat) return true;
    return mat === arrowMaterialCache;
}

const unitGeometryCache = new Map<string, THREE.BufferGeometry>();

function cacheUnit<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    const cached = unitGeometryCache.get(key);
    if (cached) return cached as T;

    const geometry = make();
    unitGeometryCache.set(key, geometry);
    return geometry;
}

export function getUnitBox(): THREE.BoxGeometry {
    return cacheUnit("box", () => new THREE.BoxGeometry(1, 1, 1));
}

export function isCachedGeometry(geo: THREE.BufferGeometry): boolean {
    if (geo === arrowGeometryCache) return true;
    for (const cached of unitGeometryCache.values()) if (cached === geo) return true;
    return false;
}
