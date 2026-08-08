// src/features/game/world/locations/tower/floors/first-floor/utils/canyonMaterials.ts
import * as THREE from "three";
import { CanyonBiome, CANYON_BIOMES_BY_KEY } from "./canyonBiomes";

const DEFAULT_BIOME = CANYON_BIOMES_BY_KEY.get("slime_valley")!;

const rockTextureCache = new Map<string, THREE.Texture>();
export function getCanyonRockTexture(biome: CanyonBiome = DEFAULT_BIOME): THREE.Texture {
    const cached = rockTextureCache.get(biome.key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = biome.rockBase;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(200,175,130,0.3)");
    gradient.addColorStop(1, "rgba(95,72,48,0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 900; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 3 + Math.random() * 9;
        const lighter = Math.random() > 0.5;
        ctx.fillStyle = lighter
            ? `${biome.rockLight}${0.03 + Math.random() * 0.05})`
            : `${biome.rockDark}${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = biome.rockVein;
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
            x += (Math.random() - 0.5) * 26;
            y += (Math.random() - 0.5) * 26;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    rockTextureCache.set(biome.key, texture);
    return texture;
}

const rockMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
export function getCanyonRockMaterial(biome: CanyonBiome = DEFAULT_BIOME): THREE.MeshStandardMaterial {
    const cached = rockMaterialCache.get(biome.key);
    if (cached) return cached;
    const texture = getCanyonRockTexture(biome);
    texture.repeat.set(3, 3);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0.0 });
    rockMaterialCache.set(biome.key, material);
    return material;
}

const floorTextureCache = new Map<string, THREE.Texture>();
export function getCanyonFloorTexture(biome: CanyonBiome = DEFAULT_BIOME): THREE.Texture {
    const cached = floorTextureCache.get(biome.key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = biome.rockBase;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `${biome.rockDark}${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = biome.rockVein;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        let x = Math.random() * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= canvas.height; y += 20) {
            x += (Math.random() - 0.5) * 30;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    floorTextureCache.set(biome.key, texture);
    return texture;
}

const floorMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
export function getCanyonFloorMaterial(biome: CanyonBiome = DEFAULT_BIOME): THREE.MeshStandardMaterial {
    const cached = floorMaterialCache.get(biome.key);
    if (cached) return cached;
    const texture = getCanyonFloorTexture(biome);
    texture.repeat.set(8, 50);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1.0, metalness: 0.0 });
    floorMaterialCache.set(biome.key, material);
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
    for (const cached of rockMaterialCache.values()) if (cached === mat) return true;
    for (const cached of floorMaterialCache.values()) if (cached === mat) return true;
    return mat === arrowMaterialCache;
}

export function isCachedGeometry(geo: THREE.BufferGeometry): boolean {
    return geo === arrowGeometryCache;
}
