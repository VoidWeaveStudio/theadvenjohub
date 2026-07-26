// src/features/game/world/locations/tower/floors/mainHallTextures.ts
import * as THREE from "three";

interface MarbleOptions {
    baseColor: string;
    mottleLight: string;
    mottleDark: string;
    veinColor: string;
    veinCount: number;
    speckleCount: number;
}

function paintMarble(ctx: CanvasRenderingContext2D, size: number, options: MarbleOptions) {
    ctx.fillStyle = options.baseColor;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < options.speckleCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 15 + Math.random() * size * 0.12;
        const lighter = Math.random() > 0.5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, lighter ? options.mottleLight : options.mottleDark);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = options.veinColor;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < options.veinCount; i++) {
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.globalAlpha = 0.12 + Math.random() * 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const segments = 5 + Math.floor(Math.random() * 7);
        for (let j = 0; j < segments; j++) {
            x += (Math.random() - 0.5) * size * 0.14;
            y += (Math.random() - 0.5) * size * 0.14;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function createRoughnessTexture(size: number, baseGray: number, variation: number): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `rgb(${baseGray},${baseGray},${baseGray})`;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 120; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 10 + Math.random() * size * 0.15;
        const shade = baseGray + (Math.random() - 0.5) * variation;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${shade},${shade},${shade},0.4)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function buildMarbleMaterial(options: MarbleOptions, canvasSize: number, repeatX: number, repeatY: number, roughnessBase: number, roughGray: number): THREE.MeshStandardMaterial {
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d")!;
    paintMarble(ctx, canvasSize, options);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.anisotropy = 4;

    const roughnessMap = createRoughnessTexture(canvasSize / 2, roughGray, 40);
    roughnessMap.repeat.set(repeatX, repeatY);

    return new THREE.MeshStandardMaterial({
        map,
        roughnessMap,
        roughness: roughnessBase,
        metalness: 0.08,
    });
}

export function createMarbleFloorMaterial(): THREE.MeshStandardMaterial {
    return buildMarbleMaterial({
        baseColor: '#C9BB9E',
        mottleLight: 'rgba(255,248,232,0.10)',
        mottleDark: 'rgba(90,72,48,0.10)',
        veinColor: 'rgba(120,95,60,0.5)',
        veinCount: 48,
        speckleCount: 70,
    }, 512, 7, 7, 0.4, 130);
}

export function createWallStoneMaterial(): THREE.MeshStandardMaterial {
    return buildMarbleMaterial({
        baseColor: '#CAC7C2',
        mottleLight: 'rgba(255,255,250,0.06)',
        mottleDark: 'rgba(70,66,58,0.07)',
        veinColor: 'rgba(150,144,132,0.35)',
        veinCount: 24,
        speckleCount: 50,
    }, 512, 10, 3, 0.8, 165);
}

export function createPillarMarbleMaterial(): THREE.MeshStandardMaterial {
    return buildMarbleMaterial({
        baseColor: '#DDD9D1',
        mottleLight: 'rgba(255,255,255,0.08)',
        mottleDark: 'rgba(150,140,120,0.08)',
        veinColor: 'rgba(160,150,130,0.4)',
        veinCount: 30,
        speckleCount: 40,
    }, 512, 1, 6, 0.55, 170);
}
