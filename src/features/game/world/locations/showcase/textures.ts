// src/features/game/world/locations/showcase/textures.ts
import * as THREE from "three";
import { AssetBin } from "../../AssetBin";

type Ctx = CanvasRenderingContext2D;

export function hex(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
}

export function rgba(color: number, alpha: number): string {
    return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

function mix(a: number, b: number, amount: number): number {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const r = Math.round(ar + (br - ar) * amount);
    const g = Math.round(ag + (bg - ag) * amount);
    const bl = Math.round(ab + (bb - ab) * amount);
    return (r << 16) | (g << 8) | bl;
}

export type EmblemKind = "chart" | "rocket" | "dog" | "frog" | "diamond" | "coin" | "moon" | "bull" | "skull" | "hands";

export function drawEmblem(ctx: Ctx, kind: EmblemKind, cx: number, cy: number, r: number, color: string, dark: string) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (kind === "chart") {
        for (let i = 0; i < 5; i++) {
            const h = r * (0.35 + i * 0.28);
            ctx.fillRect(-r * 0.82 + i * r * 0.36, r * 0.7 - h, r * 0.24, h);
        }
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, r * 0.3);
        ctx.lineTo(r * 0.8, -r * 0.78);
        ctx.stroke();
    } else if (kind === "rocket") {
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(r * 0.5, -r * 0.1, r * 0.34, r * 0.55);
        ctx.lineTo(-r * 0.34, r * 0.55);
        ctx.quadraticCurveTo(-r * 0.5, -r * 0.1, 0, -r);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.32, r * 0.1);
        ctx.lineTo(r * 0.78, r * 0.66);
        ctx.lineTo(r * 0.32, r * 0.56);
        ctx.moveTo(-r * 0.32, r * 0.1);
        ctx.lineTo(-r * 0.78, r * 0.66);
        ctx.lineTo(-r * 0.32, r * 0.56);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(0, -r * 0.32, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
    } else if (kind === "dog") {
        ctx.beginPath();
        ctx.arc(0, r * 0.05, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.3);
        ctx.lineTo(-r * 0.86, -r * 0.92);
        ctx.lineTo(-r * 0.2, -r * 0.55);
        ctx.moveTo(r * 0.62, -r * 0.3);
        ctx.lineTo(r * 0.86, -r * 0.92);
        ctx.lineTo(r * 0.2, -r * 0.55);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-r * 0.24, -r * 0.02, r * 0.1, 0, Math.PI * 2);
        ctx.arc(r * 0.24, -r * 0.02, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, r * 0.28, r * 0.16, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (kind === "frog") {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.18, r * 0.72, r * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.4, -r * 0.4, r * 0.27, 0, Math.PI * 2);
        ctx.arc(r * 0.4, -r * 0.4, r * 0.27, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-r * 0.4, -r * 0.4, r * 0.11, 0, Math.PI * 2);
        ctx.arc(r * 0.4, -r * 0.4, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, r * 0.34);
        ctx.quadraticCurveTo(0, r * 0.64, r * 0.46, r * 0.34);
        ctx.stroke();
    } else if (kind === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.78);
        ctx.lineTo(r * 0.8, -r * 0.1);
        ctx.lineTo(0, r * 0.86);
        ctx.lineTo(-r * 0.8, -r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.1);
        ctx.lineTo(r * 0.8, -r * 0.1);
        ctx.moveTo(-r * 0.36, -r * 0.78);
        ctx.lineTo(0, r * 0.86);
        ctx.moveTo(r * 0.36, -r * 0.78);
        ctx.lineTo(0, r * 0.86);
        ctx.stroke();
    } else if (kind === "coin") {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.font = "bold " + Math.round(r * 0.9) + "px sans-serif";
        ctx.fillText("$", 0, r * 0.04);
    } else if (kind === "moon") {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(r * 0.34, -r * 0.2, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
    } else if (kind === "bull") {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.2, r * 0.52, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.98, -r * 0.6, -r * 0.6, -r * 0.9);
        ctx.quadraticCurveTo(-r * 0.6, -r * 0.42, -r * 0.3, -r * 0.34);
        ctx.moveTo(r * 0.5, -r * 0.2);
        ctx.quadraticCurveTo(r * 0.98, -r * 0.6, r * 0.6, -r * 0.9);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.42, r * 0.3, -r * 0.34);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-r * 0.2, r * 0.02, r * 0.09, 0, Math.PI * 2);
        ctx.arc(r * 0.2, r * 0.02, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
    } else if (kind === "skull") {
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.6, Math.PI, Math.PI * 2);
        ctx.rect(-r * 0.6, -r * 0.1, r * 1.2, r * 0.6);
        ctx.fill();
        ctx.fillRect(-r * 0.3, r * 0.5, r * 0.6, r * 0.26);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-r * 0.26, -r * 0.08, r * 0.16, 0, Math.PI * 2);
        ctx.arc(r * 0.26, -r * 0.08, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-r * 0.08, r * 0.14, r * 0.16, r * 0.2);
    } else {
        ctx.beginPath();
        ctx.moveTo(-r * 0.82, r * 0.72);
        ctx.lineTo(-r * 0.56, -r * 0.3);
        ctx.lineTo(-r * 0.2, -r * 0.74);
        ctx.lineTo(r * 0.2, -r * 0.74);
        ctx.lineTo(r * 0.56, -r * 0.3);
        ctx.lineTo(r * 0.82, r * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.74);
        ctx.lineTo(0, r * 0.12);
        ctx.lineTo(r * 0.2, -r * 0.74);
        ctx.stroke();
    }

    ctx.restore();
}

