// src/features/game/world/locations/showcase/rooms/garden/gardenTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

type Ctx = CanvasRenderingContext2D;

const TEXTURE_ROOT = "/models/textures/garden";

export interface GardenSurfaceSet {
    map: THREE.Texture;
    normal: THREE.Texture;
}

export interface GardenSurfaceTextures {
    lawn: GardenSurfaceSet;
    path: GardenSurfaceSet;
    bed: GardenSurfaceSet;
    stone: GardenSurfaceSet;
    waterNormal: THREE.Texture;
}

function canvasOf(size: number, draw: (ctx: Ctx, size: number) => void): HTMLCanvasElement {
    const element = document.createElement("canvas");
    element.width = size;
    element.height = size;
    draw(element.getContext("2d") as Ctx, size);
    return element;
}

function sprite(bin: AssetBin, size: number, draw: (ctx: Ctx, size: number) => void): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(size, draw)));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

function tile(bin: AssetBin, size: number, draw: (ctx: Ctx, size: number) => void): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(size, draw)));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

function configure(texture: THREE.Texture, srgb: boolean, anisotropy: number): THREE.Texture {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function loadGardenSurfaces(anisotropy: number): GardenSurfaceTextures {
    const loader = new THREE.TextureLoader();
    const set = (name: string): GardenSurfaceSet => ({
        map: configure(loader.load(`${TEXTURE_ROOT}/${name}_diff_1k.webp`), true, anisotropy),
        normal: configure(loader.load(`${TEXTURE_ROOT}/${name}_nor_1k.webp`), false, anisotropy),
    });

    return {
        lawn: set("leafy_grass"),
        path: set("grass_path_3"),
        bed: set("flower_scattered_dirt"),
        stone: set("mossy_cobblestone"),
        waterNormal: configure(loader.load(`${TEXTURE_ROOT}/water_nor.webp`), false, anisotropy),
    };
}

export function disposeGardenSurfaces(textures: GardenSurfaceTextures) {
    for (const key of ["lawn", "path", "bed", "stone"] as const) {
        textures[key].map.dispose();
        textures[key].normal.dispose();
    }
    textures.waterNormal.dispose();
}

export function petalTexture(bin: AssetBin, warm: boolean): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const half = size / 2;
        ctx.clearRect(0, 0, size, size);
        ctx.translate(half, half);

        const gradient = ctx.createLinearGradient(0, -half * 0.8, 0, half * 0.8);
        if (warm) {
            gradient.addColorStop(0, "rgba(255,255,253,0.98)");
            gradient.addColorStop(0.45, "rgba(255,206,224,0.96)");
            gradient.addColorStop(1, "rgba(246,148,182,0.9)");
        } else {
            gradient.addColorStop(0, "rgba(255,252,246,0.98)");
            gradient.addColorStop(0.5, "rgba(255,236,206,0.94)");
            gradient.addColorStop(1, "rgba(244,196,142,0.88)");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -half * 0.86);
        ctx.bezierCurveTo(half * 0.68, -half * 0.52, half * 0.6, half * 0.44, 0, half * 0.86);
        ctx.bezierCurveTo(-half * 0.6, half * 0.44, -half * 0.68, -half * 0.52, 0, -half * 0.86);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = warm ? "rgba(214,110,152,0.35)" : "rgba(206,150,96,0.32)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -half * 0.74);
        ctx.lineTo(0, half * 0.72);
        ctx.stroke();
    });
}

export function bokehTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, "rgba(255,255,236,1)");
        gradient.addColorStop(0.28, "rgba(255,250,206,0.72)");
        gradient.addColorStop(0.62, "rgba(255,238,170,0.22)");
        gradient.addColorStop(1, "rgba(255,230,150,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });
}

export function butterflyWingTexture(bin: AssetBin, base: number, accent: number): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
        ctx.clearRect(0, 0, size, size);

        const outline = () => {
            ctx.beginPath();
            ctx.moveTo(size * 0.06, size * 0.5);
            ctx.bezierCurveTo(size * 0.1, size * 0.02, size * 0.96, size * 0.06, size * 0.88, size * 0.42);
            ctx.bezierCurveTo(size * 0.99, size * 0.72, size * 0.5, size * 0.99, size * 0.18, size * 0.82);
            ctx.closePath();
        };

        ctx.fillStyle = toHex(base);
        outline();
        ctx.fill();

        ctx.fillStyle = toHex(accent);
        ctx.globalAlpha = 0.85;
        for (const [cx, cy, r] of [[0.66, 0.28, 0.13], [0.46, 0.66, 0.1], [0.78, 0.56, 0.07]]) {
            ctx.beginPath();
            ctx.ellipse(size * cx, size * cy, size * r, size * r * 0.78, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "rgba(30,20,28,0.85)";
        ctx.lineWidth = size * 0.035;
        outline();
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}

export function dragonflyWingTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "rgba(226,246,255,0.42)";
        ctx.beginPath();
        ctx.ellipse(size * 0.5, size * 0.5, size * 0.46, size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(150,200,226,0.55)";
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 9; i++) {
            const t = i / 8;
            ctx.beginPath();
            ctx.moveTo(size * (0.06 + t * 0.88), size * 0.5 - size * 0.14 * Math.sin(t * Math.PI));
            ctx.lineTo(size * (0.06 + t * 0.88), size * 0.5 + size * 0.14 * Math.sin(t * Math.PI));
            ctx.stroke();
        }
    });
}

