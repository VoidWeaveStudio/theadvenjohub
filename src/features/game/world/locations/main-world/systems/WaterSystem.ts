// src/features/game/world/locations/main-world/systems/WaterSystem.ts
import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";
import { bakeTerrainDepthMap, createWaterNormalTexture, DepthMap } from "../utils/waterDepthMap";
import { SEA_LEVEL, WORLD_SIZE } from "../worldConfig";

const OCEAN_EXTENT = WORLD_SIZE * 2.6;
const OCEAN_SEGMENTS = 128;
const LAKE_SEGMENTS = 56;

const DEPTH_MAP_EXTENT = 1320;
const DEPTH_MAP_RESOLUTION = 448;

const waterVertexShader = /* glsl */`
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveScale;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;

    float waveAt(vec2 p) {
        return sin(p.x * uWaveScale + uTime * 0.75) * 0.6
             + sin((p.y * 1.3 - p.x * 0.4) * uWaveScale * 1.7 + uTime * 1.1) * 0.28
             + sin((p.x * 0.7 + p.y * 0.9) * uWaveScale * 3.1 - uTime * 1.6) * 0.12;
    }

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);

        float h = waveAt(world.xz) * uWaveHeight;
        float hx = waveAt(world.xz + vec2(2.0, 0.0)) * uWaveHeight;
        float hz = waveAt(world.xz + vec2(0.0, 2.0)) * uWaveHeight;

        world.y += h;
        vWorldPos = world.xyz;
        vWaveNormal = normalize(vec3(h - hx, 2.0, h - hz));

        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const waterFragmentShader = /* glsl */`
    uniform float uTime;
    uniform sampler2D uDepthMap;
    uniform sampler2D uNormalMap;
    uniform float uDepthOrigin;
    uniform float uDepthScale;
    uniform float uWaterLevel;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uZenithColor;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform float uOpacity;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;

    float sampleTerrain(vec2 worldXZ) {
        vec2 uv = (worldXZ - vec2(uDepthOrigin)) * uDepthScale;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -40.0;
        return texture2D(uDepthMap, uv).r;
    }

    vec3 rippleNormal(vec2 worldXZ) {
        vec2 uvA = worldXZ * 0.045 + vec2(uTime * 0.012, uTime * 0.009);
        vec2 uvB = worldXZ * 0.021 - vec2(uTime * 0.008, uTime * 0.014);

        vec3 a = texture2D(uNormalMap, uvA).xyz * 2.0 - 1.0;
        vec3 b = texture2D(uNormalMap, uvB).xyz * 2.0 - 1.0;

        vec3 combined = normalize(vec3(a.xy + b.xy, a.z * b.z));
        return combined;
    }

    void main() {
        float terrainHeight = sampleTerrain(vWorldPos.xz);
        float depth = max(uWaterLevel - terrainHeight, 0.0);

        vec3 ripple = rippleNormal(vWorldPos.xz);
        float rippleFade = smoothstep(0.0, 2.5, depth);
        vec3 normal = normalize(vec3(
            vWaveNormal.x + ripple.x * 0.55 * rippleFade,
            vWaveNormal.y,
            vWaveNormal.z + ripple.y * 0.55 * rippleFade
        ));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.2);

        vec3 reflectDir = reflect(-viewDir, normal);
        float sky = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 skyColor = mix(uHorizonColor, uZenithColor, pow(sky, 0.7));

        float sunSpec = pow(max(dot(reflectDir, normalize(uSunDirection)), 0.0), 220.0);
        float glitter = pow(max(dot(reflectDir, normalize(uSunDirection)), 0.0), 24.0) * 0.16;

        vec3 body = mix(uShallowColor, uDeepColor, smoothstep(0.4, 11.0, depth));
        vec3 color = mix(body, skyColor, clamp(fresnel, 0.0, 0.82));
        color += uSunColor * (sunSpec * 2.4 + glitter);

        float shoreWave = sin(depth * 5.5 - uTime * 2.2) * 0.5 + 0.5;
        float foamBand = (1.0 - smoothstep(0.12, 1.35, depth)) * smoothstep(0.02, 0.22, depth);
        float foam = foamBand * (0.45 + shoreWave * 0.55);
        color = mix(color, uFoamColor, clamp(foam, 0.0, 0.9));

        float alpha = uOpacity * smoothstep(0.0, 1.1, depth);
        alpha = clamp(alpha + fresnel * 0.3 + foam * 0.5, 0.0, 1.0);

        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export class WaterSystem {
    private readonly meshes: THREE.Mesh[] = [];
    private readonly material: THREE.ShaderMaterial;
    private readonly uniforms;
    private depthMap: DepthMap | null = null;
    private normalTexture: THREE.DataTexture | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uWaveHeight: { value: 0.34 },
            uWaveScale: { value: 0.05 },
            uDepthMap: { value: null as THREE.Texture | null },
            uNormalMap: { value: null as THREE.Texture | null },
            uDepthOrigin: { value: 0 },
            uDepthScale: { value: 1 },
            uWaterLevel: { value: SEA_LEVEL },
            uShallowColor: { value: new THREE.Color(0x3fb8bf) },
            uDeepColor: { value: new THREE.Color(0x0a2b46) },
            uFoamColor: { value: new THREE.Color(0xeaf7ff) },
            uHorizonColor: { value: new THREE.Color(0x9fc4de) },
            uZenithColor: { value: new THREE.Color(0x3f6f9e) },
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
            uSunColor: { value: new THREE.Color(0xfff0cd) },
            uOpacity: { value: 0.82 },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    }

    public create() {
        this.depthMap = bakeTerrainDepthMap(
            (x, z) => this.terrain.getHeightAt(x, z),
            DEPTH_MAP_EXTENT,
            DEPTH_MAP_RESOLUTION
        );
        this.normalTexture = createWaterNormalTexture(256);

        this.uniforms.uDepthMap.value = this.depthMap.texture;
        this.uniforms.uNormalMap.value = this.normalTexture;
        this.uniforms.uDepthOrigin.value = this.depthMap.origin;
        this.uniforms.uDepthScale.value = this.depthMap.scale;

        const ocean = new THREE.Mesh(
            new THREE.PlaneGeometry(OCEAN_EXTENT, OCEAN_EXTENT, OCEAN_SEGMENTS, OCEAN_SEGMENTS),
            this.material
        );
        ocean.name = "ocean";
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = SEA_LEVEL;
        ocean.renderOrder = 2;
        ocean.matrixAutoUpdate = false;
        ocean.updateMatrix();
        this.scene.add(ocean);
        this.meshes.push(ocean);

        for (const lake of this.terrain.lakes) {
            const lakeMaterial = this.material.clone();
            lakeMaterial.uniforms = THREE.UniformsUtils.clone(this.uniforms);
            lakeMaterial.uniforms.uDepthMap.value = this.depthMap.texture;
            lakeMaterial.uniforms.uNormalMap.value = this.normalTexture;
            lakeMaterial.uniforms.uDepthOrigin.value = this.depthMap.origin;
            lakeMaterial.uniforms.uDepthScale.value = this.depthMap.scale;
            lakeMaterial.uniforms.uWaterLevel.value = lake.level;
            lakeMaterial.uniforms.uShallowColor.value = new THREE.Color(0x4bb59a);
            lakeMaterial.uniforms.uDeepColor.value = new THREE.Color(0x123a3c);

            const disc = new THREE.Mesh(
                new THREE.CircleGeometry(lake.radius * 1.02, LAKE_SEGMENTS),
                lakeMaterial
            );
            disc.name = "lake";
            disc.rotation.x = -Math.PI / 2;
            disc.position.set(lake.x, lake.level, lake.z);
            disc.renderOrder = 2;
            disc.matrixAutoUpdate = false;
            disc.updateMatrix();
            this.scene.add(disc);
            this.meshes.push(disc);
        }
    }

    public setSunDirection(direction: THREE.Vector3) {
        for (const mesh of this.meshes) {
            const material = mesh.material as THREE.ShaderMaterial;
            material.uniforms.uSunDirection.value.copy(direction);
        }
    }

    public getWaterHeightAt(x: number, z: number): number | null {
        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz > lake.radius * lake.radius) continue;
            return this.terrain.getHeightAt(x, z) < lake.level ? lake.level : null;
        }

        return this.terrain.getHeightAt(x, z) < SEA_LEVEL ? SEA_LEVEL : null;
    }

    public update(delta: number) {
        for (const mesh of this.meshes) {
            const material = mesh.material as THREE.ShaderMaterial;
            material.uniforms.uTime.value += delta;
        }
    }

    public dispose() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material !== this.material) (mesh.material as THREE.Material).dispose();
        }
        this.meshes.length = 0;
        this.material.dispose();
        this.depthMap?.texture.dispose();
        this.depthMap = null;
        this.normalTexture?.dispose();
        this.normalTexture = null;
    }
}
