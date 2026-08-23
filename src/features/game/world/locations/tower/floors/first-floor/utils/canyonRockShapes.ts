// src/features/game/world/locations/tower/floors/first-floor/utils/canyonRockShapes.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CanyonBiome } from "./canyonBiomes";
import { createRandom, fbm } from "./canyonNoise";

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const hit = cache.get(key);
    if (hit) return hit;

    const geometry = make();
    cache.set(key, geometry);
    return geometry;
}

export function isCanyonShapeGeometry(geometry: THREE.BufferGeometry): boolean {
    for (const entry of cache.values()) if (entry === geometry) return true;
    return false;
}

function lumpiness(x: number, y: number, z: number, seed: number): number {
    return (
        fbm(x * 1.6 + 11, y * 1.6 + 5, 3, seed) +
        fbm(y * 1.9 + 3, z * 1.9 + 17, 3, seed + 601) +
        fbm(z * 1.4 + 7, x * 1.4 + 23, 3, seed + 1279)
    ) / 3;
}

export function getBoulderGeometry(variant: number, detail: number): THREE.BufferGeometry {
    return cached(`boulder:${variant}:${detail}`, () => {
        const geometry = new THREE.IcosahedronGeometry(1, detail);
        const position = geometry.attributes.position as THREE.BufferAttribute;
        const seed = 3301 + variant * 977;

        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);
            const scale = 0.72 + lumpiness(x, y, z, seed) * 0.62;
            position.setXYZ(i, x * scale, y * scale * 0.78, z * scale);
        }

        geometry.computeVertexNormals();
        geometry.translate(0, 0.42, 0);
        return geometry;
    });
}

export function getSlabGeometry(variant: number): THREE.BufferGeometry {
    return cached(`slab:${variant}`, () => {
        const geometry = new THREE.CylinderGeometry(1, 0.86, 0.34, 7, 1);
        const position = geometry.attributes.position as THREE.BufferAttribute;
        const seed = 8123 + variant * 613;

        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);
            const scale = 0.8 + lumpiness(x, y, z, seed) * 0.45;
            position.setXYZ(i, x * scale, y + (lumpiness(z, x, y, seed) - 0.5) * 0.18, z * scale);
        }

        geometry.computeVertexNormals();
        geometry.translate(0, 0.17, 0);
        return geometry;
    });
}

export function getHoodooGeometry(variant: number): THREE.BufferGeometry {
    return cached(`hoodoo:${variant}`, () => {
        const random = createRandom(5471 + variant * 331);
        const points: THREE.Vector2[] = [];
        const segments = 11;

        let radius = 0.9;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const taper = 1 - Math.pow(t, 1.7) * 0.62;
            const waist = 1 - Math.sin(t * Math.PI * 2.4) * 0.16;
            radius = 0.95 * taper * waist * (0.88 + random() * 0.24);
            points.push(new THREE.Vector2(Math.max(0.08, radius), t * 3.4));
        }
        points.push(new THREE.Vector2(0.02, 3.62));

        const geometry = new THREE.LatheGeometry(points, 9);
        const position = geometry.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const y = position.getY(i);
            const z = position.getZ(i);
            const scale = 0.88 + lumpiness(x * 2, y * 0.8, z * 2, 4409 + variant * 101) * 0.3;
            position.setXYZ(i, x * scale, y, z * scale);
        }

        geometry.computeVertexNormals();
        return geometry;
    });
}

export interface BiomePropShapes {
    body: THREE.BufferGeometry | null;
    glow: THREE.BufferGeometry | null;
}

function transformed(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
    return geometry.clone().applyMatrix4(matrix);
}

function place(x: number, y: number, z: number, scaleX: number, scaleY: number, scaleZ: number, tilt = 0): THREE.Matrix4 {
    return new THREE.Matrix4()
        .makeTranslation(x, y, z)
        .multiply(new THREE.Matrix4().makeRotationZ(tilt))
        .multiply(new THREE.Matrix4().makeScale(scaleX, scaleY, scaleZ));
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const result = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return result ?? new THREE.BufferGeometry();
}

