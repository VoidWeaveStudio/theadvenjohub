// src/features/game/world/building/environmentPresets.ts
import * as THREE from "three";

export interface SkyPreset {
    id: string;
    name: string;
    top: number;
    horizon: number;
    ground: number;
    stars: boolean;
    fogDensity: number;
}

export interface LightPreset {
    id: string;
    name: string;
    ambient: number;
    ambientIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    sun: number;
    sunIntensity: number;
    sunAngle: number;
    sunHeight: number;
}

export const SKY_PRESETS: SkyPreset[] = [
    { id: "day", name: "Clear Day", top: 0x3f7fd0, horizon: 0xbfd9f2, ground: 0x6f7a63, stars: false, fogDensity: 0.0016 },
    { id: "sunset", name: "Sunset", top: 0x2b3a6b, horizon: 0xf0955a, ground: 0x4a3a34, stars: false, fogDensity: 0.0022 },
    { id: "overcast", name: "Overcast", top: 0x8d99a8, horizon: 0xc3cad3, ground: 0x5f6560, stars: false, fogDensity: 0.0034 },
    { id: "night", name: "Starry Night", top: 0x05070f, horizon: 0x131c33, ground: 0x0a0c12, stars: true, fogDensity: 0.0026 },
    { id: "cosmos", name: "Cosmos", top: 0x05030f, horizon: 0x241452, ground: 0x07050f, stars: true, fogDensity: 0.0012 },
    { id: "void", name: "Void", top: 0x000000, horizon: 0x0a0a0c, ground: 0x000000, stars: false, fogDensity: 0.004 },
];

export const LIGHT_PRESETS: LightPreset[] = [
    { id: "noon", name: "Noon", ambient: 0xffffff, ambientIntensity: 0.42, hemiSky: 0xcfe6ff, hemiGround: 0x6b6455, hemiIntensity: 0.85, sun: 0xfff4de, sunIntensity: 2.1, sunAngle: 0.7, sunHeight: 0.95 },
    { id: "morning", name: "Morning", ambient: 0xffe9d0, ambientIntensity: 0.35, hemiSky: 0xffe0bd, hemiGround: 0x6a6154, hemiIntensity: 0.7, sun: 0xffd7a1, sunIntensity: 1.7, sunAngle: 2.2, sunHeight: 0.45 },
    { id: "evening", name: "Evening", ambient: 0xffcf9e, ambientIntensity: 0.3, hemiSky: 0xffb583, hemiGround: 0x4a3f38, hemiIntensity: 0.6, sun: 0xff9b52, sunIntensity: 1.5, sunAngle: 4.0, sunHeight: 0.3 },
    { id: "moonlit", name: "Moonlit", ambient: 0x8fa8d8, ambientIntensity: 0.22, hemiSky: 0x6f86c0, hemiGround: 0x1a1d26, hemiIntensity: 0.45, sun: 0xaec6ff, sunIntensity: 0.7, sunAngle: 1.4, sunHeight: 0.8 },
    { id: "neon", name: "Neon", ambient: 0xb478ff, ambientIntensity: 0.4, hemiSky: 0x7be0ff, hemiGround: 0x35124a, hemiIntensity: 0.8, sun: 0xff7bd0, sunIntensity: 1.2, sunAngle: 3.1, sunHeight: 0.6 },
    { id: "studio", name: "Studio", ambient: 0xffffff, ambientIntensity: 0.75, hemiSky: 0xffffff, hemiGround: 0xbdbdbd, hemiIntensity: 0.9, sun: 0xffffff, sunIntensity: 1.1, sunAngle: 0.9, sunHeight: 0.9 },
];

export function getSkyPreset(id: string): SkyPreset {
    return SKY_PRESETS.find((preset) => preset.id === id) ?? SKY_PRESETS[0];
}

export function getLightPreset(id: string): LightPreset {
    return LIGHT_PRESETS.find((preset) => preset.id === id) ?? LIGHT_PRESETS[0];
}

const skyVertex = /* glsl */ `
varying vec3 vLocal;
void main() {
    vLocal = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uStars;
varying vec3 vLocal;

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
    float h = vLocal.y;
    vec3 color = h >= 0.0
        ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.65))
        : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.5));

    if (uStars > 0.5 && h > -0.05) {
        vec3 cell = floor(vLocal * 260.0);
        float star = hash(cell);
        if (star > 0.9975) {
            float twinkle = 0.6 + 0.4 * hash(cell + 3.1);
            color += vec3(twinkle) * smoothstep(-0.05, 0.25, h);
        }
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

export class BuildEnvironmentRig {
    private dome: THREE.Mesh;
    private ambient: THREE.AmbientLight;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;
    private sunTarget: THREE.Object3D;

    constructor(private scene: THREE.Scene, radius: number) {
        this.dome = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTop: { value: new THREE.Color() },
                    uHorizon: { value: new THREE.Color() },
                    uGround: { value: new THREE.Color() },
                    uStars: { value: 0 },
                },
                vertexShader: skyVertex,
                fragmentShader: skyFragment,
                side: THREE.BackSide,
                depthWrite: false,
                fog: false,
            })
        );
        this.dome.renderOrder = -1000;
        this.scene.add(this.dome);

        this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambient);

        this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(this.hemisphere);

        this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0005;
        this.sun.shadow.normalBias = 0.04;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = radius * 1.6;

        const extent = Math.min(radius * 0.6, 90);
        this.sun.shadow.camera.left = -extent;
        this.sun.shadow.camera.right = extent;
        this.sun.shadow.camera.top = extent;
        this.sun.shadow.camera.bottom = -extent;
        this.sun.shadow.camera.updateProjectionMatrix();

        this.sunTarget = new THREE.Object3D();
        this.sun.target = this.sunTarget;
        this.scene.add(this.sun);
        this.scene.add(this.sunTarget);
    }

    public apply(skyId: string, lightId: string) {
        const sky = getSkyPreset(skyId);
        const light = getLightPreset(lightId);

        const uniforms = (this.dome.material as THREE.ShaderMaterial).uniforms;
        (uniforms.uTop.value as THREE.Color).setHex(sky.top);
        (uniforms.uHorizon.value as THREE.Color).setHex(sky.horizon);
        (uniforms.uGround.value as THREE.Color).setHex(sky.ground);
        uniforms.uStars.value = sky.stars ? 1 : 0;

        this.scene.background = new THREE.Color(sky.horizon);
        this.scene.fog = new THREE.FogExp2(new THREE.Color(sky.horizon), sky.fogDensity);

        this.ambient.color.setHex(light.ambient);
        this.ambient.intensity = light.ambientIntensity;

        this.hemisphere.color.setHex(light.hemiSky);
        this.hemisphere.groundColor.setHex(light.hemiGround);
        this.hemisphere.intensity = light.hemiIntensity;

        this.sun.color.setHex(light.sun);
        this.sun.intensity = light.sunIntensity;

        const distance = 120;
        this.sun.position.set(
            Math.cos(light.sunAngle) * distance,
            light.sunHeight * distance,
            Math.sin(light.sunAngle) * distance
        );
        this.sunTarget.position.set(0, 0, 0);
        this.sunTarget.updateMatrixWorld();
    }

    public followTarget(x: number, z: number) {
        this.dome.position.set(x, 0, z);
        this.sunTarget.position.set(x, 0, z);
        this.sunTarget.updateMatrixWorld();
    }

    public dispose() {
        this.dome.geometry.dispose();
        (this.dome.material as THREE.Material).dispose();
        this.scene.remove(this.dome, this.ambient, this.hemisphere, this.sun, this.sunTarget);
    }
}
