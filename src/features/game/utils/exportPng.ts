// src/features/game/utils/exportPng.ts
export const MAX_UPLOAD_BYTES = 2.8 * 1024 * 1024;

const MIN_EDGE = 256;

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function downscale(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    return canvas;
}

export async function canvasToPngBlob(
    canvas: HTMLCanvasElement,
    maxBytes = MAX_UPLOAD_BYTES
): Promise<Blob | null> {
    const original = await toBlob(canvas);
    if (!original || original.size <= maxBytes) return original;

    let scale = 0.75;
    while (Math.min(canvas.width, canvas.height) * scale >= MIN_EDGE) {
        const blob = await toBlob(downscale(canvas, scale));
        if (blob && blob.size <= maxBytes) return blob;
        scale *= 0.75;
    }

    return original;
}