export function getBiomePropShapes(biome: CanyonBiome): BiomePropShapes {
    const key = `prop:${biome.propStyle}`;

    if (biome.propStyle === "cactus") {
        return {
            body: null,
            glow: cached(`${key}:glow`, () => {
                const ribbed = new THREE.CylinderGeometry(0.42, 0.5, 1, 9, 1);
                const arm = new THREE.CylinderGeometry(0.24, 0.27, 1, 8, 1);
                const elbow = new THREE.SphereGeometry(0.26, 8, 6);

                return merged([
                    transformed(ribbed, place(0, 2.1, 0, 1, 4.2, 1)),
                    transformed(arm, place(0.62, 2.5, 0, 1, 1.5, 1)),
                    transformed(elbow, place(0.62, 1.78, 0, 1, 1, 1)),
                    transformed(arm, place(0.62, 1.78, 0, 1, 0.9, 1, Math.PI / 2.4)),
                    transformed(arm, place(-0.55, 1.9, 0, 1, 1.1, 1)),
                    transformed(elbow, place(-0.55, 1.36, 0, 1, 1, 1)),
                ]);
            }),
        };
    }

    if (biome.propStyle === "ember") {
        return {
            body: cached(`${key}:body`, () => {
                const spire = new THREE.ConeGeometry(0.8, 1, 7, 1);
                const shard = new THREE.ConeGeometry(0.34, 1, 5, 1);

                return merged([
                    transformed(spire, place(0, 1.5, 0, 1, 3, 1)),
                    transformed(shard, place(0.72, 0.7, 0.3, 1, 1.4, 1, -0.35)),
                    transformed(shard, place(-0.5, 0.55, -0.4, 1, 1.1, 1, 0.28)),
                ]);
            }),
            glow: cached(`${key}:glow`, () => {
                const coal = new THREE.IcosahedronGeometry(0.3, 0);

                return merged([
                    transformed(coal, place(0.1, 0.32, 0.15, 1, 1, 1)),
                    transformed(coal, place(-0.34, 0.24, -0.2, 0.7, 0.7, 0.7)),
                    transformed(coal, place(0.36, 0.2, -0.34, 0.55, 0.55, 0.55)),
                ]);
            }),
        };
    }

    if (biome.propStyle === "ice") {
        return {
            body: null,
            glow: cached(`${key}:glow`, () => {
                const shard = new THREE.ConeGeometry(0.42, 1, 6, 1);

                return merged([
                    transformed(shard, place(0, 1.7, 0, 1, 3.4, 1)),
                    transformed(shard, place(0.55, 0.95, 0.2, 0.6, 1.9, 0.6, -0.22)),
                    transformed(shard, place(-0.48, 0.75, -0.3, 0.5, 1.5, 0.5, 0.3)),
                ]);
            }),
        };
    }

    if (biome.propStyle === "mushroom") {
        return {
            body: cached(`${key}:body`, () => {
                const stalk = new THREE.CylinderGeometry(0.16, 0.24, 1, 8, 1);

                return merged([
                    transformed(stalk, place(0, 0.75, 0, 1, 1.5, 1)),
                    transformed(stalk, place(0.45, 0.42, 0.22, 0.7, 0.85, 0.7)),
                ]);
            }),
            glow: cached(`${key}:glow`, () => {
                const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

                return merged([
                    transformed(cap, place(0, 1.5, 0, 0.78, 0.5, 0.78)),
                    transformed(cap, place(0.45, 0.85, 0.22, 0.42, 0.3, 0.42)),
                ]);
            }),
        };
    }

    return {
        body: null,
        glow: cached(`${key}:glow`, () => {
            const shard = new THREE.OctahedronGeometry(0.5, 0);

            return merged([
                transformed(shard, place(0, 1.6, 0, 0.7, 3.2, 0.7)),
                transformed(shard, place(0.5, 0.9, 0.25, 0.45, 1.7, 0.45, -0.4)),
                transformed(shard, place(-0.42, 0.7, -0.3, 0.35, 1.3, 0.35, 0.5)),
            ]);
        }),
    };
}
