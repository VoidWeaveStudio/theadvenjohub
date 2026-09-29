// src/features/game/world/locations/showcase/rooms/news/newsTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { hex, rgba } from "../../textures";
import { MEMECOIN_BANNERS } from "../war/warTextures";

const UP = 0x2fbf6a;
const DOWN = 0xd94f4f;

function canvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    return { canvas: element, ctx: element.getContext("2d") as CanvasRenderingContext2D };
}

function finish(bin: AssetBin, element: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(element));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

// One tile holds every ticker once, so scrolling `offset.x` forever reads as a
// continuous crawl instead of a loop the eye can catch.
export function tickerTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const { canvas: element, ctx } = canvas(2048, 128);

    ctx.fillStyle = hex(0x0a0d14);
    ctx.fillRect(0, 0, 2048, 128);

    const slot = 2048 / MEMECOIN_BANNERS.length;
    ctx.textBaseline = "middle";

    MEMECOIN_BANNERS.forEach((banner, index) => {
        const x = index * slot + 26;
        const up = random() > 0.45;
        const move = (random() * 340).toFixed(1);

        ctx.font = "bold 58px monospace";
        ctx.fillStyle = hex(0xe8edf5);
        ctx.fillText(banner.ticker, x, 64);

        ctx.font = "bold 52px monospace";
        ctx.fillStyle = hex(up ? UP : DOWN);
        ctx.fillText(`${up ? "+" : "-"}${move}%`, x + 210, 64);

        ctx.fillStyle = rgba(0xffffff, 0.12);
        ctx.fillRect(index * slot, 26, 2, 76);
    });

    const texture = finish(bin, element);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
}

// The walk ends on the level it started from, so the tile can be scrolled forever and
// the wrap point does not show up as a step in the chart.
export function chartTexture(bin: AssetBin, random: () => number, bullish: boolean): THREE.CanvasTexture {
    const width = 1024;
    const height = 512;
    const { canvas: element, ctx } = canvas(width, height);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, hex(0x0a1018));
    grad.addColorStop(1, hex(0x05080e));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = rgba(0x2fd8e8, 0.12);
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
        const y = (i / 10) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    for (let i = 1; i < 20; i++) {
        const x = (i / 20) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    const candles = 48;
    const slot = width / candles;
    const start = bullish ? height * 0.74 : height * 0.3;

    const levels: number[] = [start];
    for (let i = 1; i < candles; i++) {
        const bias = bullish ? 0.6 : 0.4;
        const drift = (random() - bias) * height * 0.06;
        levels.push(Math.max(height * 0.1, Math.min(height * 0.9, levels[i - 1] + drift)));
    }
    // Ease the tail back to the opening level so the tile wraps cleanly.
    for (let i = 0; i < candles; i++) {
        const t = Math.max(0, (i - candles * 0.7) / (candles * 0.3));
        levels[i] = levels[i] * (1 - t) + start * t;
    }

    for (let i = 0; i < candles; i++) {
        const from = levels[i];
        const to = levels[(i + 1) % candles];
        const up = to < from;
        const top = Math.min(from, to);
        const body = Math.max(3, Math.abs(to - from));
        const x = i * slot;

        ctx.strokeStyle = hex(up ? UP : DOWN);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + slot * 0.5, top - random() * 20);
        ctx.lineTo(x + slot * 0.5, top + body + random() * 20);
        ctx.stroke();

        ctx.fillStyle = hex(up ? UP : DOWN);
        ctx.fillRect(x + slot * 0.2, top, slot * 0.6, body);
    }

    const texture = finish(bin, element);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
}

