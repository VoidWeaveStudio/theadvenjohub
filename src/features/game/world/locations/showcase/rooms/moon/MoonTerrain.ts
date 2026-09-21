// src/features/game/world/locations/showcase/rooms/moon/MoonTerrain.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import type { MoonSurfaceTextures } from "./moonTextures";

export interface FlatZone {
    x: number;
    z: number;
    radius: number;
    feather: number;
}

interface Crater {
    x: number;
    z: number;
    radius: number;
    depth: number;
    rim: number;
    reach: number;
}

const OUTER_RADIUS = 240;
const RINGS = 74;
const SEGMENTS = 160;
const RIDGE_START = 150;

const SPLAT_COMMON = /* glsl */`
    uniform sampler2D uDustMap;
    uniform sampler2D uDustNor;
    uniform sampler2D uRockMap;
    uniform sampler2D uRockNor;
    uniform sampler2D uBasaltMap;
    uniform sampler2D uBasaltNor;
    uniform vec3 uTiling;
    uniform vec3 uRoughness;

    varying vec3 vGroundPos;
    varying vec3 vGeoNormal;

    vec3 moonWeights() {
        float slope = 1.0 - clamp(vGeoNormal.y, 0.0, 1.0);
        float rock = smoothstep(0.08, 0.34, slope);
        float basalt = (1.0 - rock) * smoothstep(-0.4, -2.6, vGroundPos.y);
        float dust = max(0.0, 1.0 - rock - basalt);
        float total = max(0.0001, rock + basalt + dust);
        return vec3(dust, rock, basalt) / total;
    }

    vec3 detailSample(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).rgb;
        vec3 far = texture2D(tex, uv * 0.1873).rgb;
        return near * (0.6 + far * 0.8);
    }

    vec3 detailNormal(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).xyz * 2.0 - 1.0;
        vec3 far = texture2D(tex, uv * 0.1873).xyz * 2.0 - 1.0;
        return normalize(vec3(near.xy + far.xy * 0.5, near.z));
    }
`;

