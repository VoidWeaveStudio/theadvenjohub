//src\features\game\systems\EnemySystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { NetworkManager } from "../network/NetworkManager";

export class EnemySystem extends System {
    private scene!: THREE.Scene;
    private player!: Player;
    private network!: NetworkManager;
    private enemies: Map<string, Enemy> = new Map();
    private nextEnemyId: number = 0;
    private getGroundHeight!: (x: number, z: number) => number;

    public onPlayerDamaged?: (damage: number, attackerId: string) => void;
    public onEnemySpawn?: (id: string, hitbox: THREE.Mesh) => void;
    public onEnemyDespawn?: (id: string) => void;

    init(scene: THREE.Scene, player: Player, network: NetworkManager, getGroundHeight: (x: number, z: number) => number) {
        this.scene = scene;
        this.player = player;
        this.network = network;
        this.getGroundHeight = getGroundHeight;
    }

    public spawnEnemy(position: THREE.Vector3): Enemy {
        const id = `enemy-${this.nextEnemyId++}`;
        const enemy = new Enemy(id);
        enemy.mesh.position.copy(position);
        this.scene.add(enemy.mesh);
        this.enemies.set(id, enemy);
        
        if (this.onEnemySpawn) {
            this.onEnemySpawn(id, enemy.getHitbox());
        }
        
        return enemy;
    }

    public getEnemy(id: string): Enemy | undefined {
        return this.enemies.get(id);
    }

    public removeEnemy(id: string) {
        const enemy = this.enemies.get(id);
        if (enemy) {
            if (this.onEnemyDespawn) {
                this.onEnemyDespawn(id);
            }
            this.scene.remove(enemy.mesh);
            this.enemies.delete(id);
        }
    }

    public update(delta: number) {
        const playerPos = this.player.mesh.position;

        for (const [id, enemy] of this.enemies) {
            if (enemy.isDead()) {
                this.removeEnemy(id);
                continue;
            }

            enemy.update(delta, playerPos, this.getGroundHeight, (damage) => {
                if (this.onPlayerDamaged) {
                    this.onPlayerDamaged(damage, id);
                }
            });
        }
    }

    public clear() {
        for (const [id, enemy] of this.enemies) {
            if (this.onEnemyDespawn) {
                this.onEnemyDespawn(id);
            }
            this.scene.remove(enemy.mesh);
        }
        this.enemies.clear();
        this.nextEnemyId = 0;
    }

    dispose() {
        this.clear();
    }
}