//src\features\game\systems\EnemySystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Enemy } from "../entities/Enemy";
import { NetworkManager, EnemyNetData } from "../network/NetworkManager";

export class EnemySystem extends System {
    private scene!: THREE.Scene;
    private network!: NetworkManager;
    private getGroundHeight!: (x: number, z: number) => number;
    private enemies: Map<string, Enemy> = new Map();
    private pendingSyncResolvers: (() => void)[] = [];

    public onEnemySpawn?: (id: string, hitbox: THREE.Mesh) => void;
    public onEnemyDespawn?: (id: string) => void;
    public onEnemyEliminated?: (killerId: string) => void;

    init(scene: THREE.Scene, network: NetworkManager, getGroundHeight: (x: number, z: number) => number) {
        this.scene = scene;
        this.network = network;
        this.getGroundHeight = getGroundHeight;
    }

    public setScene(scene: THREE.Scene) {
        this.scene = scene;
    }

    public getEnemy(id: string): Enemy | undefined {
        return this.enemies.get(id);
    }

    public waitForInitialSync(timeoutMs = 3000): Promise<void> {
        return new Promise((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) return;
                resolved = true;
                resolve();
            };
            this.pendingSyncResolvers.push(done);
            setTimeout(done, timeoutMs);
        });
    }

    private spawnLocal(data: EnemyNetData) {
        const enemy = new Enemy(data.id);
        enemy.mesh.position.set(data.position[0], data.position[1], data.position[2]);
        this.scene.add(enemy.mesh);
        this.enemies.set(data.id, enemy);
        enemy.updateFromNetwork(data);
        this.onEnemySpawn?.(data.id, enemy.getHitbox());
    }

    private despawnLocal(id: string) {
        const enemy = this.enemies.get(id);
        if (!enemy) return;
        this.onEnemyDespawn?.(id);
        this.scene.remove(enemy.mesh);
        this.enemies.delete(id);
    }

    public handleEnemyState(list: EnemyNetData[]) {
        const seen = new Set<string>();

        for (const data of list) {
            seen.add(data.id);
            if (!data.alive) continue;

            const existing = this.enemies.get(data.id);
            if (existing) {
                existing.updateFromNetwork(data);
            } else {
                this.spawnLocal(data);
            }
        }

        for (const id of Array.from(this.enemies.keys())) {
            if (!seen.has(id)) {
                this.despawnLocal(id);
            }
        }

        const resolvers = this.pendingSyncResolvers;
        this.pendingSyncResolvers = [];
        resolvers.forEach((resolve) => resolve());
    }

    public handleEnemyDamaged(data: { id: string; health: number }) {
        const enemy = this.enemies.get(data.id);
        if (!enemy) return;
        enemy.health = data.health;
        enemy.flashHit();
    }

    public handleEnemyAttack(id: string) {
        this.enemies.get(id)?.triggerAttack();
    }

    public handleEnemyDeath(data: { id: string; killerId: string }) {
        this.despawnLocal(data.id);
        this.onEnemyEliminated?.(data.killerId);
    }

    public handleEnemyRespawn(data: { id: string; position: number[]; health: number; maxHealth: number }) {
        if (this.enemies.has(data.id)) return;
        this.spawnLocal({ ...data, alive: true, targetId: null });
    }

    public update(delta: number) {
        for (const enemy of this.enemies.values()) {
            enemy.update(delta, this.getGroundHeight);
        }
    }

    public clear() {
        for (const id of Array.from(this.enemies.keys())) {
            this.despawnLocal(id);
        }
    }

    dispose() {
        this.clear();
    }
}
