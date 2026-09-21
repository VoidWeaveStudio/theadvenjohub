// src/features/game/world/locations/showcase/rooms/garden/gardenShading.ts
import * as THREE from "three";

export const GARDEN_SUN_POSITION = new THREE.Vector3(-64, 78, -42);
export const GARDEN_SUN_DIRECTION = GARDEN_SUN_POSITION.clone().normalize();

export const GARDEN_SUN_COLOR = 0xfff0cd;
export const GARDEN_SKY_COLOR = 0x8ec9ee;
export const GARDEN_HORIZON_COLOR = 0xdcefff;
export const GARDEN_GROUND_COLOR = 0x53713e;
export const GARDEN_FOG_COLOR = 0xa8cfe4;
export const GARDEN_FOG_DENSITY = 0.0032;

export const GARDEN_EXPOSURE = {
    skyGain: 0.12,
    environment: 1,
    hemisphere: 0.55,
    sun: 1.9,
    bounce: 0.22,
};

export const GARDEN_LIGHT_UNIFORMS_GLSL = /* glsl */`
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uGroundColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uTime;
    uniform vec3 uCamPos;
    uniform vec2 uWindDir;
    uniform float uWindStrength;
`;

export const GARDEN_LIGHT_FUNCTIONS_GLSL = /* glsl */`
    vec3 hemiAmbient(vec3 n) {
        float k = n.y * 0.4 + 0.6;
        vec3 sky = mix(uHorizonColor, uSkyColor, smoothstep(0.0, 1.0, k));
        return mix(uGroundColor, sky, k);
    }

    float wrapDiffuse(vec3 n, vec3 l, float w) {
        return clamp((dot(n, l) + w) / ((1.0 + w) * (1.0 + w)), 0.0, 1.0);
    }

    float backTranslucency(vec3 v, vec3 l, float power) {
        return pow(clamp(dot(-v, l), 0.0, 1.0), power);
    }

    vec3 applyGardenFog(vec3 color, float dist) {
        float amount = 1.0 - exp(-dist * uFogDensity);
        return mix(color, uFogColor, clamp(amount, 0.0, 1.0));
    }
`;

export const GARDEN_BLADE_PALETTE_GLSL = /* glsl */`
    const vec3 BLADE_ROOT = vec3(0.019, 0.052, 0.018);
    const vec3 BLADE_MID  = vec3(0.078, 0.205, 0.052);
    const vec3 BLADE_TIP  = vec3(0.235, 0.430, 0.108);
    const vec3 BLADE_SUN  = vec3(0.395, 0.545, 0.145);
`;

export interface GardenLightUniforms {
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uSkyColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uGroundColor: { value: THREE.Color };
    uFogColor: { value: THREE.Color };
    uFogDensity: { value: number };
    uTime: { value: number };
    uCamPos: { value: THREE.Vector3 };
    uWindDir: { value: THREE.Vector2 };
    uWindStrength: { value: number };
}

export class GardenLighting {
    public readonly uniforms: GardenLightUniforms = {
        uSunDir: { value: GARDEN_SUN_DIRECTION.clone() },
        uSunColor: { value: new THREE.Color(GARDEN_SUN_COLOR) },
        uSkyColor: { value: new THREE.Color(GARDEN_SKY_COLOR) },
        uHorizonColor: { value: new THREE.Color(GARDEN_HORIZON_COLOR) },
        uGroundColor: { value: new THREE.Color(GARDEN_GROUND_COLOR) },
        uFogColor: { value: new THREE.Color(GARDEN_FOG_COLOR) },
        uFogDensity: { value: GARDEN_FOG_DENSITY },
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uWindDir: { value: new THREE.Vector2(0.78, 0.62).normalize() },
        uWindStrength: { value: 0.42 },
    };

    private readonly gustPhase = Math.random() * 40;

    public update(delta: number, cameraPosition: THREE.Vector3) {
        const time = this.uniforms.uTime.value + delta;
        this.uniforms.uTime.value = time;
        this.uniforms.uCamPos.value.copy(cameraPosition);

        const slow = Math.sin(time * 0.21 + this.gustPhase);
        const fast = Math.sin(time * 0.77 + this.gustPhase * 1.7);
        this.uniforms.uWindStrength.value = 0.34 + slow * 0.2 + fast * 0.07;

        const swing = Math.sin(time * 0.13) * 0.35;
        this.uniforms.uWindDir.value.set(Math.cos(swing + 0.67), Math.sin(swing + 0.67));
    }
}
