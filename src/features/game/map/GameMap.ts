// src/features/game/map/GameMap.ts
import * as THREE from 'three';
import { MapConfig, CollisionBox3D, SpawnPointsConfig } from './types';
import { CollisionSystem } from './CollisionSystem';

export abstract class GameMap {
    protected readonly config: MapConfig;
    protected readonly scene: THREE.Scene;
    protected readonly collisionSystem: CollisionSystem;
    
    protected terrainGroup: THREE.Group;
    protected interactablesGroup: THREE.Group;
    protected disposed = false;

    constructor(scene: THREE.Scene, config: MapConfig) {
        this.scene = scene;
        this.config = config;
        this.collisionSystem = new CollisionSystem();
        this.terrainGroup = new THREE.Group();
        this.terrainGroup.name = `terrain_${config.id}`;
        this.interactablesGroup = new THREE.Group();
        this.interactablesGroup.name = `interactables_${config.id}`;
        
        this.scene.add(this.terrainGroup);
        this.scene.add(this.interactablesGroup);
    }

    build(): void {
        if (this.disposed) return;
        
        this.buildTerrain();
        
        this.registerCollisions();
        
        this.placeInteractables();
        
        console.log(`🗺️ Map "${this.config.id}" built: ${this.collisionSystem.stats()}`);
    }

    update(deltaTime: number, elapsedTime: number): void {
        if (this.disposed) return;
        this.onUpdate(deltaTime, elapsedTime);
    }

    protected abstract buildTerrain(): void;
    protected onUpdate(deltaTime: number, elapsedTime: number): void { }

    protected registerCollisions(): void {
        const { solid, water, hazard, trigger, boundaries } = this.config.collisions;
        
        solid.forEach(box => this.collisionSystem.addSolid(box));
        water?.forEach(box => this.collisionSystem.addWater(box));
        hazard?.forEach(box => this.collisionSystem.addHazard(box));
        trigger?.forEach(box => this.collisionSystem.addTrigger(box));
        boundaries.forEach(box => this.collisionSystem.addBoundary(box));
    }

    protected placeInteractables(): void {
        const interactables = this.config.interactables ?? [];
        for (const obj of interactables) {
            this.createInteractable(obj);
        }
    }

    protected createInteractable(config: any): void {
    }


    getCollisions(): CollisionSystem {
        return this.collisionSystem;
    }

    getSpawnPoints(teamId: string = 'default'): Array<{ x: number; y: number; z: number; yaw?: number }> {
        const points = this.config.spawnPoints[teamId] ?? this.config.spawnPoints['default'] ?? [];
        return [...points].sort(() => Math.random() - 0.5);
    }

    getSafeSpawnPoint(teamId: string = 'default'): { x: number; y: number; z: number; yaw?: number } | null {
        const points = this.getSpawnPoints(teamId);
        for (const point of points) {
            if (!this.collisionSystem.checkCollision3D(point.x, point.y, point.z, 0.5)) {
                return point;
            }
        }
        return points[0] ?? null;
    }

    getConfig(): MapConfig {
        return this.config;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        this.scene.remove(this.terrainGroup);
        this.scene.remove(this.interactablesGroup);

        const disposeGroup = (group: THREE.Group) => {
            group.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry?.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material?.dispose();
                    }
                } else if (obj instanceof THREE.Points) {
                    obj.geometry?.dispose();
                    (obj.material as THREE.Material)?.dispose();
                }
            });
        };

        disposeGroup(this.terrainGroup);
        disposeGroup(this.interactablesGroup);
        
        this.collisionSystem.clear();
    }
}