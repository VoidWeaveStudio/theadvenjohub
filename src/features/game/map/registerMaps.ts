//src\features\game\map\registerMaps.ts
import { MapRegistry } from './MapFactory';
import { ArenaMap } from './ArenaMap';
import { DUST2_CONFIG } from './dust2.config';

export function registerAllMaps(): void {
    MapRegistry.registerMap(DUST2_CONFIG, ArenaMap);
    

    MapRegistry.setDefaultMapForMode('5v5', 'dust2');
    MapRegistry.setDefaultMapForMode('ffa', 'dust2');
    
    console.log(`🗺️ Registered ${MapRegistry.getAllMaps().length} maps`);
}