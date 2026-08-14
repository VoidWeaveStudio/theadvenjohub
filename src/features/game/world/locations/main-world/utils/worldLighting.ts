// src/features/game/world/locations/main-world/utils/worldLighting.ts
import * as THREE from "three";

export interface SkyKeyframe {
    elevation: number;
    sun: number;
    sunIntensity: number;
    sky: number;
    horizon: number;
    ground: number;
    fog: number;
    fogDensity: number;
}

const KEYFRAMES: SkyKeyframe[] = [
    { elevation: -18, sun: 0x2a3f6b, sunIntensity: 0.16, sky: 0x0d1730, horizon: 0x1b2740, ground: 0x0b1220, fog: 0x131e33, fogDensity: 0.0042 },
    { elevation: -4, sun: 0x6b4a72, sunIntensity: 0.34, sky: 0x1d2f52, horizon: 0x5d4668, ground: 0x1a1c2a, fog: 0x35364f, fogDensity: 0.0046 },
    { elevation: 4, sun: 0xff9a5c, sunIntensity: 0.95, sky: 0x4d7fb8, horizon: 0xf0a06a, ground: 0x40342c, fog: 0xd08d66, fogDensity: 0.0038 },
    { elevation: 16, sun: 0xffd9a8, sunIntensity: 1.5, sky: 0x76aee2, horizon: 0xbcd6ea, ground: 0x5d5f4a, fog: 0xa8c6dd, fogDensity: 0.0026 },
    { elevation: 55, sun: 0xfff4e0, sunIntensity: 1.85, sky: 0x5c9ee0, horizon: 0xc4dcef, ground: 0x6f7355, fog: 0x9fc0da, fogDensity: 0.0021 },
];

export const FOLIAGE_PALETTE = {
    root: 0x24391a,
    mid: 0x466f24,
    tip: 0x7ba63a,
    dry: 0x8f8f3e,
    groundTint: 0x8fa860,
};

export const FOLIAGE_PALETTE_GLSL = /* glsl */`
    const vec3 GRASS_ROOT = vec3(0.055, 0.117, 0.030);
    const vec3 GRASS_MID  = vec3(0.185, 0.363, 0.056);
    const vec3 GRASS_TIP  = vec3(0.404, 0.585, 0.126);
    const vec3 GRASS_DRY  = vec3(0.475, 0.475, 0.140);
`;

export const WORLD_LIGHTING_UNIFORMS_GLSL = /* glsl */`
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uGroundColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uFogHeightFalloff;
    uniform float uNightFactor;
    uniform float uTime;
    uniform vec3 uCamPos;
`;

export const WORLD_LIGHTING_FUNCTIONS_GLSL = /* glsl */`
    vec3 hemiAmbient(vec3 n) {
        float k = n.y * 0.35 + 0.65;
        vec3 sky = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 1.0, k));
        return mix(uGroundColor, sky, k);
    }

    float wrapDiffuse(vec3 n, vec3 l, float w) {
        return clamp((dot(n, l) + w) / ((1.0 + w) * (1.0 + w)), 0.0, 1.0);
    }

    float backTranslucency(vec3 v, vec3 l, float power) {
        return pow(clamp(dot(-v, l), 0.0, 1.0), power);
    }

    vec3 applyWorldFog(vec3 color, float dist, float worldY) {
        float heightFade = exp(-max(worldY, 0.0) * uFogHeightFalloff);
        float amount = 1.0 - exp(-dist * uFogDensity * heightFade);
        return mix(color, uFogColor, clamp(amount, 0.0, 1.0));
    }
`;

export class WorldLighting {
    public readonly uniforms = {
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color(0xfff4e0) },
        uSkyColor: { value: new THREE.Color(0x5c9ee0) },
        uHorizonColor: { value: new THREE.Color(0xc4dcef) },
        uGroundColor: { value: new THREE.Color(0x6f7355) },
        uFogColor: { value: new THREE.Color(0x9fc0da) },
        uFogDensity: { value: 0.0021 },
        uFogHeightFalloff: { value: 0.014 },
        uNightFactor: { value: 0 },
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
    };

    public sunIntensity = 1.85;
    public elevationDegrees = 55;

    private readonly colorA = new THREE.Color();
    private readonly colorB = new THREE.Color();

    public update(delta: number, sunDirection: THREE.Vector3, cameraPosition: THREE.Vector3) {
        this.uniforms.uTime.value += delta;
        this.uniforms.uCamPos.value.copy(cameraPosition);
        this.uniforms.uSunDir.value.copy(sunDirection).normalize();

        const elevation = Math.asin(THREE.MathUtils.clamp(this.uniforms.uSunDir.value.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
        this.elevationDegrees = elevation;

        let lower = KEYFRAMES[0];
        let upper = KEYFRAMES[KEYFRAMES.length - 1];

        for (let i = 0; i < KEYFRAMES.length - 1; i++) {
            if (elevation >= KEYFRAMES[i].elevation && elevation <= KEYFRAMES[i + 1].elevation) {
                lower = KEYFRAMES[i];
                upper = KEYFRAMES[i + 1];
                break;
            }
        }

        const span = upper.elevation - lower.elevation;
        const t = span > 0 ? THREE.MathUtils.clamp((elevation - lower.elevation) / span, 0, 1) : 0;

        this.blend(this.uniforms.uSunColor.value, lower.sun, upper.sun, t);
        this.blend(this.uniforms.uSkyColor.value, lower.sky, upper.sky, t);
        this.blend(this.uniforms.uHorizonColor.value, lower.horizon, upper.horizon, t);
        this.blend(this.uniforms.uGroundColor.value, lower.ground, upper.ground, t);
        this.blend(this.uniforms.uFogColor.value, lower.fog, upper.fog, t);

        this.uniforms.uFogDensity.value = THREE.MathUtils.lerp(lower.fogDensity, upper.fogDensity, t);
        this.sunIntensity = THREE.MathUtils.lerp(lower.sunIntensity, upper.sunIntensity, t);
        this.uniforms.uNightFactor.value = 1 - THREE.MathUtils.clamp((elevation + 6) / 12, 0, 1);
    }

    private blend(target: THREE.Color, from: number, to: number, t: number) {
        this.colorA.setHex(from);
        this.colorB.setHex(to);
        target.copy(this.colorA).lerp(this.colorB, t);
    }

    public applyToScene(scene: THREE.Scene, hemisphere: THREE.HemisphereLight | null, sun: THREE.DirectionalLight | null) {
        if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.color.copy(this.uniforms.uFogColor.value);
            scene.fog.density = this.uniforms.uFogDensity.value;
        }

        if (hemisphere) {
            hemisphere.color.copy(this.uniforms.uSkyColor.value);
            hemisphere.groundColor.copy(this.uniforms.uGroundColor.value);
            hemisphere.intensity = 0.85 + (1 - this.uniforms.uNightFactor.value) * 0.55;
        }

        if (sun) {
            sun.color.copy(this.uniforms.uSunColor.value);
            sun.intensity = this.sunIntensity;
        }
    }
}