export class MoonTerrain {
    private readonly craters: Crater[] = [];
    private readonly zones: FlatZone[] = [];
    private mesh: THREE.Mesh | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        zones: FlatZone[]
    ) {
        this.zones = zones;
        this.seedCraters();
    }

    private seedCraters() {
        for (let i = 0; i < 46; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 34 + Math.sqrt(this.random()) * 180;
            const radius = 6 + this.random() * 26;
            this.craters.push({
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                radius,
                depth: radius * (0.16 + this.random() * 0.14),
                rim: radius * (0.05 + this.random() * 0.07),
                reach: (radius * 1.45) * (radius * 1.45),
            });
        }

        for (let i = 0; i < 70; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 20 + Math.sqrt(this.random()) * 190;
            const radius = 1.6 + this.random() * 4.4;
            this.craters.push({
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                radius,
                depth: radius * (0.2 + this.random() * 0.16),
                rim: radius * 0.1,
                reach: (radius * 1.45) * (radius * 1.45),
            });
        }
    }

    private flatness(x: number, z: number): number {
        let value = 1;
        for (const zone of this.zones) {
            const distance = Math.hypot(x - zone.x, z - zone.z);
            const mask = THREE.MathUtils.smoothstep(distance, zone.radius, zone.radius + zone.feather);
            value = Math.min(value, mask);
        }
        return value;
    }

    public heightAt(x: number, z: number): number {
        const flat = this.flatness(x, z);
        if (flat <= 0.0005) return 0;

        let height =
            Math.sin(x * 0.031 + 1.7) * Math.cos(z * 0.027 - 0.9) * 1.7 +
            Math.sin(x * 0.071 - 2.3) * Math.cos(z * 0.063 + 1.1) * 0.72 +
            Math.sin(x * 0.153 + 0.4) * Math.cos(z * 0.147 - 2.1) * 0.26;

        for (const crater of this.craters) {
            const dx = x - crater.x;
            const dz = z - crater.z;
            const squared = dx * dx + dz * dz;
            if (squared > crater.reach) continue;

            const d = Math.sqrt(squared) / crater.radius;
            if (d < 1) height -= crater.depth * (1 - d * d) * (1.25 - d * 0.35);
            const rimOffset = (d - 1) * 3.1;
            height += crater.rim * Math.exp(-rimOffset * rimOffset);
        }

        const radial = Math.hypot(x, z);
        if (radial > RIDGE_START) {
            const t = (radial - RIDGE_START) / (OUTER_RADIUS - RIDGE_START);
            const ridge = Math.sin(Math.atan2(z, x) * 5.3 + 1.2) * 0.5 + 0.5;
            height += t * t * (12 + ridge * 26);
        }

        return height * flat;
    }

    public create(textures: MoonSurfaceTextures, simple: boolean) {
        const geometry = this.bin.geometry(this.buildGeometry());

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map: textures.dust.map,
            normalMap: textures.dust.normal,
            color: 0xb4b0a8,
            roughness: 0.99,
            metalness: 0.02,
        }));
        material.normalScale.set(1.25, 1.25);

        if (simple) {
            material.map!.repeat.set(0.35, 0.35);
            material.normalMap!.repeat.set(0.35, 0.35);
        } else {
            this.patch(material, textures);
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.renderOrder = 0;
        this.scene.add(mesh);
        this.mesh = mesh;
    }

    private buildGeometry(): THREE.BufferGeometry {
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        positions.push(0, this.heightAt(0, 0), 0);
        uvs.push(0.5, 0.5);

        for (let r = 1; r <= RINGS; r++) {
            const radius = OUTER_RADIUS * Math.pow(r / RINGS, 1.55);
            for (let s = 0; s < SEGMENTS; s++) {
                const angle = (s / SEGMENTS) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                positions.push(x, this.heightAt(x, z), z);
                uvs.push(x / (OUTER_RADIUS * 2) + 0.5, z / (OUTER_RADIUS * 2) + 0.5);
            }
        }

        for (let s = 0; s < SEGMENTS; s++) {
            const next = (s + 1) % SEGMENTS;
            indices.push(0, 1 + next, 1 + s);
        }

        for (let r = 1; r < RINGS; r++) {
            const inner = 1 + (r - 1) * SEGMENTS;
            const outer = 1 + r * SEGMENTS;
            for (let s = 0; s < SEGMENTS; s++) {
                const next = (s + 1) % SEGMENTS;
                indices.push(inner + s, outer + next, outer + s);
                indices.push(inner + s, inner + next, outer + next);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        return geometry;
    }

    private patch(material: THREE.MeshStandardMaterial, textures: MoonSurfaceTextures) {
        const uniforms = {
            uDustMap: { value: textures.dust.map },
            uDustNor: { value: textures.dust.normal },
            uRockMap: { value: textures.rock.map },
            uRockNor: { value: textures.rock.normal },
            uBasaltMap: { value: textures.basalt.map },
            uBasaltNor: { value: textures.basalt.normal },
            uTiling: { value: new THREE.Vector3(0.26, 0.2, 0.16) },
            uRoughness: { value: new THREE.Vector3(1, 0.96, 0.92) },
        };

        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\nvarying vec3 vGroundPos;\nvarying vec3 vGeoNormal;")
                .replace(
                    "#include <begin_vertex>",
                    "#include <begin_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGeoNormal = normalize(mat3(modelMatrix) * objectNormal);"
                );

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", `#include <common>\n${SPLAT_COMMON}`)
                .replace(
                    "#include <map_fragment>",
                    /* glsl */`
                    vec3 mWeights = moonWeights();
                    vec3 mColor = detailSample(uDustMap, uTiling.x) * mWeights.x
                                + detailSample(uRockMap, uTiling.y) * mWeights.y
                                + detailSample(uBasaltMap, uTiling.z) * mWeights.z;
                    diffuseColor.rgb *= mColor;
                    `
                )
                .replace(
                    "#include <roughnessmap_fragment>",
                    "float roughnessFactor = dot(uRoughness, mWeights);"
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    /* glsl */`
                    vec3 mMapN = detailNormal(uDustNor, uTiling.x) * mWeights.x
                               + detailNormal(uRockNor, uTiling.y) * mWeights.y
                               + detailNormal(uBasaltNor, uTiling.z) * mWeights.z;
                    mMapN.xy *= normalScale;
                    normal = normalize(tbn * normalize(mMapN));
                    `
                );
        };

        material.customProgramCacheKey = () => "moon-terrain-splat";
    }

    public dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = null;
    }
}
