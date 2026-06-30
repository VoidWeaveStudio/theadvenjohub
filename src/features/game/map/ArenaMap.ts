// src/features/game/map/maps/ArenaMap.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GameMap } from './GameMap';
import { MapConfig, CollisionBox3D } from './types';


export class ArenaMap extends GameMap {
    private animatedObjects: Array<{
        mesh: THREE.Object3D;
        update: (t: number, dt: number) => void;
    }> = [];

    protected buildTerrain(): void {
        const { terrain, collisions } = this.config;

        this.buildGround(terrain);

        this.buildSolidMeshes(collisions.solid);

        this.buildBoundaries(collisions.boundaries);

        if (collisions.water?.length) {
            this.buildWater(collisions.water);
        }

        this.buildZoneMarkers();
    }

    protected onUpdate(_dt: number, elapsedTime: number): void {
        for (const obj of this.animatedObjects) {
            obj.update(elapsedTime, _dt);
        }
    }

    private buildGround(terrain: MapConfig['terrain']): void {
        const { bounds } = terrain;
        const width = bounds.maxX - bounds.minX;
        const depth = bounds.maxZ - bounds.minZ;

        const groundGeo = new THREE.PlaneGeometry(width, depth, 16, 16);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = terrain.groundLevel;
        ground.receiveShadow = true;
        ground.name = 'ground';

        this.terrainGroup.add(ground);
    }


    private buildSolidMeshes(solids: CollisionBox3D[]): void {
        const byMaterial = new Map<string, {
            geometries: THREE.BufferGeometry[];
            color: number;
            roughness: number;
            metalness: number;
        }>();

        for (const box of solids) {
            const matType = box.properties?.material ?? 'stone';
            const materialProps = MATERIAL_PRESETS[matType];

            let group = byMaterial.get(matType);
            if (!group) {
                group = { geometries: [], ...materialProps };
                byMaterial.set(matType, group);
            }

            const width = box.maxX - box.minX;
            const height = box.maxY - box.minY;
            const depth = box.maxZ - box.minZ;

            const geo = new THREE.BoxGeometry(width, height, depth);
            geo.translate(
                (box.minX + box.maxX) / 2,
                (box.minY + box.maxY) / 2,
                (box.minZ + box.maxZ) / 2,
            );

            group.geometries.push(geo);
        }

        for (const [matType, group] of byMaterial) {
            if (group.geometries.length === 0) continue;

            const merged = mergeGeometries(group.geometries, false);
            if (!merged) continue;

            const material = new THREE.MeshStandardMaterial({
                color: group.color,
                roughness: group.roughness,
                metalness: group.metalness,
                flatShading: true,
            });

            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = `solid_${matType}`;

            this.terrainGroup.add(mesh);

            group.geometries.forEach(g => g.dispose());
        }
    }

    private buildBoundaries(boundaries: CollisionBox3D[]): void {
        for (const b of boundaries) {
            const width = b.maxX - b.minX;
            const height = b.maxY - b.minY;
            const depth = b.maxZ - b.minZ;

            const geo = new THREE.BoxGeometry(width, height, depth);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.05,
                side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (b.minX + b.maxX) / 2,
                (b.minY + b.maxY) / 2,
                (b.minZ + b.maxZ) / 2,
            );
            mesh.visible = false; 
            mesh.name = 'boundary';

            this.terrainGroup.add(mesh);
        }
    }

    private buildWater(boxes: CollisionBox3D[]): void {
        for (const box of boxes) {
            const width = box.maxX - box.minX;
            const depth = box.maxZ - box.minZ;

            const geo = new THREE.PlaneGeometry(width, depth, 16, 16);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.6,
                roughness: 0.1,
                metalness: 0.3,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(
                (box.minX + box.maxX) / 2,
                box.maxY,
                (box.minZ + box.maxZ) / 2,
            );
            mesh.receiveShadow = true;
            mesh.name = 'water';

            this.animatedObjects.push({
                mesh,
                update: (t) => {
                    mesh.position.y = box.maxY + Math.sin(t * 1.5) * 0.05;
                },
            });

            this.terrainGroup.add(mesh);
        }
    }

    private buildZoneMarkers(): void {

    }
}

const MATERIAL_PRESETS: Record<string, { color: number; roughness: number; metalness: number }> = {
    stone: { color: 0x8b8680, roughness: 0.9, metalness: 0.1 },
    wood: { color: 0x8b6f47, roughness: 0.7, metalness: 0.0 },
    metal: { color: 0x909090, roughness: 0.3, metalness: 0.8 },
    concrete: { color: 0xa0a090, roughness: 0.95, metalness: 0.05 },
    brick: { color: 0xb0604a, roughness: 0.8, metalness: 0.1 },
    sand: { color: 0xd4b896, roughness: 1.0, metalness: 0.0 },
};