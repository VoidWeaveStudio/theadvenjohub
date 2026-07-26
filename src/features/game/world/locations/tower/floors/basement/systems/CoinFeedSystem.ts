// src/features/game/world/locations/tower/floors/basement/systems/CoinFeedSystem.ts
import * as THREE from "three";
import { tokenTextureCache } from "../../../../../../utils/TokenTextureCache";
import { createCoinMesh } from "../utils/meshFactory";
import type { Basement } from "../Basement";

export interface MemeToken {
    address: string;
    name: string;
    symbol: string;
    image: string;
    chainId?: string;
    url?: string;
}

interface ActiveCoin {
    mesh: THREE.Object3D;
    velocity: number;
    rotationSpeed: number;
}

interface OrbitData {
    mesh: THREE.Object3D;
    baseRadius: number;
    speed: number;
    phase: number;
    inclination: number;
    axis: THREE.Vector3;
    trail: {
        line: THREE.Line;
        positions: Float32Array;
    };
}

export class CoinFeedSystem {
    private activeCoins: ActiveCoin[] = [];
    private tokenQueue: MemeToken[] = [];
    private orbitData: OrbitData[] = [];

    private pollInterval: NodeJS.Timeout | null = null;
    private spawnInterval: NodeJS.Timeout | null = null;
    private clearQueueInterval: NodeJS.Timeout | null = null;

    private readonly MAX_COINS = 50;
    private readonly MAX_QUEUE_SIZE = 200;

    private textureLoader = new THREE.TextureLoader();
    private readonly TARGET_SCALE = new THREE.Vector3(1, 1, 1);

    private orbitTime = 0;

    constructor(private floor: Basement) { }

    createOrbitCoins() {
        const customLogo = this.textureLoader.load("/logo.png");
        customLogo.colorSpace = THREE.SRGBColorSpace;
        this.floor.applyTextureFilters(customLogo);

        const coins = [
            { key: "btc", url: "/crypto_logo/bitcoin.png" },
            { key: "eth", url: "/crypto_logo/ethereum.png" },
            { key: "sol", url: "/crypto_logo/solana.png" },
            { key: "bnb", url: "/crypto_logo/bnb.png" },
            { key: "xmr", url: "/crypto_logo/monero.png" },
            { key: "usdt", url: "/crypto_logo/usdt.png" },
            { texture: customLogo }
        ];

        coins.forEach((coinData: any, i) => {
            let tex: THREE.Texture;

            if (coinData.texture) {
                tex = coinData.texture;
            } else {
                tex = this.textureLoader.load(coinData.url);
            }

            tex.colorSpace = THREE.SRGBColorSpace;
            this.floor.applyTextureFilters(tex);
            tex.center.set(0.5, 0.5);
            tex.rotation = Math.PI / 2;

            const coinGroup = createCoinMesh(tex, 8.5, false, true, "gold");

            this.floor.scene.add(coinGroup);

            this.orbitData.push({
                mesh: coinGroup,
                baseRadius: 80 + i * 10,
                speed: 0.2 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                inclination: Math.random() * 0.6,
                axis: new THREE.Vector3(
                    Math.random(),
                    Math.random(),
                    Math.random()
                ).normalize(),
                trail: (coinGroup as any).trail
            });
        });
    }

