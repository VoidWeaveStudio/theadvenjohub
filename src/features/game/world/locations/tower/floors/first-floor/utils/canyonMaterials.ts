// src/features/game/world/locations/tower/floors/first-floor/utils/canyonMaterials.ts
import * as THREE from "three";

let rockTextureCache: THREE.Texture | null = null;
export function getCanyonRockTexture(): THREE.Texture {
    if (rockTextureCache) return rockTextureCache;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#B79868";
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
            ? `rgba(255,240,210,${0.03 + Math.random() * 0.05})`
            : `rgba(60,40,20,${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(70,48,26,0.3)";
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
    rockTextureCache = texture;
    return texture;
}

let rockMaterialCache: THREE.MeshStandardMaterial | null = null;
export function getCanyonRockMaterial(): THREE.MeshStandardMaterial {
    if (rockMaterialCache) return rockMaterialCache;
    const texture = getCanyonRockTexture();
    texture.repeat.set(3, 3);
    rockMaterialCache = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0.0 });
    return rockMaterialCache;
}

let floorTextureCache: THREE.Texture | null = null;
export function getCanyonFloorTexture(): THREE.Texture {
    if (floorTextureCache) return floorTextureCache;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#C7A165";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `rgba(120,80,40,${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(94,62,32,0.45)";
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
    floorTextureCache = texture;
    return texture;
}

let floorMaterialCache: THREE.MeshStandardMaterial | null = null;
export function getCanyonFloorMaterial(): THREE.MeshStandardMaterial {
    if (floorMaterialCache) return floorMaterialCache;
    const texture = getCanyonFloorTexture();
    texture.repeat.set(8, 50);
    floorMaterialCache = new THREE.MeshStandardMaterial({ map: texture, roughness: 1.0, metalness: 0.0 });
    return floorMaterialCache;
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
    return mat === rockMaterialCache || mat === floorMaterialCache || mat === arrowMaterialCache;
}

export function isCachedGeometry(geo: THREE.BufferGeometry): boolean {
    return geo === arrowGeometryCache;
}
