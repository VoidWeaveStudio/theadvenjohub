// src/features/game/map/MapFactory.ts
import * as THREE from 'three';
import { GameMap } from './GameMap';
import { MapConfig, MapId, GameModeId } from './types';

type MapConstructor = new (scene: THREE.Scene, config: MapConfig) => GameMap;


export class MapRegistry {
    private static configs = new Map<MapId, MapConfig>();
    private static constructors = new Map<MapId, MapConstructor>();
    private static modeToMap = new Map<GameModeId, MapId>();

    static registerMap(config: MapConfig, ctor: MapConstructor): void {
        this.configs.set(config.id, config);
        this.constructors.set(config.id, ctor);
        
        for (const modeId of config.compatibleModes) {
            if (!this.modeToMap.has(modeId)) {
                this.modeToMap.set(modeId, config.id);
            }
        }
        
        console.log(`🗺️ Registered map: ${config.id} (${config.compatibleModes.join(', ')})`);
    }

    static setDefaultMapForMode(modeId: GameModeId, mapId: MapId): void {
        this.modeToMap.set(modeId, mapId);
    }

    static getConfig(mapId: MapId): MapConfig | undefined {
        return this.configs.get(mapId);
    }

    static getMapForMode(modeId: GameModeId): MapId | undefined {
        return this.modeToMap.get(modeId);
    }

    static createMap(mapId: MapId, scene: THREE.Scene): GameMap | null {
        const config = this.configs.get(mapId);
        const ctor = this.constructors.get(mapId);
        
        if (!config || !ctor) {
            console.error(`❌ Map "${mapId}" not registered`);
            return null;
        }

        return new ctor(scene, config);
    }

    static createMapForMode(modeId: GameModeId, scene: THREE.Scene): GameMap | null {
        const mapId = this.modeToMap.get(modeId);
        if (!mapId) {
            console.error(`❌ No map registered for mode "${modeId}"`);
            return null;
        }
        return this.createMap(mapId, scene);
    }

    static getAllMaps(): MapConfig[] {
        return Array.from(this.configs.values());
    }

    static getMapsForMode(modeId: GameModeId): MapConfig[] {
        return Array.from(this.configs.values())
            .filter(c => c.compatibleModes.includes(modeId));
    }
}