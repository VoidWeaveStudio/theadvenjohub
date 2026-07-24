//src\features\game\systems\LootSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { LootDrop } from "../entities/LootDrop";
import { NetworkManager, LootDropData } from "../network/NetworkManager";
import { tokenTextureCache } from "../utils/TokenTextureCache";

const WARMUP_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export class LootSystem extends System {
    private scene!: THREE.Scene;
    private network!: NetworkManager;
    private player!: Player;
    private getGroundHeight!: (x: number, z: number) => number;
    private drops: Map<string, LootDrop> = new Map();
    private pickupAttempts: Map<string, number> = new Map();

    private readonly PICKUP_RADIUS = 3;
    private readonly PICKUP_RETRY_MS = 500;

    private warmupDrop: LootDrop | null = null;

    init(scene: THREE.Scene, network: NetworkManager, player: Player, getGroundHeight: (x: number, z: number) => number) {
        this.scene = scene;
        this.network = network;
        this.player = player;
        this.getGroundHeight = getGroundHeight;
    }

    public setScene(scene: THREE.Scene) {
        this.scene = scene;
    }

    public prewarm(): Promise<void> {
        this.warmupDrop = new LootDrop("__warmup__", [
            { address: "", name: "", symbol: "", image: WARMUP_PIXEL },
        ]);
        this.warmupDrop.mesh.position.set(0, -500, 0);
        this.scene.add(this.warmupDrop.mesh);

        return new Promise((resolve) => {
            tokenTextureCache.load(WARMUP_PIXEL, () => resolve());
        });
    }

    public endPrewarm() {
        if (!this.warmupDrop) return;
        this.warmupDrop.dispose(this.scene);
        this.warmupDrop = null;
    }

    public async preloadTokenTextures() {
        try {
            const res = await fetch("/api/new-tokens");
            const tokens = await res.json();
            if (Array.isArray(tokens)) {
                tokenTextureCache.preload(
                    tokens
                        .map((t: any) => t.image)
                        .filter(Boolean)
                        .map((image: string) => `/api/image-proxy?url=${encodeURIComponent(image)}`)
                );
            }
        } catch (e) { }
    }

    private spawnLocal(data: LootDropData) {
        if (this.drops.has(data.id)) return;
        const drop = new LootDrop(data.id, data.tokens);
        drop.mesh.position.set(data.position[0], data.position[1], data.position[2]);
        this.scene.add(drop.mesh);
        this.drops.set(data.id, drop);
    }

    private despawnLocal(id: string) {
        const drop = this.drops.get(id);
        if (!drop) return;
        drop.dispose(this.scene);
        this.drops.delete(id);
        this.pickupAttempts.delete(id);
    }

    public handleLootState(list: LootDropData[]) {
        const seen = new Set<string>();
        for (const data of list) {
            seen.add(data.id);
            this.spawnLocal(data);
        }
        for (const id of Array.from(this.drops.keys())) {
            if (!seen.has(id)) this.despawnLocal(id);
        }
    }

    public handleLootSpawn(data: LootDropData) {
        this.spawnLocal(data);
    }

    public handleLootDespawn(id: string) {
        this.despawnLocal(id);
    }

    public update(delta: number) {
        const playerPos = this.player.mesh.position;

        for (const [id, drop] of this.drops) {
            drop.update(delta, this.getGroundHeight);

            if (drop.mesh.position.distanceTo(playerPos) <= this.PICKUP_RADIUS) {
                const now = Date.now();
                const lastAttempt = this.pickupAttempts.get(id) || 0;
                if (now - lastAttempt >= this.PICKUP_RETRY_MS) {
                    this.pickupAttempts.set(id, now);
                    this.network.sendLootPickup(id);
                }
            }
        }
    }

    public clear() {
        for (const id of Array.from(this.drops.keys())) {
            this.despawnLocal(id);
        }
    }

    dispose() {
        this.clear();
    }
}
