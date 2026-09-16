// src/features/game/world/locations/showcase/story.ts
import * as THREE from "three";
import { AssetBin } from "../../AssetBin";

export interface StoryStep {
    duration: number;
    enter?: () => void;
    update?: (elapsed: number, progress: number) => void;
    exit?: () => void;
}

export class Story {
    private index = -1;
    private elapsed = 0;

    constructor(private readonly steps: StoryStep[]) { }

    public reset() {
        if (this.index >= 0) this.steps[this.index]?.exit?.();
        this.index = -1;
        this.elapsed = 0;
    }

    public update(delta: number) {
        if (this.steps.length === 0) return;

        if (this.index < 0) {
            this.index = 0;
            this.elapsed = 0;
            this.steps[0].enter?.();
        }

        this.elapsed += delta;

        let guard = 0;
        while (this.elapsed >= this.steps[this.index].duration && guard < this.steps.length + 1) {
            guard++;
            this.elapsed -= this.steps[this.index].duration;
            this.steps[this.index].exit?.();
            this.index = (this.index + 1) % this.steps.length;
            this.steps[this.index].enter?.();
        }

        const step = this.steps[this.index];
        step.update?.(this.elapsed, step.duration > 0 ? this.elapsed / step.duration : 1);
    }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function speechTexture(bin: AssetBin, text: string, accent: string, tone: "say" | "shout" | "think"): THREE.CanvasTexture {
    const width = 512;
    const height = 192;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    const pad = 16;
    const boxHeight = height - pad * 2 - 26;

    if (tone === "shout") {
        ctx.beginPath();
        const spikes = 16;
        for (let i = 0; i <= spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? 1 : 0.82;
            const x = width / 2 + Math.cos(angle) * (width / 2 - pad) * radius;
            const y = pad + boxHeight / 2 + Math.sin(angle) * (boxHeight / 2) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    } else {
        roundedRect(ctx, pad, pad, width - pad * 2, boxHeight, tone === "think" ? boxHeight / 2 : 34);
    }

    ctx.fillStyle = "rgba(12, 12, 16, 0.88)";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.beginPath();
    if (tone === "think") {
        ctx.arc(width / 2 - 34, height - 34, 14, 0, Math.PI * 2);
        ctx.moveTo(width / 2 - 4, height - 16);
        ctx.arc(width / 2 - 6, height - 18, 8, 0, Math.PI * 2);
    } else {
        ctx.moveTo(width / 2 - 26, pad + boxHeight - 4);
        ctx.lineTo(width / 2 + 8, pad + boxHeight - 4);
        ctx.lineTo(width / 2 - 16, height - pad);
        ctx.closePath();
    }
    ctx.fillStyle = "rgba(12, 12, 16, 0.88)";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    let size = 62;
    const limit = width - pad * 2 - 40;
    for (let guard = 0; guard < 40; guard++) {
        ctx.font = `bold ${size}px sans-serif`;
        const measured = ctx.measureText(text).width;
        if (measured <= limit || size <= 12) break;
        size = Math.max(12, Math.floor(size * Math.min(0.92, limit / measured)));
    }

    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillText(text, width / 2, pad + boxHeight / 2);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}