    startBackgroundTasks() {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                this.startMemeCoinPoller();
                this.startCoinSpawner();
                this.startQueueClearer();
            });
        } else {
            setTimeout(() => {
                this.startMemeCoinPoller();
                this.startCoinSpawner();
                this.startQueueClearer();
            }, 100);
        }
    }

    private async pollMemeCoinsOnce() {
        try {
            const res = await fetch("/api/new-tokens");
            if (!res.ok) throw new Error("API request failed");
            const tokens: MemeToken[] = await res.json();
            for (const token of tokens) {
                if (this.tokenQueue.length >= this.MAX_QUEUE_SIZE) break;
                this.tokenQueue.push(token);
            }
        } catch (e) { }
    }

    private startMemeCoinPoller() {
        this.pollMemeCoinsOnce();
        this.pollInterval = setInterval(() => this.pollMemeCoinsOnce(), 10000);
    }

    private startCoinSpawner() {
        this.spawnInterval = setInterval(() => {
            if (this.tokenQueue.length > 0 && this.activeCoins.length < this.MAX_COINS) {
                const token = this.tokenQueue.shift()!;
                this.spawnCoin(token);
            }
        }, 500);
    }

    private startQueueClearer() {
        this.clearQueueInterval = setInterval(() => { this.tokenQueue = []; }, 300000);
    }

    private spawnCoin(token: MemeToken) {
        if (this.activeCoins.length >= this.MAX_COINS) {
            const oldCoin = this.activeCoins.shift();
            if (oldCoin) {
                this.floor.scene.remove(oldCoin.mesh);
                oldCoin.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            (child.material as THREE.Material).dispose();
                        }
                    }
                });
            }
        }

        const fallbackTexture = this.floor.textureCache.get('fallback')!;
        let finalTexture = this.floor.textureCache.get(token.image) || fallbackTexture;

        if (token.image && token.image !== 'fallback' && !this.floor.textureCache.has(token.image)) {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(token.image)}`;

            const alreadyCached = tokenTextureCache.get(proxyUrl);
            if (alreadyCached) {
                this.floor.applyTextureFilters(alreadyCached);
                this.floor.textureCache.set(token.image, alreadyCached);
                finalTexture = alreadyCached;
            } else {
                this.textureLoader.load(
                    proxyUrl,
                    (tex) => {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        this.floor.applyTextureFilters(tex);
                        this.floor.textureCache.set(token.image, tex);
                        tokenTextureCache.set(proxyUrl, tex);
                    },
                    undefined,
                    () => {
                        this.floor.textureCache.set(token.image, fallbackTexture);
                    }
                );
            }
        }

        this.floor.applyTextureFilters(finalTexture);

        const coinGroup = createCoinMesh(finalTexture, 0.4, false, false, "none");

        const spawnRadius = 2.2;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawnRadius;

        coinGroup.position.set(
            Math.cos(angle) * r,
            this.floor.HOLE_Y + 0.15,
            Math.sin(angle) * r
        );
        coinGroup.scale.set(0.1, 0.1, 0.1);

        coinGroup.castShadow = false;
        coinGroup.receiveShadow = false;

        this.floor.scene.add(coinGroup);
        this.activeCoins.push({
            mesh: coinGroup,
            velocity: -0.04,
            rotationSpeed: 0.8 + Math.random() * 0.6
        });
    }

    update(delta: number) {
        this.orbitTime += delta;

        this.orbitData.forEach((c, i) => {
            const t = this.orbitTime * 0.15 * c.speed + c.phase;

            const pos = new THREE.Vector3(
                Math.cos(t) * c.baseRadius,
                0,
                Math.sin(t) * c.baseRadius
            );

            pos.applyAxisAngle(c.axis, c.inclination);
            pos.multiplyScalar(1 + i * 0.08);

            c.mesh.position.copy(pos);
            c.mesh.rotation.y += delta * 0.4;

            if (c.trail) {
                const p = c.mesh.position;
                c.trail.positions.copyWithin(3, 0, 57);
                c.trail.positions[0] = p.x;
                c.trail.positions[1] = p.y;
                c.trail.positions[2] = p.z;

                c.trail.line.geometry.attributes.position.needsUpdate = true;
            }
        });

        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            const coin = this.activeCoins[i];

            coin.velocity -= 1 * delta;
            coin.mesh.position.y += coin.velocity * delta;

            coin.mesh.rotation.y += coin.rotationSpeed * delta;
            coin.mesh.rotation.x += coin.rotationSpeed * 0.4 * delta;

            coin.mesh.scale.lerp(this.TARGET_SCALE, 3 * delta);

            if (coin.mesh.position.y <= this.floor.SINK_Y) {
                this.floor.scene.remove(coin.mesh);
                coin.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            (child.material as THREE.Material).dispose();
                        }
                    }
                });
                this.activeCoins.splice(i, 1);
            }
        }
    }

    dispose() {
        if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
        if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
        if (this.clearQueueInterval) { clearInterval(this.clearQueueInterval); this.clearQueueInterval = null; }

        for (const c of this.orbitData) {
            this.floor.scene.remove(c.mesh);
            c.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
        }
        this.orbitData = [];

        for (const coin of this.activeCoins) {
            this.floor.scene.remove(coin.mesh);
            coin.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
        }
        this.activeCoins = [];
        this.tokenQueue = [];
    }
}