export function birdTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 64, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = "rgba(48,56,70,0.92)";
        ctx.lineWidth = size * 0.09;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(size * 0.08, size * 0.6);
        ctx.quadraticCurveTo(size * 0.3, size * 0.3, size * 0.5, size * 0.56);
        ctx.quadraticCurveTo(size * 0.7, size * 0.3, size * 0.92, size * 0.6);
        ctx.stroke();
    });
}

export function shaftTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, "rgba(255,247,214,0.75)");
        gradient.addColorStop(0.45, "rgba(255,242,198,0.26)");
        gradient.addColorStop(1, "rgba(255,238,186,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "destination-in";
        const fade = ctx.createLinearGradient(0, 0, size, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(0.5, "rgba(0,0,0,1)");
        fade.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
    });
}

export function rippleTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const half = size / 2;
        ctx.clearRect(0, 0, size, size);
        for (const [radius, width, alpha] of [[0.44, 0.045, 0.9], [0.32, 0.03, 0.45], [0.2, 0.022, 0.2]]) {
            ctx.strokeStyle = `rgba(232,250,255,${alpha})`;
            ctx.lineWidth = size * width;
            ctx.beginPath();
            ctx.arc(half, half, size * radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

export function causticTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    return tile(bin, 512, (ctx, size) => {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, size, size);

        const points: Array<[number, number]> = [];
        for (let i = 0; i < 26; i++) points.push([seed() * size, seed() * size]);

        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[j][0] - points[i][0];
                const dz = points[j][1] - points[i][1];
                const distance = Math.hypot(dx, dz);
                if (distance > size * 0.24) continue;

                const strength = 1 - distance / (size * 0.24);
                const red = Math.round(180 + strength * 75);
                const green = Math.round(230 + strength * 25);
                ctx.strokeStyle = `rgba(${red},${green},255,${strength * 0.5})`;
                ctx.lineWidth = 1.5 + strength * 7;

                for (const [ox, oz] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
                    ctx.beginPath();
                    ctx.moveTo(points[i][0] + ox, points[i][1] + oz);
                    ctx.quadraticCurveTo(
                        (points[i][0] + points[j][0]) / 2 + ox + (seed() - 0.5) * 26,
                        (points[i][1] + points[j][1]) / 2 + oz + (seed() - 0.5) * 26,
                        points[j][0] + ox,
                        points[j][1] + oz
                    );
                    ctx.stroke();
                }
            }
        }

        ctx.globalCompositeOperation = "source-over";
    });
}

export function foamTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    return tile(bin, 256, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 520; i++) {
            const x = seed() * size;
            const y = seed() * size;
            const radius = 1 + seed() * 7;
            ctx.globalAlpha = 0.12 + seed() * 0.6;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });
}

export function lilyPadTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    return sprite(bin, 256, (ctx, size) => {
        const half = size / 2;
        ctx.clearRect(0, 0, size, size);

        const gradient = ctx.createRadialGradient(half * 0.8, half * 0.76, size * 0.05, half, half, half);
        gradient.addColorStop(0, "#7fc25a");
        gradient.addColorStop(0.55, "#4f9646");
        gradient.addColorStop(1, "#2f6b35");
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(half, half);
        for (let i = 0; i <= 48; i++) {
            const angle = 0.34 + (i / 48) * (Math.PI * 2 - 0.68);
            const wobble = 1 + Math.sin(angle * 7) * 0.025;
            ctx.lineTo(half + Math.cos(angle) * half * 0.94 * wobble, half + Math.sin(angle) * half * 0.94 * wobble);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(38,86,44,0.45)";
        ctx.lineWidth = size * 0.012;
        for (let i = 0; i < 11; i++) {
            const angle = 0.4 + (i / 11) * (Math.PI * 2 - 0.8);
            ctx.beginPath();
            ctx.moveTo(half, half);
            ctx.lineTo(half + Math.cos(angle) * half * 0.9, half + Math.sin(angle) * half * 0.9);
            ctx.stroke();
        }

        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = seed() > 0.5 ? "#a6d97a" : "#356f3a";
            const angle = seed() * Math.PI * 2;
            const distance = seed() * half * 0.85;
            ctx.beginPath();
            ctx.arc(half + Math.cos(angle) * distance, half + Math.sin(angle) * distance, 2 + seed() * 9, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });
}

export function glowTexture(bin: AssetBin, inner: string, outer: string): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, inner);
        gradient.addColorStop(0.4, outer);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });
}
