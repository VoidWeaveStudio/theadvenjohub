// src/features/game/utils/TokenTextureCache.ts
import * as THREE from "three";

const MAX_TEXTURE_SIZE = 128;

class TokenTextureCache {
    private cache = new Map<string, THREE.Texture>();
    private loader = new THREE.TextureLoader();
    private listeners = new Map<string, Array<(tex: THREE.Texture) => void>>();

    get(url: string): THREE.Texture | undefined {
        return this.cache.get(url);
    }

    set(url: string, texture: THREE.Texture): void {
        if (url && !this.cache.has(url)) {
            this.cache.set(url, texture);
        }
    }

    load(url: string, onReady: (tex: THREE.Texture) => void): void {
        if (!url) return;

        const cached = this.cache.get(url);
        if (cached) {
            onReady(cached);
            return;
        }

        const existing = this.listeners.get(url);
        if (existing) {
            existing.push(onReady);
            return;
        }

        this.listeners.set(url, [onReady]);
        this.loadResized(url);
    }

    private resolve(url: string, tex: THREE.Texture) {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.cache.set(url, tex);
        const waiters = this.listeners.get(url) || [];
        this.listeners.delete(url);
        waiters.forEach((cb) => cb(tex));
    }

    private loadFallback(url: string) {
        this.loader.load(
            url,
            (tex) => this.resolve(url, tex),
            undefined,
            () => this.listeners.delete(url)
        );
    }

    private async loadResized(url: string): Promise<void> {
        if (typeof createImageBitmap !== "function") {
            this.loadFallback(url);
            return;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
            const blob = await res.blob();
            const bitmap = await createImageBitmap(blob, {
                resizeWidth: MAX_TEXTURE_SIZE,
                resizeHeight: MAX_TEXTURE_SIZE,
                resizeQuality: "medium",
            });

            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
            bitmap.close();

            this.resolve(url, new THREE.CanvasTexture(canvas));
        } catch {
            this.loadFallback(url);
        }
    }

    preload(urls: (string | undefined | null)[]): void {
        for (const url of urls) {
            if (url && !this.cache.has(url) && !this.listeners.has(url)) {
                this.load(url, () => { });
            }
        }
    }
}

export const tokenTextureCache = new TokenTextureCache();
