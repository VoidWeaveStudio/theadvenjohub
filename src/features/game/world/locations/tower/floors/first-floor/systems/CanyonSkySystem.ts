// src/features/game/world/locations/tower/floors/first-floor/systems/CanyonSkySystem.ts
import * as THREE from "three";
import { CanyonBiome, biomeSunDirection } from "../utils/canyonBiomes";

const DOME_RADIUS = 1400;

const skyVertex = /* glsl */`
    varying vec3 vSkyDir;

    void main() {
        vSkyDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const skyFragment = /* glsl */`
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform vec3 uHaze;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uSunSharpness;

    varying vec3 vSkyDir;

    float skyHash(vec2 cell) {
        return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    }

    float skyNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
            mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }

    void main() {
        vec3 dir = normalize(vSkyDir);
        float height = dir.y;

        vec3 color = mix(uHorizon, uZenith, pow(clamp(height, 0.0, 1.0), 0.55));

        float band = exp(-max(height, 0.0) * 8.0);
        color = mix(color, uHaze, band * 0.72);
        color = mix(color, uHaze * 0.75, smoothstep(0.0, -0.3, height));

        float angle = atan(dir.z, dir.x);
        float veil = skyNoise(vec2(angle * 2.4, height * 7.0));
        veil *= skyNoise(vec2(angle * 6.1, height * 15.0));
        color += uHaze * smoothstep(0.45, 0.95, veil) * 0.22 * (1.0 - band);

        float sun = max(dot(dir, normalize(uSunDir)), 0.0);
        color += uSunColor * pow(sun, uSunSharpness) * 6.0;
        color += uSunColor * pow(sun, 14.0) * 0.45;
        color += uSunColor * pow(sun, 3.0) * 0.12;

        gl_FragColor = vec4(color, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export class CanyonSkySystem {
    public readonly sunDirection = new THREE.Vector3(0.4, 0.5, 0.7);

    private readonly uniforms: Record<string, THREE.IUniform>;
    private readonly dome: THREE.Mesh;

    constructor(private readonly scene: THREE.Scene, highQuality: boolean) {
        this.uniforms = {
            uZenith: { value: new THREE.Color(0x3d78bd) },
            uHorizon: { value: new THREE.Color(0xe9cda2) },
            uHaze: { value: new THREE.Color(0xd9b78c) },
            uSunColor: { value: new THREE.Color(0xfff3d6) },
            uSunDir: { value: this.sunDirection },
            uSunSharpness: { value: 900 },
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: skyVertex,
            fragmentShader: skyFragment,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
        });

        const segments = highQuality ? 32 : 20;
        this.dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, segments, Math.round(segments * 0.6)), material);
        this.dome.renderOrder = -20;
        this.dome.frustumCulled = false;
        this.scene.add(this.dome);
    }

    public applyBiome(biome: CanyonBiome) {
        (this.uniforms.uZenith.value as THREE.Color).setHex(biome.skyZenith);
        (this.uniforms.uHorizon.value as THREE.Color).setHex(biome.skyHorizon);
        (this.uniforms.uHaze.value as THREE.Color).setHex(biome.skyHaze);
        (this.uniforms.uSunColor.value as THREE.Color).setHex(biome.sunDiscColor);

        const direction = biomeSunDirection(biome);
        this.sunDirection.set(direction.x, direction.y, direction.z).normalize();
    }

    public setSunSharpness(value: number) {
        this.uniforms.uSunSharpness.value = value;
    }

    public update(playerPosition: THREE.Vector3) {
        this.dome.position.set(playerPosition.x, 0, playerPosition.z);
    }

    public dispose() {
        this.scene.remove(this.dome);
        this.dome.geometry.dispose();
        (this.dome.material as THREE.Material).dispose();
    }
}
