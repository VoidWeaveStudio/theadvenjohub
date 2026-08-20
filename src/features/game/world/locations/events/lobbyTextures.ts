// src/features/game/world/locations/events/lobbyTextures.ts
import * as THREE from "three";
import { t } from "@/core/i18n";
import { AssetBin } from "../../AssetBin";

function makeCanvas(width: number, height: number) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function toTexture(bin: AssetBin, canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return bin.texture(texture);
}

const SERIF = "Georgia, serif";

export function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export function createPaleMarbleMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const size = 1024;
    const { canvas, ctx } = makeCanvas(size, size);

    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, "#f4efe6");
    base.addColorStop(0.5, "#e7e0d2");
    base.addColorStop(1, "#f7f3ec");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = `rgba(150,140,124,${0.05 + random() * 0.12})`;
        ctx.lineWidth = 0.6 + random() * 2.4;
        ctx.beginPath();
        let x = random() * size;
        let y = random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 9; j++) {
            x += (random() - 0.5) * 190;
            y += (random() - 0.5) * 150;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(196,164,104,${0.05 + random() * 0.09})`;
        ctx.lineWidth = 1 + random() * 1.6;
        ctx.beginPath();
        let x = random() * size;
        let y = random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
            x += (random() - 0.5) * 230;
            y += (random() - 0.5) * 180;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const tile = size / 4;
    ctx.strokeStyle = "rgba(120,110,96,0.32)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tile, 0);
        ctx.lineTo(i * tile, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * tile);
        ctx.lineTo(size, i * tile);
        ctx.stroke();
    }

    const rough = makeCanvas(256, 256);
    rough.ctx.fillStyle = "#2a2a2a";
    rough.ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
        const v = Math.floor(28 + random() * 70);
        rough.ctx.fillStyle = `rgb(${v},${v},${v})`;
        rough.ctx.fillRect(random() * 256, random() * 256, 2, 2);
    }

    const roughnessMap = toTexture(bin, rough.canvas, 14, 14);
    roughnessMap.colorSpace = THREE.NoColorSpace;

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 7, 7),
        roughnessMap,
        roughness: 0.34,
        metalness: 0.06,
        envMapIntensity: 1.1,
    }));
}

export function createLimestoneMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size, size);

    ctx.fillStyle = "#efe7da";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1400; i++) {
        const shade = 210 + Math.floor(random() * 34);
        ctx.fillStyle = `rgba(${shade},${shade - 8},${shade - 22},${0.12 + random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 2 + random() * 14, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(176,164,146,0.34)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
        const y = (i / 8) * size;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 12, 3),
        roughness: 0.86,
        metalness: 0.02,
        side: THREE.DoubleSide,
    }));
}

export function createGildedMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0xd8b46a,
        roughness: 0.24,
        metalness: 0.94,
        envMapIntensity: 1.4,
    }));
}

export function createBronzeMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x705a3c,
        roughness: 0.42,
        metalness: 0.8,
        envMapIntensity: 1,
    }));
}

export function createWalnutMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size, size);

    ctx.fillStyle = "#432a1c";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 240; i++) {
        ctx.strokeStyle = `rgba(${90 + random() * 60},${52 + random() * 40},${30 + random() * 26},${0.18 + random() * 0.3})`;
        ctx.lineWidth = 0.7 + random() * 2.6;
        ctx.beginPath();
        const y = random() * size;
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 32) {
            ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * (1 + random() * 3)) * (3 + random() * 9));
        }
        ctx.stroke();
    }

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 2, 2),
        roughness: 0.44,
        metalness: 0.12,
        envMapIntensity: 0.9,
    }));
}

export function createCarpetMaterial(bin: AssetBin, accent: string): THREE.MeshStandardMaterial {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size, size);

    ctx.fillStyle = "#5b2030";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 5;
    ctx.strokeRect(22, 22, size - 44, size - 44);
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, size - 80, size - 80);

    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 30 + i * 16, 0, Math.PI * 2);
        ctx.lineWidth = i % 3 === 0 ? 3 : 1;
        ctx.stroke();
    }

    ctx.globalAlpha = 0.26;
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size / 2 + Math.cos(a) * 44, size / 2 + Math.sin(a) * 44);
        ctx.lineTo(size / 2 + Math.cos(a) * 224, size / 2 + Math.sin(a) * 224);
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 1, 1),
        roughness: 0.95,
        metalness: 0,
    }));
}

