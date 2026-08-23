// src/features/game/world/locations/tower/floors/first-floor/utils/canyonRockMaterial.ts
import * as THREE from "three";
import { CanyonBiome } from "./canyonBiomes";

const TEXTURE_ROOT = "/models/textures/world";

interface TextureSet {
    map: THREE.Texture;
    rough: THREE.Texture;
    normal: THREE.Texture;
}

export interface CanyonTerrainTextures {
    rock: TextureSet;
    ground: TextureSet;
}

let shared: CanyonTerrainTextures | null = null;
let sharedUsers = 0;

function loadSet(loader: THREE.TextureLoader, name: string): TextureSet {
    const configure = (texture: THREE.Texture, srgb: boolean) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 4;
        if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    };

    return {
        map: configure(loader.load(`${TEXTURE_ROOT}/${name}_diff_1k.webp`), true),
        rough: configure(loader.load(`${TEXTURE_ROOT}/${name}_rough_1k.webp`), false),
        normal: configure(loader.load(`${TEXTURE_ROOT}/${name}_nor_1k.webp`), false),
    };
}

export function acquireCanyonTextures(): CanyonTerrainTextures {
    if (!shared) {
        const loader = new THREE.TextureLoader();
        shared = {
            rock: loadSet(loader, "rocky_terrain_02"),
            ground: loadSet(loader, "coast_sand_01"),
        };
    }

    sharedUsers++;
    return shared;
}

export function releaseCanyonTextures() {
    sharedUsers = Math.max(0, sharedUsers - 1);
    if (sharedUsers > 0 || !shared) return;

    for (const set of Object.values(shared)) {
        set.map.dispose();
        set.rough.dispose();
        set.normal.dispose();
    }
    shared = null;
}

const canyonCommon = /* glsl */`
    uniform sampler2D uRockMap;
    uniform sampler2D uRockRough;
    uniform sampler2D uRockNormal;
    uniform sampler2D uGroundMap;
    uniform sampler2D uGroundRough;
    uniform sampler2D uGroundNormal;
    uniform vec3 uRockTint;
    uniform vec3 uGroundTint;
    uniform vec3 uStrataA;
    uniform vec3 uStrataB;
    uniform vec3 uStrataC;
    uniform vec3 uVeinColor;
    uniform float uVeinStrength;
    uniform float uRockScale;
    uniform float uGroundScale;
    uniform float uStrataFreq;

    varying vec3 vCanyonPos;
    varying vec3 vCanyonNormal;

    float canyonHash(vec2 cell) {
        return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    }

    float canyonNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(canyonHash(i), canyonHash(i + vec2(1.0, 0.0)), u.x),
            mix(canyonHash(i + vec2(0.0, 1.0)), canyonHash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }

    vec3 canyonUnpackNormal(vec3 packed) {
        return packed * 2.0 - 1.0;
    }
`;

const canyonWeights = /* glsl */`
    vec3 canyonPos = vCanyonPos;
    vec3 canyonNormal = normalize(vCanyonNormal);

    float canyonSlope = 1.0 - clamp(canyonNormal.y, 0.0, 1.0);
    float rockWeight = smoothstep(0.14, 0.44, canyonSlope);

    vec2 groundUv = canyonPos.xz * uGroundScale;

    vec3 axisBlend = abs(canyonNormal);
    axisBlend = pow(axisBlend, vec3(4.0));
    axisBlend /= max(axisBlend.x + axisBlend.y + axisBlend.z, 0.0001);

    vec2 rockUvX = canyonPos.zy * uRockScale;
    vec2 rockUvY = canyonPos.xz * uRockScale;
    vec2 rockUvZ = canyonPos.xy * uRockScale;

    float bedCoord = canyonPos.y * uStrataFreq
        + canyonPos.x * 0.011
        + canyonPos.z * 0.004
        + canyonNoise(canyonPos.xz * 0.014) * 1.4;
    float bedIndex = floor(bedCoord);
    float bedFrac = bedCoord - bedIndex;
    float bedPick = canyonHash(vec2(bedIndex, 3.7));

    vec3 strata = mix(uStrataA, uStrataB, bedPick);
    strata = mix(strata, uStrataC, smoothstep(0.72, 0.94, bedPick));

    float bedSeam = smoothstep(0.0, 0.07, bedFrac) * (1.0 - smoothstep(0.9, 1.0, bedFrac));
    float bedShade = mix(0.66, 1.06, bedSeam);

    float macro = canyonNoise(canyonPos.xz * 0.0035);
    float cavity = mix(0.72, 1.0, smoothstep(0.25, 0.75, canyonNoise(canyonPos.xz * 0.05 + canyonPos.y * 0.03)));
`;

const canyonAlbedoHQ = /* glsl */`
    vec3 rockAlbedo =
        texture2D(uRockMap, rockUvX).rgb * axisBlend.x +
        texture2D(uRockMap, rockUvY).rgb * axisBlend.y +
        texture2D(uRockMap, rockUvZ).rgb * axisBlend.z;
`;

const canyonAlbedoLQ = /* glsl */`
    vec2 rockUvSide = mix(rockUvZ, rockUvX, step(axisBlend.z, axisBlend.x));
    float sideWeight = 1.0 - axisBlend.y;
    vec3 rockAlbedo = mix(texture2D(uRockMap, rockUvY).rgb, texture2D(uRockMap, rockUvSide).rgb, sideWeight);
`;

