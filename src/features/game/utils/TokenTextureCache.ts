//src\features\game\utils\TokenTextureCache.ts
import * as THREE from "three";

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
        this.loader.load(
            url,
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                this.cache.set(url, tex);
                const waiters = this.listeners.get(url) || [];
                this.listeners.delete(url);
                waiters.forEach((cb) => cb(tex));
            },
            undefined,
            () => {
                this.listeners.delete(url);
            }
        );
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
