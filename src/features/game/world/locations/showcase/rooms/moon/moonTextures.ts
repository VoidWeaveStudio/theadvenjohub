// src/features/game/world/locations/showcase/rooms/moon/moonTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

type Ctx = CanvasRenderingContext2D;

const TEXTURE_ROOT = "/models/textures/moon";

export interface MoonSurfaceSet {
    map: THREE.Texture;
    normal: THREE.Texture;
}

export interface MoonSurfaceTextures {
    dust: MoonSurfaceSet;
    rock: MoonSurfaceSet;
    basalt: MoonSurfaceSet;
}

function canvasOf(width: number, height: number, draw: (ctx: Ctx, width: number, height: number) => void): HTMLCanvasElement {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    draw(element.getContext("2d") as Ctx, width, height);
    return element;
}

function configure(texture: THREE.Texture, srgb: boolean, anisotropy: number): THREE.Texture {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function loadMoonSurfaces(anisotropy: number): MoonSurfaceTextures {
    const loader = new THREE.TextureLoader();
    const set = (name: string): MoonSurfaceSet => ({
        map: configure(loader.load(`${TEXTURE_ROOT}/${name}_diff_1k.webp`), true, anisotropy),
        normal: configure(loader.load(`${TEXTURE_ROOT}/${name}_nor_1k.webp`), false, anisotropy),
    });

    return {
        dust: set("dense_sand"),
        rock: set("dry_ground_rocks"),
        basalt: set("dark_rock"),
    };
}

export function disposeMoonSurfaces(textures: MoonSurfaceTextures) {
    for (const key of ["dust", "rock", "basalt"] as const) {
        textures[key].map.dispose();
        textures[key].normal.dispose();
    }
}

export function starSprite(bin: AssetBin): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(64, 64, (ctx, size) => {
        const half = size / 2;
        const core = ctx.createRadialGradient(half, half, 0, half, half, half);
        core.addColorStop(0, "rgba(255,255,255,1)");
        core.addColorStop(0.18, "rgba(240,246,255,0.7)");
        core.addColorStop(0.45, "rgba(190,214,255,0.18)");
        core.addColorStop(1, "rgba(150,180,255,0)");
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, size, size);

        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(half, size * 0.12);
        ctx.lineTo(half, size * 0.88);
        ctx.moveTo(size * 0.12, half);
        ctx.lineTo(size * 0.88, half);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
    })));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function dustSprite(bin: AssetBin): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(64, 64, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, "rgba(232,228,218,0.95)");
        gradient.addColorStop(0.4, "rgba(206,200,188,0.35)");
        gradient.addColorStop(1, "rgba(180,174,162,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    })));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function milkyWayTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(1024, 256, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";

        const band = (offset: number, thickness: number, alpha: number, color: string) => {
            for (let i = 0; i < 420; i++) {
                const x = seed() * width;
                const wave = Math.sin((x / width) * Math.PI * 2 + offset) * height * 0.14;
                const y = height * 0.5 + wave + (seed() - 0.5) * thickness;
                const radius = 6 + seed() * 40;

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, color.replace("ALPHA", (alpha * (0.4 + seed() * 0.6)).toFixed(3)));
                gradient.addColorStop(1, color.replace("ALPHA", "0"));
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        band(0, height * 0.42, 0.1, "rgba(150,170,220,ALPHA)");
        band(0.6, height * 0.26, 0.09, "rgba(210,200,230,ALPHA)");
        band(-0.4, height * 0.16, 0.08, "rgba(255,226,196,ALPHA)");

        ctx.fillStyle = "rgba(20,14,26,0.55)";
        for (let i = 0; i < 90; i++) {
            const x = seed() * width;
            const wave = Math.sin((x / width) * Math.PI * 2) * height * 0.14;
            const y = height * 0.5 + wave + (seed() - 0.5) * height * 0.2;
            ctx.globalCompositeOperation = "source-over";
            ctx.beginPath();
            ctx.ellipse(x, y, 10 + seed() * 46, 3 + seed() * 12, seed() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "lighter";
        }

        ctx.fillStyle = "rgba(255,255,255,0.75)";
        for (let i = 0; i < 1600; i++) {
            const x = seed() * width;
            const wave = Math.sin((x / width) * Math.PI * 2) * height * 0.14;
            const y = height * 0.5 + wave + (seed() - 0.5) * height * 0.5;
            ctx.globalAlpha = seed() * 0.7;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

interface Landmass {
    x: number;
    y: number;
    rx: number;
    ry: number;
    rotation: number;
}

function drawLandmass(ctx: Ctx, land: Landmass, seed: () => number, lobes: number) {
    ctx.save();
    ctx.translate(land.x, land.y);
    ctx.rotate(land.rotation);
    ctx.beginPath();

    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        let radius = 1;
        for (let l = 1; l <= lobes; l++) {
            radius += Math.sin(angle * l + l * 2.3) * (0.22 / l);
        }
        radius *= 0.86 + seed() * 0.05;
        const px = Math.cos(angle) * land.rx * radius;
        const py = Math.sin(angle) * land.ry * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function landmasses(width: number, height: number): Landmass[] {
    return [
        { x: width * 0.2, y: height * 0.38, rx: width * 0.09, ry: height * 0.2, rotation: -0.3 },
        { x: width * 0.26, y: height * 0.66, rx: width * 0.06, ry: height * 0.16, rotation: 0.25 },
        { x: width * 0.5, y: height * 0.42, rx: width * 0.07, ry: height * 0.13, rotation: 0.1 },
        { x: width * 0.56, y: height * 0.64, rx: width * 0.06, ry: height * 0.15, rotation: -0.2 },
        { x: width * 0.66, y: height * 0.34, rx: width * 0.13, ry: height * 0.18, rotation: 0.05 },
        { x: width * 0.8, y: height * 0.72, rx: width * 0.07, ry: height * 0.1, rotation: 0.4 },
        { x: width * 0.05, y: height * 0.3, rx: width * 0.05, ry: height * 0.12, rotation: 0.2 },
    ];
}

export function earthDayTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(1024, 512, (ctx, width, height) => {
        const ocean = ctx.createLinearGradient(0, 0, 0, height);
        ocean.addColorStop(0, "#9fd6ef");
        ocean.addColorStop(0.16, "#1d5fa8");
        ocean.addColorStop(0.5, "#11438a");
        ocean.addColorStop(0.84, "#1d5fa8");
        ocean.addColorStop(1, "#a6dbf0");
        ctx.fillStyle = ocean;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < 260; i++) {
            ctx.fillStyle = `rgba(30,90,160,${0.05 + seed() * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(seed() * width, seed() * height, 20 + seed() * 90, 10 + seed() * 40, seed() * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const land of landmasses(width, height)) {
            ctx.fillStyle = "#3f7a3a";
            drawLandmass(ctx, land, seed, 5);

            ctx.fillStyle = "rgba(122,138,66,0.55)";
            drawLandmass(ctx, { ...land, rx: land.rx * 0.62, ry: land.ry * 0.62 }, seed, 4);

            ctx.fillStyle = "rgba(196,170,110,0.4)";
            drawLandmass(ctx, { ...land, rx: land.rx * 0.34, ry: land.ry * 0.34 }, seed, 3);
        }

        const north = ctx.createLinearGradient(0, 0, 0, height * 0.14);
        north.addColorStop(0, "rgba(255,255,255,0.95)");
        north.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = north;
        ctx.fillRect(0, 0, width, height * 0.14);

        const south = ctx.createLinearGradient(0, height, 0, height * 0.86);
        south.addColorStop(0, "rgba(255,255,255,0.98)");
        south.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = south;
        ctx.fillRect(0, height * 0.86, width, height * 0.14);
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function earthNightTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(1024, 512, (ctx, width, height) => {
        ctx.fillStyle = "#03060d";
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = "lighter";

        for (const land of landmasses(width, height)) {
            const clusters = 26;
            for (let c = 0; c < clusters; c++) {
                const angle = seed() * Math.PI * 2;
                const spread = Math.sqrt(seed());
                const cx = land.x + Math.cos(angle) * land.rx * spread * 0.8;
                const cy = land.y + Math.sin(angle) * land.ry * spread * 0.8;
                const size = 4 + seed() * 22;

                const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
                glow.addColorStop(0, `rgba(255,214,150,${0.5 + seed() * 0.4})`);
                glow.addColorStop(0.5, "rgba(255,190,110,0.16)");
                glow.addColorStop(1, "rgba(255,170,80,0)");
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(cx, cy, size, 0, Math.PI * 2);
                ctx.fill();

                const dots = 5 + Math.floor(seed() * 12);
                for (let d = 0; d < dots; d++) {
                    ctx.fillStyle = `rgba(255,232,186,${0.35 + seed() * 0.5})`;
                    ctx.fillRect(cx + (seed() - 0.5) * size, cy + (seed() - 0.5) * size, 1.2, 1.2);
                }
            }
        }

        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function earthCloudTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(1024, 512, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";

        const puff = (x: number, y: number, radius: number, alpha: number) => {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
            gradient.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.35})`);
            gradient.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        };

        for (let band = 0; band < 5; band++) {
            const centre = height * (0.14 + band * 0.18);
            for (let i = 0; i < 150; i++) {
                const x = seed() * width;
                const y = centre + (seed() - 0.5) * height * 0.13;
                puff(x, y, 12 + seed() * 46, 0.18 + seed() * 0.3);
                if (x > width - 80) puff(x - width, y, 12 + seed() * 46, 0.18 + seed() * 0.3);
                if (x < 80) puff(x + width, y, 12 + seed() * 46, 0.18 + seed() * 0.3);
            }
        }

        for (let i = 0; i < 6; i++) {
            const cx = seed() * width;
            const cy = height * (0.25 + seed() * 0.5);
            for (let arm = 0; arm < 90; arm++) {
                const t = arm / 90;
                const angle = t * Math.PI * 4 + seed() * 0.2;
                const radius = t * (28 + seed() * 34);
                puff(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6, 8 + t * 16, 0.32 * (1 - t * 0.6));
            }
        }

        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function plumeNoiseTexture(bin: AssetBin, seed: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(256, 256, (ctx, size) => {
        ctx.fillStyle = "#606060";
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "lighter";

        for (let octave = 0; octave < 4; octave++) {
            const blobs = 22 << octave;
            const radius = size * (0.3 / (octave + 1));
            const alpha = 0.2 / (octave + 1);

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

export function galaxyTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(512, 512, (ctx, size) => {
        const half = size / 2;
        ctx.clearRect(0, 0, size, size);
        ctx.globalCompositeOperation = "lighter";

        const halo = ctx.createRadialGradient(half, half, 0, half, half, half * 0.9);
        halo.addColorStop(0, "rgba(255, 244, 214, 0.85)");
        halo.addColorStop(0.08, "rgba(255, 226, 168, 0.4)");
        halo.addColorStop(0.3, "rgba(150, 178, 255, 0.12)");
        halo.addColorStop(1, "rgba(80, 110, 200, 0)");
        ctx.save();
        ctx.translate(half, half);
        ctx.scale(1, 0.46);
        ctx.translate(-half, -half);
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, size, size);
        ctx.restore();

        ctx.save();
        ctx.translate(half, half);
        ctx.scale(1, 0.46);

        for (let arm = 0; arm < 2; arm++) {
            for (let i = 0; i < 2600; i++) {
                const t = Math.pow(random(), 0.55);
                const spread = (1 - t) * 0.5 + 0.08;
                const angle = t * 5.2 + arm * Math.PI + (random() - 0.5) * spread * 2.4;
                const radius = t * half * 0.92 + (random() - 0.5) * half * 0.05;

                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                const warm = 1 - Math.min(1, t * 1.6);
                const red = Math.round(170 + warm * 85);
                const green = Math.round(190 + warm * 50);
                const blue = Math.round(255 - warm * 60);
                const alpha = (0.1 + random() * 0.4) * (1 - t * 0.7);

                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(x, y, 0.5 + random() * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (let i = 0; i < 26; i++) {
            const t = Math.pow(random(), 0.6);
            const angle = t * 5.2 + (random() < 0.5 ? 0 : Math.PI) + (random() - 0.5) * 0.5;
            const radius = t * half * 0.9;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const knot = ctx.createRadialGradient(x, y, 0, x, y, 8 + random() * 16);
            knot.addColorStop(0, "rgba(190, 220, 255, 0.42)");
            knot.addColorStop(1, "rgba(120, 170, 255, 0)");
            ctx.fillStyle = knot;
            ctx.beginPath();
            ctx.arc(x, y, 8 + random() * 16, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}
