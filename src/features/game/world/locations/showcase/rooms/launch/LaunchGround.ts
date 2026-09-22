// src/features/game/world/locations/showcase/rooms/launch/LaunchGround.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { APRON_RADIUS, PAD_RADIUS, groundHeightAt } from "./launchLayout";
import type { LaunchSurfaceTextures } from "./launchTextures";

const OUTER_RADIUS = 340;
const SEGMENTS = 192;

const SPLAT_COMMON = /* glsl */`
    uniform sampler2D uConcreteMap;
    uniform sampler2D uConcreteNor;
    uniform sampler2D uAsphaltMap;
    uniform sampler2D uAsphaltNor;
    uniform sampler2D uGrassMap;
    uniform sampler2D uGrassNor;
    uniform vec3 uTiling;

    varying vec3 vGroundPos;

    vec3 padWeights() {
        float radial = length(vGroundPos.xz);

        float apron = 1.0 - smoothstep(${APRON_RADIUS.toFixed(1)} - 6.0, ${APRON_RADIUS.toFixed(1)} + 10.0, radial);
        float yards = (1.0 - smoothstep(96.0, 132.0, radial)) * smoothstep(88.0, 96.0, radial);
        float south = smoothstep(24.0, 32.0, -vGroundPos.z);
        float lane = (1.0 - smoothstep(5.5, 8.5, abs(vGroundPos.x))) * south;
        float ring = 1.0 - smoothstep(3.5, 7.0, abs(radial - 72.0));
        float outer = 1.0 - smoothstep(4.0, 8.0, abs(radial - 92.0));
        float road = clamp(lane + ring + outer, 0.0, 1.0);

        float concrete = clamp(apron + yards, 0.0, 1.0) * (1.0 - road);
        float asphalt = road;
        float grass = max(0.0, 1.0 - concrete - asphalt);

        float total = max(0.0001, concrete + asphalt + grass);
        return vec3(concrete, asphalt, grass) / total;
    }

    vec3 detailSample(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).rgb;
        vec3 far = texture2D(tex, uv * 0.1873).rgb;
        return near * (0.62 + far * 0.78);
    }

    vec3 detailNormal(sampler2D tex, float tiling) {
        vec2 uv = vGroundPos.xz * tiling;
        vec3 near = texture2D(tex, uv).xyz * 2.0 - 1.0;
        vec3 far = texture2D(tex, uv * 0.1873).xyz * 2.0 - 1.0;
        return normalize(vec3(near.xy + far.xy * 0.5, near.z));
    }
`;

export class LaunchGround {
    private mesh: THREE.Mesh | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin
    ) { }

    public create(textures: LaunchSurfaceTextures, simple: boolean) {
        const geometry = this.bin.geometry(this.buildGeometry());

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map: textures.concrete.map,
            normalMap: textures.concrete.normal,
            color: 0x8e948f,
            roughness: 0.94,
            metalness: 0.04,
        }));
        material.normalScale.set(1.1, 1.1);

        if (simple) {
            material.map!.repeat.set(0.3, 0.3);
            material.normalMap!.repeat.set(0.3, 0.3);
        } else {
            this.patch(material, textures);
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        this.scene.add(mesh);
        this.mesh = mesh;
    }

    private buildGeometry(): THREE.BufferGeometry {
        const radii: number[] = [];
        for (let r = 2; r <= PAD_RADIUS - 2; r += 2.6) radii.push(r);
        radii.push(PAD_RADIUS - 0.2, PAD_RADIUS + 0.2, PAD_RADIUS + 2.4);
        for (let r = PAD_RADIUS + 6; r <= APRON_RADIUS + 12; r += 4.4) radii.push(r);
        for (let r = APRON_RADIUS + 18; r <= 130; r += 8) radii.push(r);
        for (let r = 146; r <= OUTER_RADIUS; r += 22) radii.push(r);

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        positions.push(0, groundHeightAt(0, 0), 0);
        uvs.push(0.5, 0.5);

        for (const radius of radii) {
            for (let s = 0; s < SEGMENTS; s++) {
                const angle = (s / SEGMENTS) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                positions.push(x, groundHeightAt(x, z), z);
                uvs.push(x / (OUTER_RADIUS * 2) + 0.5, z / (OUTER_RADIUS * 2) + 0.5);
            }
        }

        for (let s = 0; s < SEGMENTS; s++) {
            const next = (s + 1) % SEGMENTS;
            indices.push(0, 1 + next, 1 + s);
        }

        for (let r = 1; r < radii.length; r++) {
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

    private patch(material: THREE.MeshStandardMaterial, textures: LaunchSurfaceTextures) {
        const uniforms = {
            uConcreteMap: { value: textures.concrete.map },
            uConcreteNor: { value: textures.concrete.normal },
            uAsphaltMap: { value: textures.asphalt.map },
            uAsphaltNor: { value: textures.asphalt.normal },
            uGrassMap: { value: textures.grass.map },
            uGrassNor: { value: textures.grass.normal },
            uTiling: { value: new THREE.Vector3(0.16, 0.13, 0.3) },
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
                    vec3 pWeights = padWeights();
                    vec3 pColor = detailSample(uConcreteMap, uTiling.x) * pWeights.x
                                + detailSample(uAsphaltMap, uTiling.y) * pWeights.y
                                + detailSample(uGrassMap, uTiling.z) * pWeights.z;
                    diffuseColor.rgb *= pColor;
                    `
                )
                .replace(
                    "#include <roughnessmap_fragment>",
                    "float roughnessFactor = dot(vec3(0.92, 0.86, 0.99), pWeights);"
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    /* glsl */`
                    vec3 pMapN = detailNormal(uConcreteNor, uTiling.x) * pWeights.x
                               + detailNormal(uAsphaltNor, uTiling.y) * pWeights.y
                               + detailNormal(uGrassNor, uTiling.z) * pWeights.z;
                    pMapN.xy *= normalScale;
                    normal = normalize(tbn * normalize(pMapN));
                    `
                );
        };

        material.customProgramCacheKey = () => "launch-ground-splat";
    }

    public dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = null;
    }
}
