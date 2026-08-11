// src/features/game/world/locations/tower/floors/main-hall/utils/factionImages.ts
const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Array<() => void>>();
const failed = new Set<string>();

export function factionImageUrl(raw: string | null | undefined): string | null {
    if (!raw) return null;
    if (raw.startsWith("data:")) return raw;
    return `/api/image-proxy?url=${encodeURIComponent(raw)}`;
}

export function getFactionImage(raw: string | null | undefined): HTMLImageElement | null {
    const url = factionImageUrl(raw);
    if (!url) return null;
    return images.get(url) ?? null;
}

export function loadFactionImage(raw: string | null | undefined, onReady: () => void) {
    const url = factionImageUrl(raw);
    if (!url || failed.has(url) || images.has(url)) return;

    const waiting = pending.get(url);
    if (waiting) {
        waiting.push(onReady);
        return;
    }
    pending.set(url, [onReady]);

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
        images.set(url, image);
        const listeners = pending.get(url) ?? [];
        pending.delete(url);
        listeners.forEach((callback) => callback());
    };

    image.onerror = () => {
        failed.add(url);
        pending.delete(url);
    };

    image.src = url;
}

export function drawFactionLogo(
    ctx: CanvasRenderingContext2D,
    raw: string | null | undefined,
    x: number,
    y: number,
    size: number,
    fallbackColor: string,
    fallbackLabel: string
) {
    const image = getFactionImage(raw);
    const radius = size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (image) {
        ctx.drawImage(image, x, y, size, size);
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "rgba(10,13,19,0.82)";
        ctx.font = `bold ${Math.round(size * 0.44)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fallbackLabel.slice(0, 3).toUpperCase(), x + radius, y + radius + 1);
    }

    ctx.restore();

    ctx.strokeStyle = fallbackColor;
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
}