export function createRunnerMaterial(bin: AssetBin, accent: string): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(128, 512);

    ctx.fillStyle = "#5b2030";
    ctx.fillRect(0, 0, 128, 512);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(14, 512);
    ctx.moveTo(114, 0);
    ctx.lineTo(114, 512);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 48) {
        ctx.beginPath();
        ctx.moveTo(26, y);
        ctx.lineTo(102, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 1, 3),
        roughness: 0.95,
        metalness: 0,
    }));
}

export function createDomeGlassMaterial(bin: AssetBin): THREE.MeshPhysicalMaterial {
    return bin.material(new THREE.MeshPhysicalMaterial({
        color: 0xdcecff,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.6,
        thickness: 0.4,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        envMapIntensity: 1.2,
    }));
}

export function createSkyTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const width = 1024;
    const height = 512;
    const { canvas, ctx } = makeCanvas(width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#3f7fd4");
    gradient.addColorStop(0.4, "#8dbcf0");
    gradient.addColorStop(0.72, "#d9e6f5");
    gradient.addColorStop(1, "#f6e9cd");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 40; i++) {
        const cx = random() * width;
        const cy = 40 + random() * (height * 0.55);
        const scale = 30 + random() * 90;
        ctx.globalAlpha = 0.1 + random() * 0.22;
        ctx.fillStyle = "#ffffff";
        for (let j = 0; j < 7; j++) {
            ctx.beginPath();
            ctx.ellipse(
                cx + (random() - 0.5) * scale * 2,
                cy + (random() - 0.5) * scale * 0.4,
                scale * (0.4 + random() * 0.7),
                scale * (0.16 + random() * 0.2),
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return bin.texture(texture);
}

export function createPlaqueTexture(
    bin: AssetBin,
    title: string,
    subtitle: string,
    accent: string,
    live: boolean
): THREE.CanvasTexture {
    const width = 1024;
    const height = 256;
    const { canvas, ctx } = makeCanvas(width, height);

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, live ? "#1c1b26" : "#17171b");
    base.addColorStop(1, live ? "#0d0d13" : "#0b0b0e");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = accent;
    ctx.globalAlpha = live ? 0.9 : 0.32;
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, width - 28, height - 28);
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.fillStyle = live ? "#f6f2e8" : "#8b8f98";
    ctx.font = `bold 92px ${SERIF}`;
    ctx.fillText(title.toUpperCase(), width / 2, 118);

    ctx.fillStyle = accent;
    ctx.globalAlpha = live ? 0.95 : 0.5;
    ctx.font = `42px ${SERIF}`;
    ctx.fillText(subtitle.toUpperCase(), width / 2, 186);
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return bin.texture(texture);
}

export function createCrestTexture(bin: AssetBin, glyph: string, accent: string, live: boolean): THREE.CanvasTexture {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size, size);

    const glow = ctx.createRadialGradient(size / 2, size / 2, 18, size / 2, size / 2, size / 2);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.45, `${accent}55`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = live ? 0.85 : 0.22;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = live ? "#f0e4c4" : "#5a5a62";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = `${Math.floor(size * 0.44)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = live ? 1 : 0.42;
    ctx.fillText(glyph, size / 2, size / 2 + 8);
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return bin.texture(texture);
}

export interface DirectoryRow {
    label: string;
    value: string;
    accent: string;
    live: boolean;
}

export function drawDirectory(canvas: HTMLCanvasElement, rows: DirectoryRow[]) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d")!;

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "#14161f");
    base.addColorStop(1, "#080a10");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#f6f2e8";
    ctx.font = `bold 58px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText(t("g.lobby.hallOfEvents"), width / 2, 92);

    ctx.strokeStyle = "rgba(216,180,106,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 124);
    ctx.lineTo(width - 70, 124);
    ctx.stroke();

    ctx.textAlign = "left";
    rows.forEach((row, i) => {
        const y = 200 + i * 82;

        ctx.globalAlpha = row.live ? 1 : 0.42;
        ctx.fillStyle = row.accent;
        ctx.beginPath();
        ctx.arc(96, y - 14, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = row.live ? "#e8e4da" : "#7e828b";
        ctx.font = `42px ${SERIF}`;
        ctx.fillText(row.label, 132, y);

        ctx.fillStyle = row.accent;
        ctx.font = `bold 32px ${SERIF}`;
        ctx.textAlign = "right";
        ctx.fillText(row.value, width - 90, y);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
    });
}

export function createDirectoryTexture(bin: AssetBin, rows: DirectoryRow[]): THREE.CanvasTexture {
    const { canvas } = makeCanvas(1024, 1024);
    drawDirectory(canvas, rows);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return bin.texture(texture);
}