export function createCanyonTerrainMaterial(
    biome: CanyonBiome,
    textures: CanyonTerrainTextures,
    highQuality: boolean
): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1,
        dithering: true,
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uRockMap = { value: textures.rock.map };
        shader.uniforms.uRockRough = { value: textures.rock.rough };
        shader.uniforms.uRockNormal = { value: textures.rock.normal };
        shader.uniforms.uGroundMap = { value: textures.ground.map };
        shader.uniforms.uGroundRough = { value: textures.ground.rough };
        shader.uniforms.uGroundNormal = { value: textures.ground.normal };
        shader.uniforms.uRockTint = { value: new THREE.Color(biome.rockTint).multiplyScalar(2.1) };
        shader.uniforms.uGroundTint = { value: new THREE.Color(biome.groundTint).multiplyScalar(1.9) };
        shader.uniforms.uStrataA = { value: new THREE.Color(biome.strataA) };
        shader.uniforms.uStrataB = { value: new THREE.Color(biome.strataB) };
        shader.uniforms.uStrataC = { value: new THREE.Color(biome.strataC) };
        shader.uniforms.uVeinColor = { value: new THREE.Color(biome.veinColor) };
        shader.uniforms.uVeinStrength = { value: biome.veinStrength };
        shader.uniforms.uRockScale = { value: 0.045 };
        shader.uniforms.uGroundScale = { value: 0.075 };
        shader.uniforms.uStrataFreq = { value: 0.115 };

        material.userData.canyonUniforms = shader.uniforms;

        shader.vertexShader = `
            varying vec3 vCanyonPos;
            varying vec3 vCanyonNormal;
        ` + shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            #ifdef USE_INSTANCING
                vCanyonPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                vCanyonNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            #else
                vCanyonPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vCanyonNormal = normalize(mat3(modelMatrix) * normal);
            #endif
            `
        );

        shader.fragmentShader = canyonCommon + shader.fragmentShader
            .replace(
                "#include <map_fragment>",
                `
                #include <map_fragment>
                ${canyonWeights}
                ${highQuality ? canyonAlbedoHQ : canyonAlbedoLQ}

                vec3 groundAlbedo = texture2D(uGroundMap, groundUv).rgb * uGroundTint;
                groundAlbedo *= mix(0.86, 1.16, canyonNoise(canyonPos.xz * 0.02));

                vec3 shelfDust = groundAlbedo * 0.9;
                rockAlbedo *= uRockTint * mix(vec3(1.0), strata * 1.9, 0.75) * bedShade;
                rockAlbedo = mix(rockAlbedo, shelfDust, smoothstep(0.62, 0.93, canyonNormal.y) * 0.55);
                rockAlbedo *= cavity;

                vec3 canyonAlbedo = mix(groundAlbedo, rockAlbedo, rockWeight);
                canyonAlbedo *= mix(0.84, 1.15, macro);

                diffuseColor.rgb *= canyonAlbedo;
                `
            )
            .replace(
                "#include <emissivemap_fragment>",
                `
                #include <emissivemap_fragment>
                if (uVeinStrength > 0.001) {
                    float veinField = canyonNoise(vec2(canyonPos.y * 0.09, canyonPos.x * 0.025 + canyonPos.z * 0.06));
                    float vein = 1.0 - abs(veinField * 2.0 - 1.0);
                    vein = smoothstep(0.88, 1.0, vein) * rockWeight * uVeinStrength;
                    totalEmissiveRadiance = uVeinColor * vein * 2.6;
                } else {
                    totalEmissiveRadiance = vec3(0.0);
                }
                `
            )
            .replace(
                "#include <roughnessmap_fragment>",
                highQuality
                    ? `
                float roughnessFactor = roughness;
                {
                    float rockRough =
                        texture2D(uRockRough, rockUvX).g * axisBlend.x +
                        texture2D(uRockRough, rockUvY).g * axisBlend.y +
                        texture2D(uRockRough, rockUvZ).g * axisBlend.z;
                    float groundRough = texture2D(uGroundRough, groundUv).g;
                    roughnessFactor *= mix(groundRough, rockRough, rockWeight);
                    roughnessFactor = clamp(roughnessFactor * mix(1.05, 0.82, bedPick), 0.35, 1.0);
                }
                `
                    : `
                float roughnessFactor = clamp(roughness * mix(1.0, 0.86, rockWeight), 0.45, 1.0);
                `
            )
            .replace(
                "#include <normal_fragment_maps>",
                highQuality
                    ? `
                {
                    vec3 rockN =
                        canyonUnpackNormal(texture2D(uRockNormal, rockUvX).xyz) * axisBlend.x +
                        canyonUnpackNormal(texture2D(uRockNormal, rockUvY).xyz) * axisBlend.y +
                        canyonUnpackNormal(texture2D(uRockNormal, rockUvZ).xyz) * axisBlend.z;
                    vec3 groundN = canyonUnpackNormal(texture2D(uGroundNormal, groundUv).xyz);

                    vec3 tangentNormal = mix(groundN, rockN, rockWeight);
                    tangentNormal.xy *= 1.15;

                    vec3 dPdx = dFdx(canyonPos);
                    vec3 dPdy = dFdy(canyonPos);
                    vec3 tangent = normalize(dPdx - normal * dot(normal, dPdx));
                    vec3 bitangent = normalize(cross(normal, tangent));
                    normal = normalize(mat3(tangent, bitangent, normal) * normalize(tangentNormal));
                }
                `
                    : ""
            );
    };

    material.customProgramCacheKey = () => (highQuality ? "canyon-terrain-hq" : "canyon-terrain-lq");
    return material;
}
