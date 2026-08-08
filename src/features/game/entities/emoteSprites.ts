// src/features/game/entities/emoteSprites.ts
import * as THREE from "three";
import { EmoteKey, EMOTES_BY_KEY } from "../data/emotes";

const FRAME_SIZE = 160;
const FRAME_COUNT = 12;
const TAU = Math.PI * 2;

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color",sans-serif';

export interface EmoteSheet {
    texture: THREE.Texture;
    frames: number;
}

type FramePainter = (ctx: CanvasRenderingContext2D, s: number, t: number) => void;

function drawGlyph(ctx: CanvasRenderingContext2D, char: string, px: number) {
    ctx.font = `${px}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, 0, 0);
}

let colorEmojiSupport: boolean | null = null;

function hasColorEmoji(): boolean {
    if (colorEmojiSupport !== null) return colorEmojiSupport;

    try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.clearRect(0, 0, 32, 32);
        ctx.translate(16, 16);
        drawGlyph(ctx, "😂", 28);

        const data = ctx.getImageData(0, 0, 32, 32).data;
        let opaque = 0;
        let chromatic = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 40) continue;
            opaque++;
            const max = Math.max(data[i], data[i + 1], data[i + 2]);
            const min = Math.min(data[i], data[i + 1], data[i + 2]);
            if (max - min > 24) chromatic++;
        }
        colorEmojiSupport = opaque > 40 && chromatic > 10;
    } catch {
        colorEmojiSupport = false;
    }

    return colorEmojiSupport;
}

function drawFallbackDisc(ctx: CanvasRenderingContext2D, s: number, key: EmoteKey) {
    const accent = EMOTES_BY_KEY.get(key)?.accent ?? "#FFFFFF";
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();
    ctx.restore();
}

const paintLaugh: FramePainter = (ctx, s, t) => {
    const wobble = Math.sin(t * TAU);
    const belly = Math.sin(t * TAU * 2);

    ctx.save();
    ctx.translate(s / 2, s / 2 - Math.abs(belly) * s * 0.045);
    ctx.rotate(wobble * 0.12);
    ctx.scale(1 + belly * 0.05, 1 - belly * 0.045);
    drawGlyph(ctx, "😂", s * 0.66);
    ctx.restore();
};

const paintAngry: FramePainter = (ctx, s, t) => {
    const shake = Math.sin(t * TAU * 6);
    const pulse = Math.sin(t * TAU * 3);

    ctx.save();
    ctx.translate(s / 2 + shake * s * 0.022, s / 2);
    ctx.scale(1 + pulse * 0.04, 1 + pulse * 0.04);
    drawGlyph(ctx, "😡", s * 0.64);
    ctx.restore();

    const markScale = 0.85 + Math.abs(pulse) * 0.35;
    ctx.save();
    ctx.translate(s * 0.76, s * 0.24);
    ctx.scale(markScale, markScale);
    ctx.rotate(shake * 0.12);
    drawGlyph(ctx, "💢", s * 0.26);
    ctx.restore();

    const puff = (t * 1.3) % 1;
    for (const side of [-1, 1]) {
        ctx.fillStyle = `rgba(240,240,246,${(1 - puff) * 0.75})`;
        const px = s * 0.5 + side * s * (0.26 + puff * 0.12);
        const py = s * 0.24 - puff * s * 0.10;
        ctx.beginPath();
        ctx.arc(px, py, s * (0.035 + puff * 0.035), 0, TAU);
        ctx.fill();
    }
};

const paintFuckYou: FramePainter = (ctx, s, t) => {
    const rise = Math.min(1, t * 3);
    const eased = 1 - Math.pow(1 - rise, 3);
    const thrust = rise >= 1 ? Math.sin((t - 0.33) * TAU * 2.2) * s * 0.035 : 0;

    ctx.save();
    ctx.translate(s / 2, s / 2 + (1 - eased) * s * 0.55 - thrust);
    ctx.rotate((1 - eased) * 0.5);
    ctx.scale(0.85 + eased * 0.15, 0.85 + eased * 0.15);
    drawGlyph(ctx, "🖕", s * 0.74);
    ctx.restore();
};

const paintRocket: FramePainter = (ctx, s, t) => {
    const flicker = 0.5 + 0.5 * Math.sin(t * TAU * 3);

    ctx.save();
    ctx.translate(s / 2, s * 0.42);

    const flameLength = s * (0.10 + flicker * 0.16);
    const plume = ctx.createLinearGradient(0, s * 0.18, 0, s * 0.18 + flameLength);
    plume.addColorStop(0, "rgba(255,255,255,0.95)");
    plume.addColorStop(0.35, "rgba(255,206,84,0.9)");
    plume.addColorStop(1, "rgba(255,90,30,0)");
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, s * 0.18);
    ctx.quadraticCurveTo(0, s * 0.18 + flameLength * 1.3, s * 0.07, s * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.rotate(-Math.PI / 4);
    drawGlyph(ctx, "🚀", s * 0.52);
    ctx.restore();

    ctx.fillStyle = `rgba(255,214,140,${0.35 + flicker * 0.4})`;
    for (let i = 0; i < 4; i++) {
        const angle = t * TAU + i * 1.7;
        ctx.beginPath();
        ctx.arc(
            s * 0.5 + Math.cos(angle) * s * 0.12,
            s * 0.72 + ((t + i * 0.25) % 1) * s * 0.14,
            s * 0.013,
            0,
            TAU
        );
        ctx.fill();
    }
};

const PAINTERS: Partial<Record<EmoteKey, FramePainter>> = {
    laugh: paintLaugh,
    angry: paintAngry,
    fuck_you: paintFuckYou,
    to_the_moon: paintRocket,
};

const sheetCache = new Map<EmoteKey, EmoteSheet>();
let moonTexture: THREE.Texture | null = null;

export function getEmoteSheet(key: EmoteKey): EmoteSheet {
    const cached = sheetCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = FRAME_SIZE * FRAME_COUNT;
    canvas.height = FRAME_SIZE;
    const ctx = canvas.getContext("2d")!;

    const emojiReady = hasColorEmoji();

    for (let i = 0; i < FRAME_COUNT; i++) {
        ctx.save();
        ctx.translate(i * FRAME_SIZE, 0);
        ctx.beginPath();
        ctx.rect(0, 0, FRAME_SIZE, FRAME_SIZE);
        ctx.clip();
        const painter = PAINTERS[key];
        if (emojiReady && painter) {
            painter(ctx, FRAME_SIZE, i / FRAME_COUNT);
        } else {
            drawFallbackDisc(ctx, FRAME_SIZE, key);
        }
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.set(1 / FRAME_COUNT, 1);

    const sheet: EmoteSheet = { texture, frames: FRAME_COUNT };
    sheetCache.set(key, sheet);
    return sheet;
}

export function getMoonTexture(): THREE.Texture {
    if (moonTexture) return moonTexture;

    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const halo = ctx.createRadialGradient(size / 2, size / 2, size * 0.26, size / 2, size / 2, size * 0.5);
    halo.addColorStop(0, "rgba(205,230,255,0.55)");
    halo.addColorStop(1, "rgba(205,230,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    if (hasColorEmoji()) {
        drawGlyph(ctx, "🌕", size * 0.72);
    } else {
        ctx.fillStyle = "#E4E8F2";
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, TAU);
        ctx.fill();
    }
    ctx.restore();

    moonTexture = new THREE.CanvasTexture(canvas);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    return moonTexture;
}

export function disposeEmoteAssets() {
    sheetCache.forEach((sheet) => sheet.texture.dispose());
    sheetCache.clear();
    moonTexture?.dispose();
    moonTexture = null;
}
