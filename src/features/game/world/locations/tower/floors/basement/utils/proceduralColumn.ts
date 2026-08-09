// src/features/game/world/locations/tower/floors/basement/utils/proceduralColumn.ts
import * as THREE from "three";

export const COLUMN_HEIGHT = 4.6;
export const COLUMN_TOP_RADIUS = 1.15;
export const COIN_HEIGHT_ABOVE_COLUMN = 1.8;
export const COIN_BASE_Y = COLUMN_HEIGHT + COIN_HEIGHT_ABOVE_COLUMN;

let sharedGeometry: {
    shaft: THREE.CylinderGeometry;
    base: THREE.CylinderGeometry;
    plinth: THREE.CylinderGeometry;
    capital: THREE.CylinderGeometry;
    abacus: THREE.BoxGeometry;
    fluteRing: THREE.TorusGeometry;
    glyphRing: THREE.RingGeometry;
} | null = null;

let sharedMaterials: {
    stone: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
    glyph: THREE.MeshBasicMaterial;
} | null = null;

function createStoneTextures(): { map: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normalish: THREE.CanvasTexture } {
    const size = 512;

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext("2d")!;

    ctx.fillStyle = "#59606b";
    ctx.fillRect(0, 0, size, size);

    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const veins = Math.sin(x * 0.021 + Math.sin(y * 0.013) * 3.1) * 0.5 + 0.5;
            const grain = (Math.random() - 0.5) * 26;
            const band = Math.sin(y * 0.09) * 6;
            const shade = veins * 34 + grain + band;
            data[i] = Math.max(0, Math.min(255, 78 + shade));
            data[i + 1] = Math.max(0, Math.min(255, 86 + shade));
            data[i + 2] = Math.max(0, Math.min(255, 100 + shade * 1.15));
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    ctx.strokeStyle = "rgba(20,24,32,0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 30, size * 0.7, y + (Math.random() - 0.5) * 30, size, y + (Math.random() - 0.5) * 18);
        ctx.stroke();
    }

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rctx = roughCanvas.getContext("2d")!;
    const roughImage = rctx.createImageData(size, size);
    for (let i = 0; i < roughImage.data.length; i += 4) {
        const v = 150 + Math.random() * 80;
        roughImage.data[i] = v;
        roughImage.data[i + 1] = v;
        roughImage.data[i + 2] = v;
        roughImage.data[i + 3] = 255;
    }
    rctx.putImageData(roughImage, 0, 0);

    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bctx = bumpCanvas.getContext("2d")!;
    bctx.drawImage(colorCanvas, 0, 0);

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;

    const roughness = new THREE.CanvasTexture(roughCanvas);
    roughness.wrapS = THREE.RepeatWrapping;
    roughness.wrapT = THREE.RepeatWrapping;

    const normalish = new THREE.CanvasTexture(bumpCanvas);
    normalish.wrapS = THREE.RepeatWrapping;
    normalish.wrapT = THREE.RepeatWrapping;

    return { map, roughness, normalish };
}

function getGeometry() {
    if (sharedGeometry) return sharedGeometry;

    sharedGeometry = {
        shaft: new THREE.CylinderGeometry(COLUMN_TOP_RADIUS, COLUMN_TOP_RADIUS * 1.18, COLUMN_HEIGHT * 0.72, 24, 4),
        base: new THREE.CylinderGeometry(COLUMN_TOP_RADIUS * 1.5, COLUMN_TOP_RADIUS * 1.75, COLUMN_HEIGHT * 0.12, 24),
        plinth: new THREE.CylinderGeometry(COLUMN_TOP_RADIUS * 1.85, COLUMN_TOP_RADIUS * 1.95, COLUMN_HEIGHT * 0.08, 8),
        capital: new THREE.CylinderGeometry(COLUMN_TOP_RADIUS * 1.55, COLUMN_TOP_RADIUS * 1.05, COLUMN_HEIGHT * 0.14, 24),
        abacus: new THREE.BoxGeometry(COLUMN_TOP_RADIUS * 3.1, COLUMN_HEIGHT * 0.06, COLUMN_TOP_RADIUS * 3.1),
        fluteRing: new THREE.TorusGeometry(COLUMN_TOP_RADIUS * 1.02, 0.045, 6, 28),
        glyphRing: new THREE.RingGeometry(COLUMN_TOP_RADIUS * 0.5, COLUMN_TOP_RADIUS * 1.35, 24),
    };
    return sharedGeometry;
}

function getMaterials() {
    if (sharedMaterials) return sharedMaterials;

    const { map, roughness, normalish } = createStoneTextures();
    map.repeat.set(2, 1.4);
    roughness.repeat.set(2, 1.4);
    normalish.repeat.set(2, 1.4);

    sharedMaterials = {
        stone: new THREE.MeshStandardMaterial({
            map,
            roughnessMap: roughness,
            bumpMap: normalish,
            bumpScale: 0.35,
            color: 0xb9c3d2,
            roughness: 0.92,
            metalness: 0.06,
        }),
        trim: new THREE.MeshStandardMaterial({
            color: 0x2a3542,
            roughness: 0.55,
            metalness: 0.55,
        }),
        glyph: new THREE.MeshBasicMaterial({
            color: 0x6fd8ff,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
    };
    return sharedMaterials;
}

export function createProceduralColumn(seed: number): THREE.Group {
    const geometry = getGeometry();
    const materials = getMaterials();
    const group = new THREE.Group();
    group.userData.sharedAssets = true;

    const plinth = new THREE.Mesh(geometry.plinth, materials.trim);
    plinth.position.y = COLUMN_HEIGHT * 0.04;
    plinth.rotation.y = (seed % 8) * 0.4;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    group.add(plinth);

    const base = new THREE.Mesh(geometry.base, materials.stone);
    base.position.y = COLUMN_HEIGHT * 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const shaft = new THREE.Mesh(geometry.shaft, materials.stone);
    shaft.position.y = COLUMN_HEIGHT * 0.2 + COLUMN_HEIGHT * 0.36;
    shaft.rotation.y = seed * 0.7;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);

    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(geometry.fluteRing, materials.trim);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = COLUMN_HEIGHT * (0.3 + i * 0.19);
        ring.castShadow = true;
        group.add(ring);
    }

    const capital = new THREE.Mesh(geometry.capital, materials.stone);
    capital.position.y = COLUMN_HEIGHT * 0.86;
    capital.castShadow = true;
    capital.receiveShadow = true;
    group.add(capital);

    const abacus = new THREE.Mesh(geometry.abacus, materials.trim);
    abacus.position.y = COLUMN_HEIGHT * 0.96;
    abacus.rotation.y = (seed % 4) * 0.25;
    abacus.castShadow = true;
    abacus.receiveShadow = true;
    group.add(abacus);

    const glyph = new THREE.Mesh(geometry.glyphRing, materials.glyph);
    glyph.rotation.x = -Math.PI / 2;
    glyph.position.y = COLUMN_HEIGHT * 1.0;
    group.add(glyph);

    return group;
}

export function disposeProceduralColumnAssets() {
    if (sharedGeometry) {
        Object.values(sharedGeometry).forEach((geo) => geo.dispose());
        sharedGeometry = null;
    }
    if (sharedMaterials) {
        sharedMaterials.stone.map?.dispose();
        sharedMaterials.stone.roughnessMap?.dispose();
        sharedMaterials.stone.bumpMap?.dispose();
        sharedMaterials.stone.dispose();
        sharedMaterials.trim.dispose();
        sharedMaterials.glyph.dispose();
        sharedMaterials = null;
    }
}
