// src/features/game/systems/LootSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { LootDrop } from "../entities/LootDrop";
import { DeathCrate } from "../entities/DeathCrate";
import { NetworkManager, LootDropData, DeathCrateData } from "../network/NetworkManager";
import { SoundManager } from "../core/SoundManager";
import { tokenTextureCache } from "../utils/TokenTextureCache";
import { fetchJsonShared } from "../utils/apiCache";
import type { InteractionSystem } from "./InteractionSystem";

const WARMUP_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export class LootSystem extends System {
    private scene!: THREE.Scene;
    private network!: NetworkManager;
    private player!: Player;
    private getGroundHeight!: (x: number, z: number) => number;
    private drops: Map<string, LootDrop> = new Map();
    private crates: Map<string, DeathCrate> = new Map();
    private interactions: InteractionSystem | null = null;
    private pickupAttempts: Map<string, number> = new Map();

    private readonly PICKUP_RADIUS = 3;
    private readonly PICKUP_RETRY_MS = 500;

    private warmupDrop: LootDrop | null = null;

    init(
        scene: THREE.Scene,
        network: NetworkManager,
        player: Player,
        getGroundHeight: (x: number, z: number) => number,
        interactions: InteractionSystem
    ) {
        this.scene = scene;
        this.network = network;
        this.player = player;
        this.getGroundHeight = getGroundHeight;
        this.interactions = interactions;
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
            const tokens = await fetchJsonShared<unknown>("/api/new-tokens");
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

        if (this.pickupAttempts.has(id)) {
            SoundManager.getInstance().play("loot-pickup", { volume: 0.5, rate: 0.95 + Math.random() * 0.2 });
        }

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

    private spawnCrate(data: DeathCrateData) {
        const existing = this.crates.get(data.id);
        if (existing) {
            existing.setPosition(data.position);
            return;
        }

        const crate = new DeathCrate(data.id);
        crate.setPosition(data.position);
        this.scene.add(crate.mesh);
        this.crates.set(data.id, crate);
        this.interactions?.registerInteractable(crate.anchor);
    }

    private despawnCrate(id: string) {
        const crate = this.crates.get(id);
        if (!crate) return;

        this.interactions?.removeInteractable(crate.anchor);
        crate.dispose(this.scene);
        this.crates.delete(id);
    }

    public handleCrateState(list: DeathCrateData[]) {
        const seen = new Set<string>();
        for (const data of list) {
            seen.add(data.id);
            this.spawnCrate(data);
        }
        for (const id of Array.from(this.crates.keys())) {
            if (!seen.has(id)) this.despawnCrate(id);
        }
    }

    public handleCrateSpawn(data: DeathCrateData) {
        this.spawnCrate(data);
    }

    public handleCrateDespawn(id: string) {
        this.despawnCrate(id);
    }

    public update(delta: number) {
        const playerPos = this.player.mesh.position;

        for (const crate of this.crates.values()) {
            crate.update(delta, this.getGroundHeight);
        }

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
        for (const id of Array.from(this.crates.keys())) {
            this.despawnCrate(id);
        }
    }

    dispose() {
        this.clear();
    }
}
