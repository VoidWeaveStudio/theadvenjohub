// src/features/game/world/locations/showcase/rooms/garden/GardenGround.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import type { GardenSurface } from "./GardenSurface";
import type { GardenSurfaceTextures } from "./gardenTextures";

const SPLAT_COMMON = /* glsl */`
    uniform sampler2D uMaskMap;
    uniform sampler2D uLawnMap;
    uniform sampler2D uLawnNor;
    uniform sampler2D uPathMap;
    uniform sampler2D uPathNor;
    uniform sampler2D uBedMap;
    uniform sampler2D uBedNor;
    uniform sampler2D uStoneMap;
    uniform sampler2D uStoneNor;
    uniform float uMaskOrigin;
    uniform float uMaskScale;
    uniform vec4 uTiling;
    uniform vec4 uRoughness;
    uniform vec3 uLawnTint;

    varying vec3 vGroundPos;

    vec4 gardenWeights() {
        vec2 uv = (vGroundPos.xz - vec2(uMaskOrigin)) * uMaskScale;
        vec4 mask = texture2D(uMaskMap, clamp(uv, 0.0, 1.0));
        float total = mask.r + mask.g + mask.b;
        float scale = total > 1.0 ? 1.0 / total : 1.0;
        vec3 hard = vec3(mask.r, mask.g, mask.b) * scale;
        return vec4(1.0 - (hard.x + hard.y + hard.z), hard);
    }

    vec3 detailSample(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).rgb;
        vec3 far = texture2D(tex, uv * 0.2137).rgb;
        return near * (0.62 + far * 0.76);
    }

    vec3 detailNormal(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).xyz * 2.0 - 1.0;
        vec3 far = texture2D(tex, uv * 0.2137).xyz * 2.0 - 1.0;
        return normalize(vec3(near.xy + far.xy * 0.55, near.z));
    }
`;

export interface GroundHole {
    x: number;
    z: number;
    radius: number;
}

export class GardenGround {
    private material: THREE.MeshStandardMaterial | null = null;
    private mesh: THREE.Mesh | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly surface: GardenSurface,
        private readonly textures: GardenSurfaceTextures,
        private readonly radius: number,
        private readonly simple: boolean
    ) { }

    public create(holes: GroundHole[] = []) {
        const material = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.94,
            metalness: 0,
        }));

        material.map = this.textures.lawn.map;
        material.normalMap = this.textures.lawn.normal;
        material.normalScale.set(1.15, 1.15);

        if (this.simple) {
            material.map.repeat.set(0.2, 0.2);
            material.normalMap.repeat.set(0.2, 0.2);
            material.color.setHex(0x9fbb72);
        } else {
            this.patch(material);
        }

        const mesh = new THREE.Mesh(this.buildGeometry(holes), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.renderOrder = 0;
        this.scene.add(mesh);

        this.material = material;
        this.mesh = mesh;
    }

    private buildGeometry(holes: GroundHole[]): THREE.BufferGeometry {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, this.radius, 0, Math.PI * 2, false);

        for (const hole of holes) {
            const path = new THREE.Path();
            path.absarc(hole.x, -hole.z, hole.radius, 0, Math.PI * 2, true);
            shape.holes.push(path);
        }

        return this.bin.geometry(new THREE.ShapeGeometry(shape, 96));
    }

    private patch(material: THREE.MeshStandardMaterial) {
        const uniforms = {
            uMaskMap: { value: this.surface.build() },
            uLawnMap: { value: this.textures.lawn.map },
            uLawnNor: { value: this.textures.lawn.normal },
            uPathMap: { value: this.textures.path.map },
            uPathNor: { value: this.textures.path.normal },
            uBedMap: { value: this.textures.bed.map },
            uBedNor: { value: this.textures.bed.normal },
            uStoneMap: { value: this.textures.stone.map },
            uStoneNor: { value: this.textures.stone.normal },
            uMaskOrigin: { value: this.surface.origin },
            uMaskScale: { value: this.surface.scale },
            uTiling: { value: new THREE.Vector4(0.185, 0.16, 0.22, 0.24) },
            uRoughness: { value: new THREE.Vector4(0.95, 0.92, 0.97, 0.72) },
            uLawnTint: { value: new THREE.Color(0xa9c882) },
        };

        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\nvarying vec3 vGroundPos;")
                .replace(
                    "#include <begin_vertex>",
                    "#include <begin_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
                );

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", `#include <common>\n${SPLAT_COMMON}`)
                .replace(
                    "#include <map_fragment>",
                    /* glsl */`
                    vec4 gWeights = gardenWeights();
                    vec3 gLawn = detailSample(uLawnMap, uTiling.x) * uLawnTint;
                    vec3 gPath = detailSample(uPathMap, uTiling.y);
                    vec3 gBed = detailSample(uBedMap, uTiling.z);
                    vec3 gStone = detailSample(uStoneMap, uTiling.w);
                    vec3 gColor = gLawn * gWeights.x + gPath * gWeights.y + gBed * gWeights.z + gStone * gWeights.w;
                    diffuseColor.rgb *= gColor;
                    `
                )
                .replace(
                    "#include <roughnessmap_fragment>",
                    /* glsl */`
                    float roughnessFactor = dot(uRoughness, gWeights);
                    `
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    /* glsl */`
                    vec3 gMapN = detailNormal(uLawnNor, uTiling.x) * gWeights.x
                               + detailNormal(uPathNor, uTiling.y) * gWeights.y
                               + detailNormal(uBedNor, uTiling.z) * gWeights.z
                               + detailNormal(uStoneNor, uTiling.w) * gWeights.w;
                    gMapN.xy *= normalScale;
                    normal = normalize(tbn * normalize(gMapN));
                    `
                );
        };

        material.customProgramCacheKey = () => "garden-ground-splat";
    }

    public dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = null;
        this.material = null;
    }
}