// Order-book style rows. Also scrolls, vertically, which is what sells a live feed on a
// side monitor without redrawing a canvas every frame.
export function bookTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const width = 512;
    const height = 1024;
    const { canvas: element, ctx } = canvas(width, height);

    ctx.fillStyle = hex(0x06090f);
    ctx.fillRect(0, 0, width, height);

    const rows = 32;
    const rowHeight = height / rows;
    ctx.font = "bold 30px monospace";
    ctx.textBaseline = "middle";

    for (let i = 0; i < rows; i++) {
        const y = i * rowHeight + rowHeight * 0.5;
        const bid = i % 2 === 0;
        const depth = 0.15 + random() * 0.8;

        ctx.fillStyle = rgba(bid ? UP : DOWN, 0.16);
        ctx.fillRect(0, i * rowHeight + 2, width * depth, rowHeight - 4);

        ctx.fillStyle = hex(bid ? UP : DOWN);
        ctx.fillText((random() * 9).toFixed(4), 16, y);

        ctx.fillStyle = rgba(0xe8edf5, 0.75);
        ctx.fillText(`${Math.floor(random() * 900) + 20}K`, width - 150, y);
    }

    const texture = finish(bin, element);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function plateTexture(bin: AssetBin, label: string, background: number, color: number): THREE.CanvasTexture {
    const { canvas: element, ctx } = canvas(1024, 256);

    ctx.fillStyle = hex(background);
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = rgba(color, 0.55);
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 996, 228);

    ctx.font = "bold 128px sans-serif";
    ctx.fillStyle = hex(color);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 512, 136);

    return finish(bin, element);
}

// The broadcast nameplate. Transparent outside the bars so it can sit over the set as a
// graphic rather than as a lit box.
export function lowerThirdTexture(bin: AssetBin, name: string, role: string, accent: number): THREE.CanvasTexture {
    const width = 1024;
    const height = 256;
    const { canvas: element, ctx } = canvas(width, height);

    ctx.fillStyle = rgba(0x080b12, 0.93);
    ctx.fillRect(40, 40, width - 80, 104);

    ctx.fillStyle = hex(accent);
    ctx.fillRect(40, 40, 16, 104);
    ctx.fillRect(40, 150, width - 80, 52);

    ctx.font = "bold 66px sans-serif";
    ctx.fillStyle = hex(0xf2f6ff);
    ctx.textBaseline = "middle";
    ctx.fillText(name, 80, 94);

    ctx.font = "bold 34px sans-serif";
    ctx.fillStyle = hex(0x081018);
    ctx.fillText(role, 62, 177);

    return finish(bin, element);
}

export function prompterTexture(bin: AssetBin, accent: number): THREE.CanvasTexture {
    const width = 512;
    const height = 512;
    const { canvas: element, ctx } = canvas(width, height);

    ctx.fillStyle = hex(0x02040a);
    ctx.fillRect(0, 0, width, height);

    ctx.font = "bold 34px monospace";
    ctx.fillStyle = rgba(accent, 0.72);
    ctx.textBaseline = "middle";

    const words = ["HOLDERS", "REMAIN", "CALM", "THE", "FLOOR", "IS", "A", "SUGGESTION", "MORE", "AFTER", "THE", "BREAK", "LIQUIDITY", "IS", "FINE", "PROBABLY"];
    let index = 0;

    for (let y = 26; y < height; y += 46) {
        let line = "";
        while (line.length < 22) {
            line += `${words[index % words.length]} `;
            index++;
        }
        ctx.fillText(line.trim(), 22, y);
    }

    const texture = finish(bin, element);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Warm interior seen through the control-room glass: banks of small screens and the
// glow of a desk lamp, so the studio reads as part of a bigger building.
export function controlRoomTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const width = 1024;
    const height = 512;
    const { canvas: element, ctx } = canvas(width, height);

    ctx.fillStyle = hex(0x0d1016);
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 8; column++) {
            const x = 40 + column * 122;
            const y = 40 + row * 108;
            ctx.fillStyle = hex(0x05070c);
            ctx.fillRect(x, y, 104, 82);

            ctx.fillStyle = rgba(random() > 0.5 ? UP : DOWN, 0.5 + random() * 0.4);
            const bars = 6;
            for (let b = 0; b < bars; b++) {
                const bh = 8 + random() * 60;
                ctx.fillRect(x + 8 + b * 15, y + 74 - bh, 10, bh);
            }
        }
    }

    const lamp = ctx.createRadialGradient(width * 0.78, height * 0.86, 10, width * 0.78, height * 0.86, 240);
    lamp.addColorStop(0, rgba(0xffc27a, 0.75));
    lamp.addColorStop(1, rgba(0xffc27a, 0));
    ctx.fillStyle = lamp;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    ctx.fillStyle = hex(0x161a22);
    ctx.fillRect(0, height - 90, width, 90);

    return finish(bin, element);
}
