// src/features/game/map/maps/dust2.config.ts
import { MapConfig } from './types';

export const DUST2_CONFIG: MapConfig = {
    id: 'dust2',
    name: 'Dust II',
    description: 'Классическая арена в пустыне',
    compatibleModes: ['5v5', 'ffa'],

    terrain: {
        type: 'procedural',
        bounds: { minX: -70, maxX: 70, minZ: -65, maxZ: 65 },
        groundLevel: 0,
    },

    collisions: {
        solid: [
            { minX: -26, maxX: -24, minY: 0, maxY: 5, minZ: -60, maxZ: -40, properties: { material: 'brick' } },
            { minX: 24, maxX: 26, minY: 0, maxY: 5, minZ: -60, maxZ: -40, properties: { material: 'brick' } },
            { minX: -25, maxX: 25, minY: 0, maxY: 5, minZ: -61, maxZ: -59, properties: { material: 'brick' } },
            
            { minX: -21, maxX: -19, minY: 0, maxY: 2, minZ: -56, maxZ: -54, properties: { material: 'wood' } },
            { minX: 19, maxX: 21, minY: 0, maxY: 2, minZ: -56, maxZ: -54, properties: { material: 'wood' } },

            { minX: -36, maxX: -34, minY: 0, maxY: 5, minZ: -30, maxZ: 0, properties: { material: 'stone' } },
            { minX: -26, maxX: -24, minY: 0, maxY: 5, minZ: -30, maxZ: 0, properties: { material: 'stone' } },

            { minX: -19, maxX: -17, minY: 0, maxY: 5, minZ: -25, maxZ: 5, properties: { material: 'stone' } },
            { minX: 17, maxX: 19, minY: 0, maxY: 5, minZ: -25, maxZ: 5, properties: { material: 'stone' } },

            { minX: 34, maxX: 36, minY: 0, maxY: 5, minZ: -30, maxZ: 0, properties: { material: 'stone' } },
            { minX: 24, maxX: 26, minY: 0, maxY: 5, minZ: -30, maxZ: 0, properties: { material: 'stone' } },

            { minX: -55, maxX: -35, minY: 0, maxY: 5, minZ: 24, maxZ: 26, properties: { material: 'stone' } },
            { minX: -55, maxX: -35, minY: 0, maxY: 5, minZ: 44, maxZ: 46, properties: { material: 'stone' } },
            { minX: -56, maxX: -54, minY: 0, maxY: 5, minZ: 25, maxZ: 45, properties: { material: 'stone' } },

            { minX: 35, maxX: 55, minY: 0, maxY: 5, minZ: 24, maxZ: 26, properties: { material: 'stone' } },
            { minX: 35, maxX: 55, minY: 0, maxY: 5, minZ: 44, maxZ: 46, properties: { material: 'stone' } },
            { minX: 54, maxX: 56, minY: 0, maxY: 5, minZ: 25, maxZ: 45, properties: { material: 'stone' } },

            { minX: -16, maxX: -14, minY: 0, maxY: 5, minZ: 47, maxZ: 63, properties: { material: 'brick' } },
            { minX: 14, maxX: 16, minY: 0, maxY: 5, minZ: 47, maxZ: 63, properties: { material: 'brick' } },
        ],
        boundaries: [
            { minX: -71, maxX: -69, minY: 0, maxY: 8, minZ: -65, maxZ: 65 },
            { minX: 69, maxX: 71, minY: 0, maxY: 8, minZ: -65, maxZ: 65 },
            { minX: -70, maxX: 70, minY: 0, maxY: 8, minZ: -66, maxZ: -64 },
            { minX: -70, maxX: 70, minY: 0, maxY: 8, minZ: 64, maxZ: 66 },
        ],
        water: [],
        hazard: [],
        trigger: [
            {
                triggerId: 'site_a',
                minX: -55, maxX: -35, minY: 0, maxY: 5, minZ: 25, maxZ: 45,
                onEnter: 'player_entered_site_a',
            },
            {
                triggerId: 'site_b',
                minX: 35, maxX: 55, minY: 0, maxY: 5, minZ: 25, maxZ: 45,
                onEnter: 'player_entered_site_b',
            },
        ],
    },

    spawnPoints: {
        team1: [
            { x: -20, y: 0, z: -50 },
            { x: -15, y: 0, z: -50 },
            { x: -25, y: 0, z: -50 },
        ],
        team2: [
            { x: 20, y: 0, z: 55 },
            { x: 15, y: 0, z: 55 },
            { x: 25, y: 0, z: 55 },
        ],
        ffa: [
            { x: 0, y: 0, z: -45 },
            { x: -30, y: 0, z: -30 },
            { x: 30, y: 0, z: -30 },
            { x: 0, y: 0, z: 30 },
        ],
    },

    metadata: {
        ambientLight: 0xfff5e0,
        fog: { color: 0xe0d0a0, near: 30, far: 120 },
        weather: 'clear',
    },
};