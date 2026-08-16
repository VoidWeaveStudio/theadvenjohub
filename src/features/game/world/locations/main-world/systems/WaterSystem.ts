// src/features/game/world/locations/main-world/systems/WaterSystem.ts
import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";
import { bakeTerrainDepthMap, createWaterNormalTexture, DepthMap } from "../utils/waterDepthMap";
import { SEA_LEVEL, SHORE_RADIUS, WORLD_SIZE } from "../worldConfig";
import type { WorldLighting } from "../utils/worldLighting";

const OCEAN_EXTENT = WORLD_SIZE * 2.6;
const OCEAN_SEGMENTS = 200;
const LAKE_SEGMENTS = 48;

const DEPTH_MAP_EXTENT = 1320;
const DEPTH_MAP_RESOLUTION = 448;

const waterVertexShader = /* glsl */`
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveScale;
    uniform sampler2D uDepthMap;
    uniform float uDepthOrigin;
    uniform float uDepthScale;
    uniform float uWaterLevel;
    uniform float uShoreFade;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;
    varying float vCrest;

    const vec4 WAVE_A = vec4(1.0, 0.24, 0.62, 1.00);
    const vec4 WAVE_B = vec4(-0.62, 0.78, 0.42, 1.73);
    const vec4 WAVE_C = vec4(0.34, -0.94, 0.24, 2.90);
    const vec4 WAVE_D = vec4(-0.88, -0.32, 0.13, 4.60);

    vec3 gerstner(vec4 wave, vec2 p, float steepness, inout vec3 tangent, inout vec3 binormal) {
        vec2 dir = normalize(wave.xy);
        float k = wave.w * uWaveScale * 6.2831853;
        float amplitude = wave.z * uWaveHeight;
        float omega = sqrt(9.81 * k);
        float phase = k * dot(dir, p) - omega * uTime * 0.62;

        float c = cos(phase);
        float s = sin(phase);
        float q = steepness / max(k * amplitude * 4.0, 0.0001);

        tangent += vec3(
            -q * dir.x * dir.x * k * amplitude * s,
            dir.x * k * amplitude * c,
            -q * dir.x * dir.y * k * amplitude * s
        );

        binormal += vec3(
            -q * dir.x * dir.y * k * amplitude * s,
            dir.y * k * amplitude * c,
            -q * dir.y * dir.y * k * amplitude * s
        );

        return vec3(
            q * amplitude * dir.x * c,
            amplitude * s,
            q * amplitude * dir.y * c
        );
    }

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec2 origin = world.xz;

        vec2 depthUv = (origin - vec2(uDepthOrigin)) * uDepthScale;
        float bedHeight = -40.0;
        if (depthUv.x >= 0.0 && depthUv.x <= 1.0 && depthUv.y >= 0.0 && depthUv.y <= 1.0) {
            bedHeight = texture2D(uDepthMap, depthUv).r;
        }
        float bedDepth = max(uWaterLevel - bedHeight, 0.0);
        float shore = smoothstep(0.0, uShoreFade, bedDepth);

        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 0.0, 1.0);
        vec3 offset = vec3(0.0);

        offset += gerstner(WAVE_A, origin, 0.5, tangent, binormal);
        offset += gerstner(WAVE_B, origin, 0.4, tangent, binormal);
        offset += gerstner(WAVE_C, origin, 0.26, tangent, binormal);
        offset += gerstner(WAVE_D, origin, 0.16, tangent, binormal);

        offset *= shore;
        tangent = mix(vec3(1.0, 0.0, 0.0), tangent, shore);
        binormal = mix(vec3(0.0, 0.0, 1.0), binormal, shore);

        world.xyz += offset;

        vWorldPos = world.xyz;
        vWaveNormal = normalize(cross(binormal, tangent));
        vCrest = clamp(offset.y / max(uWaveHeight, 0.0001) * 0.85, -1.0, 1.0);

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
    uniform vec2 uBoundsCenter;
    uniform float uBoundsRadius;
    uniform sampler2D uRippleTex;
    uniform vec4 uRippleBounds;
    uniform float uRippleStrength;
    uniform vec2 uRadialFogRange;
    uniform float uRadialFogStrength;
    uniform vec3 uRadialFogColor;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;
    varying float vCrest;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }

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

    vec3 simulatedRipple(vec2 worldXZ, out float crest) {
        crest = 0.0;
        vec2 uv = (worldXZ - uRippleBounds.xy) / uRippleBounds.zw;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);

        float texel = 1.0 / 256.0;
        float here = texture2D(uRippleTex, uv).r;
        float left = texture2D(uRippleTex, uv - vec2(texel, 0.0)).r;
        float right = texture2D(uRippleTex, uv + vec2(texel, 0.0)).r;
        float down = texture2D(uRippleTex, uv - vec2(0.0, texel)).r;
        float up = texture2D(uRippleTex, uv + vec2(0.0, texel)).r;

        vec2 edge = min(uv, 1.0 - uv);
        float inside = smoothstep(0.0, 0.08, min(edge.x, edge.y));

        crest = (abs(here) * 1.2 + abs((left + right + down + up) * 0.25 - here) * 3.0) * inside;
        return vec3(-(right - left), 0.0, -(up - down)) * uRippleStrength * inside;
    }

    void main() {
        float bounds = 1.0;
        if (uBoundsRadius > 0.0) {
            float edge = distance(vWorldPos.xz, uBoundsCenter);
            bounds = 1.0 - smoothstep(uBoundsRadius * 0.9, uBoundsRadius, edge);
            if (bounds <= 0.002) discard;
        }

        float terrainHeight = sampleTerrain(vWorldPos.xz);
        float depth = max(uWaterLevel - terrainHeight, 0.0);

        vec3 ripple = rippleNormal(vWorldPos.xz);
        float rippleFade = smoothstep(0.0, 2.5, depth);
        vec3 normal = normalize(vec3(
            vWaveNormal.x + ripple.x * 0.55 * rippleFade,
            vWaveNormal.y,
            vWaveNormal.z + ripple.y * 0.55 * rippleFade
        ));

        float rippleCrest = 0.0;
        vec3 simRipple = simulatedRipple(vWorldPos.xz, rippleCrest);
        normal = normalize(normal + vec3(simRipple.x, 0.0, simRipple.z));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(uSunDirection);

        float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);

        vec3 reflectDir = reflect(-viewDir, normal);
        float sky = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 skyColor = mix(uHorizonColor, uZenithColor, pow(sky, 0.7));
        skyColor += uSunColor * pow(max(dot(reflectDir, sunDir), 0.0), 8.0) * 0.28;

        float sunSpec = pow(max(dot(reflectDir, sunDir), 0.0), 320.0);
        float glitter = pow(max(dot(reflectDir, sunDir), 0.0), 42.0) * 0.2;

        vec3 extinction = vec3(0.42, 0.11, 0.06);
        float travel = depth / max(facing, 0.22);
        vec3 transmittance = exp(-extinction * travel);
        vec3 body = mix(uDeepColor, uShallowColor, transmittance);

        float crestUp = max(vCrest, 0.0);
        float through = pow(max(dot(viewDir, -sunDir), 0.0), 3.0);
        body += uShallowColor * uSunColor * through * crestUp * 0.55;

        vec3 color = mix(body, skyColor, clamp(fresnel, 0.0, 0.9));
        color += uSunColor * (sunSpec * 3.2 + glitter);

        float shoreNoise = noise(vWorldPos.xz * 0.55 - vec2(uTime * 0.35, uTime * 0.22));
        float surge = sin(depth * 3.4 - uTime * 1.7) * 0.5 + 0.5;
        float shoreLine = (1.0 - smoothstep(0.05, 1.15, depth)) * smoothstep(0.0, 0.16, depth);
        float foam = shoreLine * smoothstep(0.28, 0.85, surge * 0.65 + shoreNoise * 0.55);
        foam += smoothstep(0.55, 0.95, crestUp) * shoreNoise * 0.7;
        foam += smoothstep(0.06, 0.34, rippleCrest) * 0.5;
        color = mix(color, uFoamColor, clamp(foam, 0.0, 0.92));

        float alpha = uOpacity * smoothstep(0.0, 0.85, depth) * bounds;
        alpha = clamp(alpha + fresnel * 0.35 + foam * 0.6, 0.0, 1.0);

        float radialFog = smoothstep(uRadialFogRange.x, uRadialFogRange.y, length(vWorldPos.xz)) * uRadialFogStrength;
        color = mix(color, uRadialFogColor, radialFog);
        alpha = mix(alpha, 1.0, radialFog);

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
        private readonly terrain: TerrainSystem,
        lighting: WorldLighting
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uWaveHeight: { value: 0.19 },
            uShoreFade: { value: 3.2 },
            uWaveScale: { value: 0.0085 },
            uDepthMap: { value: null as THREE.Texture | null },
            uNormalMap: { value: null as THREE.Texture | null },
            uDepthOrigin: { value: 0 },
            uDepthScale: { value: 1 },
            uWaterLevel: { value: SEA_LEVEL },
            uShallowColor: { value: new THREE.Color(0x4d9c9e) },
            uDeepColor: { value: new THREE.Color(0x081f33) },
            uFoamColor: { value: new THREE.Color(0xeaf7ff) },
            uHorizonColor: { value: new THREE.Color(0x9fc4de) },
            uZenithColor: { value: new THREE.Color(0x3f6f9e) },
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
            uSunColor: { value: new THREE.Color(0xfff0cd) },
            uOpacity: { value: 0.82 },
            uBoundsCenter: { value: new THREE.Vector2(0, 0) },
            uBoundsRadius: { value: -1 },
            uRippleTex: { value: null as THREE.Texture | null },
            uRippleBounds: { value: new THREE.Vector4(-45, -45, 90, 90) },
            uRippleStrength: { value: 2.2 },
            uRadialFogRange: lighting.uniforms.uRadialFogRange,
            uRadialFogStrength: lighting.uniforms.uRadialFogStrength,
            uRadialFogColor: lighting.uniforms.uFogColor,
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
            lakeMaterial.uniforms.uWaveHeight.value = 0.045;
            lakeMaterial.uniforms.uWaveScale.value = 0.045;
            lakeMaterial.uniforms.uShoreFade.value = 1.4;
            lakeMaterial.uniforms.uBoundsCenter.value = new THREE.Vector2(lake.x, lake.z);
            lakeMaterial.uniforms.uBoundsRadius.value = lake.radius;
            lakeMaterial.uniforms.uDepthMap.value = this.depthMap.texture;
            lakeMaterial.uniforms.uNormalMap.value = this.normalTexture;
            lakeMaterial.uniforms.uDepthOrigin.value = this.depthMap.origin;
            lakeMaterial.uniforms.uDepthScale.value = this.depthMap.scale;
            lakeMaterial.uniforms.uWaterLevel.value = lake.level;
            lakeMaterial.uniforms.uShallowColor.value = new THREE.Color(0x5a9b84);
            lakeMaterial.uniforms.uDeepColor.value = new THREE.Color(0x0e2b2c);
            lakeMaterial.uniforms.uRadialFogRange = this.uniforms.uRadialFogRange;
            lakeMaterial.uniforms.uRadialFogStrength = this.uniforms.uRadialFogStrength;
            lakeMaterial.uniforms.uRadialFogColor = this.uniforms.uRadialFogColor;

            const disc = new THREE.Mesh(
                new THREE.PlaneGeometry(lake.radius * 2.1, lake.radius * 2.1, LAKE_SEGMENTS, LAKE_SEGMENTS),
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

    public setVisibleRadius(radius: number | null) {
        const limit = radius ?? Infinity;

        for (const mesh of this.meshes) {
            if (mesh.name === "ocean") {
                mesh.visible = limit >= SHORE_RADIUS;
                continue;
            }

            const bounds = (mesh.material as THREE.ShaderMaterial).uniforms.uBoundsRadius.value as number;
            const center = (mesh.material as THREE.ShaderMaterial).uniforms.uBoundsCenter.value as THREE.Vector2;
            mesh.visible = Math.hypot(center.x, center.y) - Math.max(0, bounds) <= limit;
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

    public getDepthMap(): DepthMap | null {
        return this.depthMap;
    }

    public setRippleField(texture: THREE.Texture, bounds: THREE.Vector4) {
        for (const mesh of this.meshes) {
            const material = mesh.material as THREE.ShaderMaterial;
            material.uniforms.uRippleTex.value = texture;
            material.uniforms.uRippleBounds.value.copy(bounds);
        }
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
