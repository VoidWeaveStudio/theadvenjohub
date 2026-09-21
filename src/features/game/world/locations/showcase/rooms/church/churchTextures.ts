// src/features/game/world/locations/showcase/rooms/church/churchTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

type Ctx = CanvasRenderingContext2D;

const TEXTURE_ROOT = "/models/textures/church";

export interface ChurchSurfaceSet {
    map: THREE.Texture;
    normal: THREE.Texture;
}

export interface ChurchSurfaceTextures {
    brick: ChurchSurfaceSet;
    floor: ChurchSurfaceSet;
    marble: ChurchSurfaceSet;
    wood: ChurchSurfaceSet;
    plaster: ChurchSurfaceSet;
}

function canvasOf(width: number, height: number, draw: (ctx: Ctx, width: number, height: number) => void): HTMLCanvasElement {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    draw(element.getContext("2d") as Ctx, width, height);
    return element;
}

function sprite(bin: AssetBin, size: number, draw: (ctx: Ctx, size: number) => void): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(size, size, (ctx) => draw(ctx, size))));
    texture.colorSpace = THREE.SRGBColorSpace;
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

export function loadChurchSurfaces(anisotropy: number): ChurchSurfaceTextures {
    const loader = new THREE.TextureLoader();
    const set = (name: string): ChurchSurfaceSet => ({
        map: configure(loader.load(`${TEXTURE_ROOT}/${name}_diff_1k.webp`), true, anisotropy),
        normal: configure(loader.load(`${TEXTURE_ROOT}/${name}_nor_1k.webp`), false, anisotropy),
    });

    return {
        brick: set("church_bricks_03"),
        floor: set("marble_tiles"),
        marble: set("marble_01"),
        wood: set("dark_wooden_planks"),
        plaster: set("grey_plaster"),
    };
}

export function disposeChurchSurfaces(textures: ChurchSurfaceTextures) {
    for (const key of ["brick", "floor", "marble", "wood", "plaster"] as const) {
        textures[key].map.dispose();
        textures[key].normal.dispose();
    }
}

export function surfaceSet(
    bin: AssetBin,
    set: ChurchSurfaceSet,
    repeatX: number,
    repeatY: number
): ChurchSurfaceSet {
    const map = bin.texture(set.map.clone());
    const normal = bin.texture(set.normal.clone());
    map.repeat.set(repeatX, repeatY);
    normal.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    normal.needsUpdate = true;
    return { map, normal };
}

export function flameTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        const cx = size / 2;

        const outer = ctx.createRadialGradient(cx, size * 0.66, size * 0.02, cx, size * 0.6, size * 0.4);
        outer.addColorStop(0, "rgba(255,238,190,1)");
        outer.addColorStop(0.35, "rgba(255,176,72,0.85)");
        outer.addColorStop(0.72, "rgba(226,108,30,0.35)");
        outer.addColorStop(1, "rgba(150,60,10,0)");

        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.moveTo(cx, size * 0.06);
        ctx.bezierCurveTo(size * 0.86, size * 0.5, size * 0.78, size * 0.94, cx, size * 0.96);
        ctx.bezierCurveTo(size * 0.22, size * 0.94, size * 0.14, size * 0.5, cx, size * 0.06);
        ctx.closePath();
        ctx.fill();

        const core = ctx.createRadialGradient(cx, size * 0.7, 0, cx, size * 0.7, size * 0.17);
        core.addColorStop(0, "rgba(255,255,246,1)");
        core.addColorStop(0.5, "rgba(255,232,168,0.8)");
        core.addColorStop(1, "rgba(255,200,110,0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.ellipse(cx, size * 0.7, size * 0.11, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

export function haloTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, "rgba(255,226,166,0.85)");
        gradient.addColorStop(0.22, "rgba(255,196,118,0.4)");
        gradient.addColorStop(0.55, "rgba(238,150,70,0.12)");
        gradient.addColorStop(1, "rgba(200,110,40,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });
}

export function dustTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 64, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, "rgba(255,246,222,1)");
        gradient.addColorStop(0.35, "rgba(255,232,186,0.5)");
        gradient.addColorStop(1, "rgba(255,220,160,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });
}

export function smokeTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    return sprite(bin, 128, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        const half = size / 2;

        for (let i = 0; i < 26; i++) {
            const angle = seed() * Math.PI * 2;
            const distance = seed() * half * 0.42;
            const radius = half * (0.24 + seed() * 0.3);
            const x = half + Math.cos(angle) * distance;
            const y = half + Math.sin(angle) * distance;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, "rgba(236,226,206,0.2)");
            gradient.addColorStop(0.6, "rgba(214,202,180,0.08)");
            gradient.addColorStop(1, "rgba(190,178,158,0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = "destination-in";
        const mask = ctx.createRadialGradient(half, half, 0, half, half, half);
        mask.addColorStop(0, "rgba(0,0,0,1)");
        mask.addColorStop(0.65, "rgba(0,0,0,0.75)");
        mask.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mask;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "source-over";
    });
}

export function beamNoiseTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(256, 256, (ctx, size) => {
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "lighter";

        for (let octave = 0; octave < 4; octave++) {
            const blobs = 18 << octave;
            const radius = size * (0.34 / (octave + 1));
            const alpha = 0.16 / (octave + 1);

            for (let i = 0; i < blobs; i++) {
                const x = seed() * size;
                const y = seed() * size;
                for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
                    const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius);
                    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
                    gradient.addColorStop(1, "rgba(255,255,255,0)");
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x + ox, y + oy, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.globalCompositeOperation = "source-over";
    })));

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function goboTexture(bin: AssetBin): THREE.CanvasTexture {
    return sprite(bin, 256, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);

        const left = size * 0.22;
        const right = size * 0.78;
        const top = size * 0.2;
        const bottom = size * 0.88;
        const archTop = size * 0.09;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top);
        ctx.quadraticCurveTo(size * 0.5, archTop, right, top);
        ctx.lineTo(right, bottom);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "butt";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";

        ctx.lineWidth = size * 0.028;
        for (let i = 1; i < 4; i++) {
            const x = left + ((right - left) * i) / 4;
            ctx.beginPath();
            ctx.moveTo(x, archTop);
            ctx.lineTo(x, bottom);
            ctx.stroke();
        }

        ctx.lineWidth = size * 0.022;
        for (let i = 1; i < 4; i++) {
            const y = top + ((bottom - top) * i) / 4;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = "source-over";

        const glow = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.1, size * 0.5, size * 0.5, size * 0.52);
        glow.addColorStop(0, "rgba(255,255,255,0.28)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "destination-in";
        const fade = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.18, size * 0.5, size * 0.5, size * 0.5);
        fade.addColorStop(0, "rgba(0,0,0,1)");
        fade.addColorStop(0.7, "rgba(0,0,0,0.65)");
        fade.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "source-over";
    });
}
