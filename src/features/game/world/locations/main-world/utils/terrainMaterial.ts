// src/features/game/world/locations/main-world/utils/terrainMaterial.ts
import * as THREE from "three";
import { FOLIAGE_PALETTE, FOLIAGE_PALETTE_GLSL } from "./worldLighting";
import { SEA_LEVEL } from "../worldConfig";

const TEXTURE_ROOT = "/models/textures/world";

export interface TerrainTextureSet {
    map: THREE.Texture;
    rough: THREE.Texture;
    normal: THREE.Texture;
}

function loadSet(loader: THREE.TextureLoader, name: string, anisotropy: number): TerrainTextureSet {
    const configure = (texture: THREE.Texture, srgb: boolean) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = anisotropy;
        if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    };

    return {
        map: configure(loader.load(`${TEXTURE_ROOT}/${name}_diff_1k.webp`), true),
        rough: configure(loader.load(`${TEXTURE_ROOT}/${name}_rough_1k.webp`), false),
        normal: configure(loader.load(`${TEXTURE_ROOT}/${name}_nor_1k.webp`), false),
    };
}

export function createTerrainTextures(anisotropy: number) {
    const loader = new THREE.TextureLoader();
    return {
        sand: loadSet(loader, "coast_sand_01", anisotropy),
        grass: loadSet(loader, "aerial_grass_rock", anisotropy),
        rock: loadSet(loader, "rocky_terrain_02", anisotropy),
        dirt: loadSet(loader, "dirt", anisotropy),
    };
}

export type TerrainTextures = ReturnType<typeof createTerrainTextures>;

export function setTerrainAnisotropy(textures: TerrainTextures, anisotropy: number) {
    for (const set of Object.values(textures)) {
        set.map.anisotropy = anisotropy;
        set.rough.anisotropy = anisotropy;
        set.normal.anisotropy = anisotropy;
        set.map.needsUpdate = true;
        set.rough.needsUpdate = true;
        set.normal.needsUpdate = true;
    }
}

export function disposeTerrainTextures(textures: TerrainTextures) {
    for (const set of Object.values(textures)) {
        set.map.dispose();
        set.rough.dispose();
        set.normal.dispose();
    }
}

const terrainCommon = /* glsl */`
    uniform sampler2D uSandMap;
    uniform sampler2D uSandRough;
    uniform sampler2D uSandNormal;
    uniform sampler2D uGrassMap;
    uniform vec3 uGrassTint;
${FOLIAGE_PALETTE_GLSL}
    uniform sampler2D uGrassRough;
    uniform sampler2D uGrassNormal;
    uniform sampler2D uRockMap;
    uniform sampler2D uRockRough;
    uniform sampler2D uRockNormal;
    uniform float uSandScale;
    uniform float uGrassScale;
    uniform float uRockScale;
    uniform float uSeaLevel;
    uniform float uNormalStrength;

    varying vec3 vTerrainPos;
    varying vec3 vTerrainNormal;

    vec3 unpackNormal(vec3 packed) {
        return packed * 2.0 - 1.0;
    }
`;

const terrainWeights = /* glsl */`
    float terrainSlope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
    float terrainHeight = vTerrainPos.y;

    float rockWeight = smoothstep(0.30, 0.62, terrainSlope);
    float sandWeight = 1.0 - smoothstep(uSeaLevel + 0.4, uSeaLevel + 5.2, terrainHeight);
    float grassWeight = 1.0 - sandWeight;

    grassWeight *= (1.0 - rockWeight);
    sandWeight *= (1.0 - rockWeight);

    vec2 groundUvSand = vTerrainPos.xz * uSandScale;
    vec2 groundUvGrass = vTerrainPos.xz * uGrassScale;

    vec3 rockBlend = abs(vTerrainNormal);
    rockBlend = pow(rockBlend, vec3(3.0));
    rockBlend /= max(rockBlend.x + rockBlend.y + rockBlend.z, 0.0001);

    vec2 rockUvX = vTerrainPos.zy * uRockScale;
    vec2 rockUvY = vTerrainPos.xz * uRockScale;
    vec2 rockUvZ = vTerrainPos.xy * uRockScale;
`;

