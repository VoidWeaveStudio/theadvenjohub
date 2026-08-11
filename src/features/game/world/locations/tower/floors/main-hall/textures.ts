// src/features/game/world/locations/tower/floors/main-hall/textures.ts
import * as THREE from "three";
import type { AssetBin } from "./utils/assetBin";
import { getAnisotropy } from "./utils/textureQuality";

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function toTexture(bin: AssetBin, canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = getAnisotropy();
    return texture;
}

export function createMarbleMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(1024, 1024);

    ctx.fillStyle = "#1a1f2d";
    ctx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 190; i++) {
        const x = random() * 1024;
        const y = random() * 1024;
        const r = 40 + random() * 200;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, random() < 0.5 ? "rgba(72,88,120,0.42)" : "rgba(9,12,19,0.5)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 34; i++) {
        ctx.strokeStyle = random() < 0.35 ? "rgba(199,154,75,0.32)" : "rgba(146,167,204,0.2)";
        ctx.lineWidth = 0.7 + random() * 2.4;
        ctx.beginPath();
        let x = random() * 1024;
        let y = random() * 1024;
        ctx.moveTo(x, y);
        for (let step = 0; step < 9; step++) {
            x += (random() - 0.5) * 300;
            y += (random() - 0.5) * 300;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(7,9,14,0.85)";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, 512, 512);
    ctx.strokeRect(512, 0, 512, 512);
    ctx.strokeRect(0, 512, 512, 512);
    ctx.strokeRect(512, 512, 512, 512);

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 9, 9),
        roughness: 0.42,
        metalness: 0.16,
        envMapIntensity: 0.7,
    }));
}

export function createStoneMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(512, 512);

    ctx.fillStyle = "#8b93a4";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 900; i++) {
        ctx.globalAlpha = 0.03 + random() * 0.07;
        ctx.fillStyle = random() < 0.5 ? "#c3cad8" : "#5f6675";
        ctx.fillRect(random() * 512, random() * 512, 5, 5);
    }
    ctx.globalAlpha = 1;

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 1, 1),
        roughness: 0.7,
        metalness: 0.06,
    }));
}

export function createStairMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x7d8697,
        roughness: 0.74,
        metalness: 0.05,
    }));
}

export function createSteelMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(512, 512);

    ctx.fillStyle = "#222733";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 420; i++) {
        ctx.globalAlpha = 0.03 + random() * 0.09;
        ctx.fillStyle = "#8d97a6";
        ctx.fillRect(0, random() * 512, 512, 1);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(10,12,17,0.9)";
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
        const p = (i / 4) * 512;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(512, p);
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(199,154,75,0.14)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
        const p = (i / 4) * 512 + 5;
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(512, p);
        ctx.stroke();
    }

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 4, 3),
        roughness: 0.46,
        metalness: 0.8,
    }));
}

export function createBrassMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0xc79a4b,
        roughness: 0.28,
        metalness: 0.94,
        envMapIntensity: 1.2,
    }));
}

export function createDarkTrimMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x141821,
        roughness: 0.42,
        metalness: 0.66,
    }));
}

export function createVelvetMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x3a1430,
        roughness: 0.95,
        metalness: 0.02,
    }));
}

export function createGlassMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x7ea3c4,
        roughness: 0.06,
        metalness: 0.2,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
    }));
}

export function createDomeGlassMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x86aecd,
        roughness: 0.05,
        metalness: 0.12,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
    }));
}

export function createLightShaftMaterial(bin: AssetBin): THREE.ShaderMaterial {
    return bin.material(new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0xfff2d2) },
            uIntensity: { value: 0.32 },
        },
        vertexShader: /* glsl */`
            varying vec3 vWorldNormal;
            varying vec3 vWorldView;
            varying float vHeight;

            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                vWorldView = normalize(cameraPosition - worldPosition.xyz);
                vHeight = uv.y;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            uniform float uIntensity;

            varying vec3 vWorldNormal;
            varying vec3 vWorldView;
            varying float vHeight;

            void main() {
                float facing = abs(dot(normalize(vWorldNormal), normalize(vWorldView)));
                float body = pow(facing, 1.7);
                float vertical = smoothstep(0.0, 0.55, vHeight);
                float taper = mix(0.35, 1.0, vertical);
                gl_FragColor = vec4(uColor, body * vertical * taper * uIntensity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
    }));
}

export function createFloorMedallionTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const size = 1024;
    const { canvas, ctx } = makeCanvas(size, size);
    const mid = size / 2;

    ctx.clearRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(199,154,75,0.55)";
    for (const r of [504, 470, 386, 254]) {
        ctx.lineWidth = r > 490 ? 8 : 4;
        ctx.beginPath();
        ctx.arc(mid, mid, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(199,154,75,0.32)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        const inner = i % 6 === 0 ? 386 : 448;
        ctx.beginPath();
        ctx.moveTo(mid + Math.cos(angle) * inner, mid + Math.sin(angle) * inner);
        ctx.lineTo(mid + Math.cos(angle) * 470, mid + Math.sin(angle) * 470);
        ctx.stroke();
    }

    for (let quadrant = 0; quadrant < 4; quadrant++) {
        ctx.save();
        ctx.translate(mid, mid);
        ctx.rotate((quadrant / 4) * Math.PI * 2);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(199,154,75,0.85)";
        ctx.font = "bold 54px Arial";
        ctx.fillText("MEMETOWER EXCHANGE", 0, 350);

        ctx.fillStyle = "rgba(139,149,166,0.7)";
        ctx.font = "bold 28px Arial";
        ctx.fillText("OPEN 24 / 7  ·  SETTLED IN ASH", 0, 300);

        ctx.restore();
    }

    for (let quadrant = 0; quadrant < 4; quadrant++) {
        ctx.save();
        ctx.translate(mid, mid);
        ctx.rotate((quadrant / 4) * Math.PI * 2 + Math.PI / 4);

        const baseline = 336;
        for (let i = 0; i < 18; i++) {
            const x = -150 + (i / 17) * 300;
            const up = random() > 0.44;
            const h = 16 + random() * 46;
            ctx.fillStyle = up ? "rgba(126,214,162,0.6)" : "rgba(226,102,110,0.6)";
            ctx.fillRect(x - 5, baseline - h / 2, 10, h);
            ctx.fillRect(x - 1.5, baseline - h / 2 - 12, 3, h + 24);
        }

        ctx.restore();
    }

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = getAnisotropy();
    return texture;
}

export function createTickerTexture(bin: AssetBin, text: string): THREE.CanvasTexture {
    const { canvas, ctx } = makeCanvas(2048, 64);

    ctx.fillStyle = "#07090d";
    ctx.fillRect(0, 0, 2048, 64);

    ctx.strokeStyle = "rgba(199,154,75,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(2048, 2);
    ctx.moveTo(0, 62);
    ctx.lineTo(2048, 62);
    ctx.stroke();

    ctx.font = "bold 40px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const width = ctx.measureText(text).width || 1;
    ctx.setTransform(2048 / width, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#f0b95c";
    ctx.fillText(text, 0, 34);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = getAnisotropy();
    return texture;
}

export function createEmissivePanelMaterial(bin: AssetBin, texture: THREE.Texture, intensity: number): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: 0xffffff,
        emissiveIntensity: intensity,
        roughness: 0.26,
        metalness: 0.08,
    }));
}