export class ShowcaseTextures {
    private readonly cache = new Map<string, THREE.CanvasTexture>();

    constructor(private readonly bin: AssetBin, private readonly random: () => number) { }

    private build(
        key: string,
        repeat: number | [number, number],
        draw: (ctx: Ctx, size: number, random: () => number) => void,
        size = 512,
        srgb = true
    ): THREE.CanvasTexture {
        const repeatX = Array.isArray(repeat) ? repeat[0] : repeat;
        const repeatY = Array.isArray(repeat) ? repeat[1] : repeat;
        const id = `${key}|${repeatX}|${repeatY}`;
        const cached = this.cache.get(id);
        if (cached) return cached;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d") as Ctx;
        draw(ctx, size, this.random);

        const texture = this.bin.texture(new THREE.CanvasTexture(canvas));
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.anisotropy = 8;
        if (srgb) texture.colorSpace = THREE.SRGBColorSpace;

        this.cache.set(id, texture);
        return texture;
    }

    private speckle(ctx: Ctx, size: number, random: () => number, count: number, color: number, alpha: number, min: number, max: number) {
        for (let i = 0; i < count; i++) {
            ctx.fillStyle = rgba(color, alpha * (0.35 + random() * 0.65));
            const r = min + random() * (max - min);
            ctx.beginPath();
            ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private veins(ctx: Ctx, size: number, random: () => number, count: number, color: number, alpha: number, width: number) {
        ctx.strokeStyle = rgba(color, alpha);
        ctx.lineCap = "round";
        for (let i = 0; i < count; i++) {
            ctx.lineWidth = width * (0.4 + random() * 1.2);
            ctx.beginPath();
            let x = random() * size;
            let y = random() * size;
            ctx.moveTo(x, y);
            for (let j = 0; j < 7; j++) {
                x += (random() - 0.5) * size * 0.32;
                y += (random() - 0.5) * size * 0.32;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    plaster(repeat: number | [number, number], base: number, grime = 0x000000): THREE.CanvasTexture {
        return this.build(`plaster${base.toString(16)}${grime.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 220, mix(base, 0xffffff, 0.22), 0.3, 8, 40);
            this.speckle(ctx, size, random, 180, mix(base, 0x000000, 0.3), 0.26, 6, 34);
            this.speckle(ctx, size, random, 260, mix(base, grime, 0.5), 0.18, 2, 10);
            this.veins(ctx, size, random, 12, mix(base, 0x000000, 0.45), 0.16, 1.2);
        });
    }

    stoneBlock(repeat: number | [number, number], base: number, mortar: number, rows = 6): THREE.CanvasTexture {
        return this.build(`block${base.toString(16)}${mortar.toString(16)}${rows}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(mortar);
            ctx.fillRect(0, 0, size, size);

            const rowHeight = size / rows;
            for (let row = 0; row < rows; row++) {
                const offset = (row % 2) * rowHeight * 0.9;
                const columns = 3;
                for (let col = -1; col <= columns; col++) {
                    const w = size / columns;
                    const x = col * w + offset;
                    const y = row * rowHeight;
                    ctx.fillStyle = hex(mix(base, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.14));
                    ctx.fillRect(x + 3, y + 3, w - 6, rowHeight - 6);

                    ctx.fillStyle = rgba(0xffffff, 0.06);
                    ctx.fillRect(x + 3, y + 3, w - 6, 3);
                    ctx.fillStyle = rgba(0x000000, 0.14);
                    ctx.fillRect(x + 3, y + rowHeight - 7, w - 6, 4);
                }
            }

            this.speckle(ctx, size, random, 300, mix(base, 0x000000, 0.4), 0.18, 2, 9);
            this.speckle(ctx, size, random, 120, mix(base, 0xffffff, 0.3), 0.14, 2, 7);
            this.veins(ctx, size, random, 16, mix(base, 0x000000, 0.5), 0.14, 1);
        });
    }

    marble(repeat: number | [number, number], base: number, vein: number): THREE.CanvasTexture {
        return this.build(`marble${base.toString(16)}${vein.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 90, mix(base, 0xffffff, 0.3), 0.4, 30, 120);
            this.speckle(ctx, size, random, 70, mix(base, vein, 0.35), 0.22, 20, 90);
            this.veins(ctx, size, random, 24, vein, 0.4, 2.2);
            this.veins(ctx, size, random, 40, mix(vein, 0xffffff, 0.4), 0.2, 1);
        });
    }

    planks(repeat: number | [number, number], base: number, gap: number, count = 7): THREE.CanvasTexture {
        return this.build(`planks${base.toString(16)}${gap.toString(16)}${count}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(gap);
            ctx.fillRect(0, 0, size, size);

            const height = size / count;
            for (let i = 0; i < count; i++) {
                const shade = mix(base, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.16);
                ctx.fillStyle = hex(shade);
                ctx.fillRect(0, i * height + 2, size, height - 4);

                for (let g = 0; g < 6; g++) {
                    ctx.strokeStyle = rgba(mix(shade, 0x000000, 0.45), 0.3 + random() * 0.3);
                    ctx.lineWidth = 0.8 + random() * 1.6;
                    ctx.beginPath();
                    const y = i * height + 4 + random() * (height - 8);
                    ctx.moveTo(0, y);
                    for (let x = 0; x <= size; x += size / 8) {
                        ctx.lineTo(x, y + Math.sin(x * 0.03 + g) * (1 + random() * 2.5));
                    }
                    ctx.stroke();
                }

                for (let k = 0; k < 3; k++) {
                    if (random() > 0.45) continue;
                    ctx.fillStyle = rgba(mix(shade, 0x000000, 0.55), 0.45);
                    ctx.beginPath();
                    ctx.ellipse(random() * size, i * height + height / 2, 3 + random() * 5, 2 + random() * 3, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                const seam = random() * size;
                ctx.fillStyle = hex(gap);
                ctx.fillRect(seam, i * height, 3, height);
            }
        });
    }

    carpet(repeat: number | [number, number], base: number, accent: number): THREE.CanvasTexture {
        return this.build(`carpet${base.toString(16)}${accent.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);

            ctx.strokeStyle = hex(accent);
            ctx.lineWidth = size * 0.03;
            ctx.strokeRect(size * 0.09, size * 0.09, size * 0.82, size * 0.82);
            ctx.lineWidth = size * 0.012;
            ctx.strokeRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);

            ctx.save();
            ctx.translate(size / 2, size / 2);
            for (let i = 0; i < 8; i++) {
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = rgba(accent, 0.75);
                ctx.beginPath();
                ctx.ellipse(0, size * 0.24, size * 0.035, size * 0.08, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            ctx.fillStyle = rgba(accent, 0.5);
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size * 0.07, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < 1400; i++) {
                ctx.fillStyle = rgba(random() < 0.5 ? 0x000000 : 0xffffff, 0.05);
                ctx.fillRect(random() * size, random() * size, 2, 2);
            }
        });
    }

    checker(repeat: number | [number, number], a: number, b: number, cells = 4): THREE.CanvasTexture {
        return this.build(`checker${a.toString(16)}${b.toString(16)}${cells}`, repeat, (ctx, size, random) => {
            const step = size / cells;
            for (let y = 0; y < cells; y++) {
                for (let x = 0; x < cells; x++) {
                    const tone = (x + y) % 2 === 0 ? a : b;
                    ctx.fillStyle = hex(mix(tone, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.07));
                    ctx.fillRect(x * step, y * step, step, step);
                    ctx.strokeStyle = rgba(0x000000, 0.22);
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * step, y * step, step, step);
                }
            }
            this.veins(ctx, size, random, 14, 0xffffff, 0.06, 1.4);
            this.speckle(ctx, size, random, 160, 0x000000, 0.05, 2, 10);
        });
    }

    grass(repeat: number | [number, number], base: number, blade: number): THREE.CanvasTexture {
        return this.build(`grass${base.toString(16)}${blade.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 200, mix(base, 0x000000, 0.35), 0.3, 12, 60);
            this.speckle(ctx, size, random, 160, mix(base, blade, 0.7), 0.26, 10, 46);

            for (let i = 0; i < 2600; i++) {
                const x = random() * size;
                const y = random() * size;
                const length = 3 + random() * 7;
                ctx.strokeStyle = rgba(mix(blade, random() < 0.4 ? 0x000000 : 0xffffff, random() * 0.4), 0.5);
                ctx.lineWidth = 1 + random();
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + (random() - 0.5) * 3, y - length);
                ctx.stroke();
            }
        });
    }

    dirt(repeat: number | [number, number], base: number, pebble: number): THREE.CanvasTexture {
        return this.build(`dirt${base.toString(16)}${pebble.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 240, mix(base, 0x000000, 0.32), 0.36, 8, 44);
            this.speckle(ctx, size, random, 180, mix(base, 0xffffff, 0.2), 0.26, 6, 30);
            this.speckle(ctx, size, random, 320, pebble, 0.5, 1.5, 5);
            this.veins(ctx, size, random, 20, mix(base, 0x000000, 0.4), 0.2, 1.3);
        });
    }

    cobble(repeat: number | [number, number], base: number, mortar: number): THREE.CanvasTexture {
        return this.build(`cobble${base.toString(16)}${mortar.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(mortar);
            ctx.fillRect(0, 0, size, size);

            const cells = 7;
            const step = size / cells;
            for (let y = -1; y <= cells; y++) {
                for (let x = -1; x <= cells; x++) {
                    const cx = (x + 0.5) * step + (random() - 0.5) * step * 0.3 + (y % 2) * step * 0.5;
                    const cy = (y + 0.5) * step + (random() - 0.5) * step * 0.3;
                    const rx = step * (0.36 + random() * 0.14);
                    const ry = step * (0.32 + random() * 0.14);

                    ctx.fillStyle = hex(mix(base, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.2));
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = rgba(0x000000, 0.3);
                    ctx.lineWidth = 1.6;
                    ctx.stroke();
                }
            }

            this.speckle(ctx, size, random, 260, 0x000000, 0.08, 2, 12);
        });
    }

    sand(repeat: number | [number, number], base: number): THREE.CanvasTexture {
        return this.build(`sand${base.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 180, mix(base, 0xffffff, 0.18), 0.3, 20, 90);
            this.speckle(ctx, size, random, 220, mix(base, 0x000000, 0.22), 0.24, 10, 50);

            for (let i = 0; i < 26; i++) {
                ctx.strokeStyle = rgba(mix(base, 0x000000, 0.25), 0.18);
                ctx.lineWidth = 2 + random() * 5;
                ctx.beginPath();
                const y = random() * size;
                ctx.moveTo(0, y);
                for (let x = 0; x <= size; x += size / 10) {
                    ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 7);
                }
                ctx.stroke();
            }

            for (let i = 0; i < 1600; i++) {
                ctx.fillStyle = rgba(random() < 0.5 ? 0xffffff : 0x000000, 0.06);
                ctx.fillRect(random() * size, random() * size, 2, 2);
            }
        });
    }

    regolith(repeat: number | [number, number], base: number): THREE.CanvasTexture {
        return this.build(`regolith${base.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 150, mix(base, 0x000000, 0.28), 0.4, 24, 96);
            this.speckle(ctx, size, random, 200, mix(base, 0xffffff, 0.24), 0.26, 12, 52);

            for (let i = 0; i < 34; i++) {
                const cx = random() * size;
                const cy = random() * size;
                const r = 6 + random() * 26;
                ctx.fillStyle = rgba(mix(base, 0x000000, 0.35), 0.55);
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = rgba(mix(base, 0xffffff, 0.3), 0.4);
                ctx.beginPath();
                ctx.arc(cx, cy - r * 0.16, r * 0.78, Math.PI, Math.PI * 2);
                ctx.fill();
            }

            this.speckle(ctx, size, random, 420, 0x000000, 0.2, 1, 4);
        });
    }

    granite(repeat: number | [number, number], base: number): THREE.CanvasTexture {
        return this.build(`granite${base.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 600, mix(base, 0x000000, 0.45), 0.35, 1.5, 6);
            this.speckle(ctx, size, random, 420, mix(base, 0xffffff, 0.4), 0.3, 1.5, 5);
            this.speckle(ctx, size, random, 90, mix(base, 0xffffff, 0.16), 0.25, 18, 70);
            this.veins(ctx, size, random, 10, mix(base, 0xffffff, 0.25), 0.12, 1.6);
        });
    }

    stripes(repeat: number | [number, number], a: number, b: number, count = 6, vertical = false): THREE.CanvasTexture {
        return this.build(`stripes${a.toString(16)}${b.toString(16)}${count}${vertical}`, repeat, (ctx, size, random) => {
            const band = size / count;
            for (let i = 0; i < count; i++) {
                ctx.fillStyle = hex(i % 2 === 0 ? a : b);
                if (vertical) ctx.fillRect(i * band, 0, band, size);
                else ctx.fillRect(0, i * band, size, band);
            }

            ctx.fillStyle = rgba(0x000000, 0.1);
            for (let i = 0; i < count; i++) {
                if (vertical) ctx.fillRect(i * band, 0, 3, size);
                else ctx.fillRect(0, i * band, size, 3);
            }

            for (let i = 0; i < 900; i++) {
                ctx.fillStyle = rgba(random() < 0.5 ? 0x000000 : 0xffffff, 0.05);
                ctx.fillRect(random() * size, random() * size, 3, 3);
            }
        });
    }

    panel(repeat: number | [number, number], base: number, seam: number, cells = 4): THREE.CanvasTexture {
        return this.build(`panel${base.toString(16)}${seam.toString(16)}${cells}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);

            const step = size / cells;
            for (let y = 0; y < cells; y++) {
                for (let x = 0; x < cells; x++) {
                    ctx.fillStyle = hex(mix(base, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.1));
                    ctx.fillRect(x * step + 4, y * step + 4, step - 8, step - 8);

                    ctx.fillStyle = rgba(0xffffff, 0.08);
                    ctx.fillRect(x * step + 4, y * step + 4, step - 8, 3);
                    ctx.fillStyle = rgba(0x000000, 0.2);
                    ctx.fillRect(x * step + 4, y * step + step - 7, step - 8, 3);

                    for (let b = 0; b < 4; b++) {
                        const bx = x * step + 12 + (b % 2) * (step - 28);
                        const by = y * step + 12 + Math.floor(b / 2) * (step - 28);
                        ctx.fillStyle = rgba(seam, 0.85);
                        ctx.beginPath();
                        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            ctx.strokeStyle = rgba(seam, 0.5);
            ctx.lineWidth = 2;
            for (let i = 0; i <= cells; i++) {
                ctx.beginPath();
                ctx.moveTo(i * step, 0);
                ctx.lineTo(i * step, size);
                ctx.moveTo(0, i * step);
                ctx.lineTo(size, i * step);
                ctx.stroke();
            }

            this.speckle(ctx, size, random, 140, 0x000000, 0.08, 2, 10);
        });
    }

    felt(repeat: number | [number, number], base: number, line: number): THREE.CanvasTexture {
        return this.build(`felt${base.toString(16)}${line.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 120, mix(base, 0x000000, 0.3), 0.2, 20, 80);

            ctx.strokeStyle = rgba(line, 0.7);
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(size / 2, size * 0.62, size * 0.3, Math.PI, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(size / 2, size * 0.62, size * 0.38, Math.PI, Math.PI * 2);
            ctx.stroke();

            for (let i = 0; i < 2000; i++) {
                ctx.fillStyle = rgba(random() < 0.5 ? 0x000000 : 0xffffff, 0.04);
                ctx.fillRect(random() * size, random() * size, 2, 2);
            }
        });
    }

    water(repeat: number | [number, number], deep: number, shallow: number): THREE.CanvasTexture {
        return this.build(`water${deep.toString(16)}${shallow.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(deep);
            ctx.fillRect(0, 0, size, size);

            for (let i = 0; i < 120; i++) {
                const cx = random() * size;
                const cy = random() * size;
                const r = 10 + random() * 60;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                gradient.addColorStop(0, rgba(shallow, 0.4));
                gradient.addColorStop(1, rgba(shallow, 0));
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.strokeStyle = rgba(0xffffff, 0.22);
            for (let i = 0; i < 40; i++) {
                ctx.lineWidth = 1 + random() * 2.5;
                ctx.beginPath();
                const y = random() * size;
                ctx.moveTo(0, y);
                for (let x = 0; x <= size; x += size / 12) {
                    ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * (3 + random() * 5));
                }
                ctx.stroke();
            }
        });
    }

    grid(repeat: number | [number, number], base: number, line: number, cells = 8): THREE.CanvasTexture {
        return this.build(`grid${base.toString(16)}${line.toString(16)}${cells}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 80, mix(base, 0xffffff, 0.12), 0.2, 20, 90);

            const step = size / cells;
            ctx.strokeStyle = rgba(line, 0.75);
            ctx.lineWidth = 3;
            for (let i = 0; i <= cells; i++) {
                ctx.beginPath();
                ctx.moveTo(i * step, 0);
                ctx.lineTo(i * step, size);
                ctx.moveTo(0, i * step);
                ctx.lineTo(size, i * step);
                ctx.stroke();
            }

            ctx.strokeStyle = rgba(line, 0.25);
            ctx.lineWidth = 9;
            for (let i = 0; i <= cells; i++) {
                ctx.beginPath();
                ctx.moveTo(i * step, 0);
                ctx.lineTo(i * step, size);
                ctx.moveTo(0, i * step);
                ctx.lineTo(size, i * step);
                ctx.stroke();
            }
        });
    }

    bark(repeat: number | [number, number], base: number): THREE.CanvasTexture {
        return this.build(`bark${base.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(base);
            ctx.fillRect(0, 0, size, size);

            for (let i = 0; i < 90; i++) {
                const x = random() * size;
                const width = 3 + random() * 12;
                ctx.fillStyle = hex(mix(base, random() < 0.55 ? 0x000000 : 0xffffff, random() * 0.3));
                ctx.beginPath();
                ctx.moveTo(x, 0);
                for (let y = 0; y <= size; y += size / 10) {
                    ctx.lineTo(x + Math.sin(y * 0.02 + i) * 5, y);
                }
                for (let y = size; y >= 0; y -= size / 10) {
                    ctx.lineTo(x + width + Math.sin(y * 0.02 + i) * 5, y);
                }
                ctx.closePath();
                ctx.fill();
            }

            this.speckle(ctx, size, random, 180, mix(base, 0x000000, 0.4), 0.22, 2, 9);
        });
    }

    hazard(repeat: number | [number, number], a: number, b: number): THREE.CanvasTexture {
        return this.build(`hazard${a.toString(16)}${b.toString(16)}`, repeat, (ctx, size, random) => {
            ctx.fillStyle = hex(a);
            ctx.fillRect(0, 0, size, size);

            ctx.fillStyle = hex(b);
            ctx.save();
            ctx.translate(size / 2, size / 2);
            ctx.rotate(Math.PI / 4);
            for (let i = -8; i < 8; i++) {
                ctx.fillRect(i * size * 0.18, -size, size * 0.09, size * 2);
            }
            ctx.restore();

            this.speckle(ctx, size, random, 220, 0x000000, 0.12, 2, 14);
            this.speckle(ctx, size, random, 120, 0x6b6155, 0.2, 3, 16);
        });
    }

    gradient(key: string, stops: Array<[number, number]>, haze = 0): THREE.CanvasTexture {
        return this.build(`gradient${key}`, 1, (ctx, size, random) => {
            const ramp = ctx.createLinearGradient(0, size, 0, 0);
            for (const [offset, color] of stops) ramp.addColorStop(offset, hex(color));
            ctx.fillStyle = ramp;
            ctx.fillRect(0, 0, size, size);

            if (haze > 0) {
                for (let i = 0; i < 90; i++) {
                    ctx.fillStyle = rgba(0xffffff, haze * (0.2 + random() * 0.8));
                    const y = size * (0.45 + random() * 0.5);
                    ctx.beginPath();
                    ctx.ellipse(random() * size, y, 20 + random() * 90, 4 + random() * 14, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }, 256);
    }

    stained(key: string, kind: EmblemKind, tint: number, lead = 0x1d1710): THREE.CanvasTexture {
        return this.build(`stained${key}`, 1, (ctx, size, random) => {
            ctx.fillStyle = hex(lead);
            ctx.fillRect(0, 0, size, size);

            const cells = 10;
            const step = size / cells;
            for (let y = 0; y < cells; y++) {
                for (let x = 0; x < cells; x++) {
                    ctx.fillStyle = hex(mix(tint, random() < 0.5 ? 0x000000 : 0xffffff, random() * 0.35));
                    ctx.fillRect(x * step + 3, y * step + 3, step - 6, step - 6);
                }
            }

            const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
            glow.addColorStop(0, rgba(0xffffff, 0.35));
            glow.addColorStop(1, rgba(0xffffff, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);

            ctx.fillStyle = hex(lead);
            ctx.beginPath();
            ctx.arc(size / 2, size * 0.44, size * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = hex(mix(tint, 0xffffff, 0.6));
            ctx.beginPath();
            ctx.arc(size / 2, size * 0.44, size * 0.29, 0, Math.PI * 2);
            ctx.fill();

            drawEmblem(ctx, kind, size / 2, size * 0.44, size * 0.2, hex(mix(tint, 0x000000, 0.5)), hex(lead));

            ctx.strokeStyle = hex(lead);
            ctx.lineWidth = size * 0.05;
            ctx.strokeRect(0, 0, size, size);
        }, 512);
    }

    emblem(key: string, kind: EmblemKind, background: number, color: number, label?: string): THREE.CanvasTexture {
        return this.build(`emblem${key}`, 1, (ctx, size, random) => {
            ctx.fillStyle = hex(background);
            ctx.fillRect(0, 0, size, size);
            this.speckle(ctx, size, random, 120, mix(background, 0xffffff, 0.2), 0.12, 4, 30);

            drawEmblem(ctx, kind, size / 2, label ? size * 0.4 : size / 2, size * 0.3, hex(color), hex(mix(color, 0x000000, 0.55)));

            if (label) {
                ctx.fillStyle = hex(color);
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                let font = Math.round(size * 0.17);
                const limit = size * 0.82;
                for (let guard = 0; guard < 40; guard++) {
                    ctx.font = `bold ${font}px sans-serif`;
                    const measured = ctx.measureText(label).width;
                    if (measured <= limit || font <= 8) break;
                    font = Math.max(8, Math.floor(font * Math.min(0.92, limit / measured)));
                }
                ctx.fillText(label, size / 2, size * 0.85);
            }
        }, 512);
    }

    sign(
        key: string,
        lines: string[],
        options: { background?: number; color?: number; accent?: number; width?: number; height?: number } = {}
    ): THREE.CanvasTexture {
        const width = options.width ?? 512;
        const height = options.height ?? 256;
        const background = options.background ?? 0x14110d;
        const color = options.color ?? 0xf6e7c4;
        const accent = options.accent ?? 0xd8b46a;
        const id = `sign|${key}`;
        const cached = this.cache.get(id);
        if (cached) return cached;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d") as Ctx;

        ctx.fillStyle = hex(background);
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < 260; i++) {
            ctx.fillStyle = rgba(this.random() < 0.5 ? 0xffffff : 0x000000, 0.05);
            ctx.fillRect(this.random() * width, this.random() * height, 3, 3);
        }

        const border = Math.round(Math.min(width, height) * 0.045);
        ctx.strokeStyle = hex(accent);
        ctx.lineWidth = Math.max(3, border * 0.7);
        ctx.strokeRect(border, border, width - border * 2, height - border * 2);
        ctx.lineWidth = Math.max(1, border * 0.2);
        ctx.strokeRect(border * 2.2, border * 2.2, width - border * 4.4, height - border * 4.4);

        const padX = border * 3.4;
        const padY = border * 3.2;
        const innerWidth = width - padX * 2;
        const innerHeight = height - padY * 2;
        const rows = Math.max(1, lines.length);
        const rowHeight = innerHeight / rows;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 0; i < lines.length; i++) {
            const text = lines[i];
            const weight = lines.length === 1 ? 1 : (i === 0 ? 1 : 0.68);
            let size = Math.round(rowHeight * 0.78 * weight);

            for (let guard = 0; guard < 40; guard++) {
                ctx.font = `bold ${size}px sans-serif`;
                const measured = ctx.measureText(text).width;
                if (measured <= innerWidth || size <= 10) break;
                size = Math.max(10, Math.floor(size * Math.min(0.92, innerWidth / measured)));
            }

            ctx.font = `bold ${size}px sans-serif`;
            ctx.fillStyle = i === 0 ? hex(color) : hex(accent);
            ctx.fillText(text, width / 2, padY + rowHeight * (i + 0.5));
        }

        const texture = this.bin.texture(new THREE.CanvasTexture(canvas));
        texture.anisotropy = 8;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.cache.set(id, texture);
        return texture;
    }
}

export function surfaceMaterial(
    bin: AssetBin,
    map: THREE.Texture,
    options: { roughness?: number; metalness?: number; bump?: number; color?: number; emissive?: number; emissiveIntensity?: number } = {}
): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
        map,
        color: options.color ?? 0xffffff,
        roughness: options.roughness ?? 0.9,
        metalness: options.metalness ?? 0.05,
    });
    if (options.bump) {
        material.bumpMap = map;
        material.bumpScale = options.bump;
    }
    if (options.emissive !== undefined) {
        material.emissive = new THREE.Color(options.emissive);
        material.emissiveMap = map;
        material.emissiveIntensity = options.emissiveIntensity ?? 1;
    }
    return bin.material(material);
}