export function applyTerrainShader(
    material: THREE.MeshStandardMaterial,
    textures: TerrainTextures
) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uSandMap = { value: textures.sand.map };
        shader.uniforms.uSandRough = { value: textures.sand.rough };
        shader.uniforms.uSandNormal = { value: textures.sand.normal };
        shader.uniforms.uGrassMap = { value: textures.grass.map };
        shader.uniforms.uGrassTint = { value: new THREE.Color(FOLIAGE_PALETTE.groundTint) };
        shader.uniforms.uGrassRough = { value: textures.grass.rough };
        shader.uniforms.uGrassNormal = { value: textures.grass.normal };
        shader.uniforms.uRockMap = { value: textures.rock.map };
        shader.uniforms.uRockRough = { value: textures.rock.rough };
        shader.uniforms.uRockNormal = { value: textures.rock.normal };
        shader.uniforms.uSandScale = { value: 0.09 };
        shader.uniforms.uGrassScale = { value: 0.055 };
        shader.uniforms.uRockScale = { value: 0.035 };
        shader.uniforms.uSeaLevel = { value: SEA_LEVEL };
        shader.uniforms.uNormalStrength = { value: 0.85 };

        shader.vertexShader = `
            varying vec3 vTerrainPos;
            varying vec3 vTerrainNormal;
        ` + shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            vTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vTerrainNormal = normalize(mat3(modelMatrix) * normal);
            `
        );

        shader.fragmentShader = terrainCommon + shader.fragmentShader
            .replace(
                "#include <map_fragment>",
                `
                #include <map_fragment>
                ${terrainWeights}

                vec3 sandAlbedo = texture2D(uSandMap, groundUvSand).rgb;
                vec3 grassSample = texture2D(uGrassMap, groundUvGrass).rgb;
                float grassLuma = dot(grassSample, vec3(0.299, 0.587, 0.114));
                vec3 grassAlbedo = mix(grassSample, grassSample * uGrassTint * 2.0, 0.62);
                grassAlbedo = mix(vec3(grassLuma) * uGrassTint * 1.6, grassAlbedo, 0.72);
                vec3 rockAlbedo =
                    texture2D(uRockMap, rockUvX).rgb * rockBlend.x +
                    texture2D(uRockMap, rockUvY).rgb * rockBlend.y +
                    texture2D(uRockMap, rockUvZ).rgb * rockBlend.z;

                vec3 terrainAlbedo = sandAlbedo * sandWeight + grassAlbedo * grassWeight + rockAlbedo * rockWeight;

                float viewDistance = distance(vTerrainPos, cameraPosition);
                float carpetAmount = smoothstep(22.0, 70.0, viewDistance) * grassWeight;
                if (carpetAmount > 0.001) {
                    float macro = fract(sin(dot(floor(vTerrainPos.xz * 0.06), vec2(12.9898, 78.233))) * 43758.5453);
                    vec3 carpet = mix(GRASS_MID, GRASS_TIP, 0.35);
                    carpet = mix(carpet, GRASS_DRY, 0.22);
                    carpet *= mix(0.78, 1.22, macro);
                    terrainAlbedo = mix(terrainAlbedo, carpet * 2.6, carpetAmount * 0.75);
                }

                float wetness = 1.0 - smoothstep(uSeaLevel - 0.6, uSeaLevel + 1.8, terrainHeight);
                terrainAlbedo = mix(terrainAlbedo, terrainAlbedo * 0.52, wetness);

                diffuseColor.rgb *= terrainAlbedo;
                `
            )
            .replace(
                "#include <roughnessmap_fragment>",
                `
                float roughnessFactor = roughness;
                {
                    float sandRough = texture2D(uSandRough, groundUvSand).g;
                    float grassRough = texture2D(uGrassRough, groundUvGrass).g;
                    float rockRough =
                        texture2D(uRockRough, rockUvX).g * rockBlend.x +
                        texture2D(uRockRough, rockUvY).g * rockBlend.y +
                        texture2D(uRockRough, rockUvZ).g * rockBlend.z;

                    roughnessFactor *= sandRough * sandWeight + grassRough * grassWeight + rockRough * rockWeight;
                    roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, wetness);
                    roughnessFactor = clamp(roughnessFactor, 0.06, 1.0);
                }
                `
            )
            .replace(
                "#include <normal_fragment_maps>",
                `
                {
                    vec3 sandN = unpackNormal(texture2D(uSandNormal, groundUvSand).xyz);
                    vec3 grassN = unpackNormal(texture2D(uGrassNormal, groundUvGrass).xyz);
                    vec3 rockN =
                        unpackNormal(texture2D(uRockNormal, rockUvX).xyz) * rockBlend.x +
                        unpackNormal(texture2D(uRockNormal, rockUvY).xyz) * rockBlend.y +
                        unpackNormal(texture2D(uRockNormal, rockUvZ).xyz) * rockBlend.z;

                    vec3 tangentNormal = sandN * sandWeight + grassN * grassWeight + rockN * rockWeight;
                    tangentNormal.xy *= uNormalStrength;

                    vec3 dPdx = dFdx(vTerrainPos);
                    vec3 dPdy = dFdy(vTerrainPos);
                    vec3 tangent = normalize(dPdx - normal * dot(normal, dPdx));
                    vec3 bitangent = normalize(cross(normal, tangent));
                    mat3 terrainTbn = mat3(tangent, bitangent, normal);

                    normal = normalize(terrainTbn * normalize(tangentNormal));
                }
                `
            );
    };

    material.customProgramCacheKey = () => "main-world-terrain";
    return material;
}
