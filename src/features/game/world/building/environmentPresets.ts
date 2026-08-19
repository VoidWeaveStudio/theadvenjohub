// src/features/game/world/building/environmentPresets.ts
import * as THREE from "three";
import { EditorSky } from "./EditorSky";

export interface SkyPreset {
    id: string;
    name: string;
    elevation: number;
    azimuth: number;
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
    cloudCoverage: number;
    cloudDensity: number;
    cloudSpeed: number;
    cloudElevation: number;
    stars: number;
    aurora: number;
    auroraColor: number;
    space: number;
    spaceTint: number;
    fog: number;
    fogDensity: number;
    sunDisc: boolean;
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
}

export const SKY_PRESETS: SkyPreset[] = [
    { id: "day", name: "g.build.sky.day", elevation: 52, azimuth: 165, turbidity: 4, rayleigh: 1.5, mieCoefficient: 0.004, mieDirectionalG: 0.8, cloudCoverage: 0.28, cloudDensity: 0.34, cloudSpeed: 0.00008, cloudElevation: 0.45, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xc3daea, fogDensity: 0.0009, sunDisc: true },
    { id: "summer", name: "g.build.sky.summer", elevation: 74, azimuth: 190, turbidity: 3, rayleigh: 1.1, mieCoefficient: 0.003, mieDirectionalG: 0.78, cloudCoverage: 0.16, cloudDensity: 0.26, cloudSpeed: 0.00005, cloudElevation: 0.3, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xcfe6f4, fogDensity: 0.0006, sunDisc: true },
    { id: "morning", name: "g.build.sky.morning", elevation: 20, azimuth: 110, turbidity: 6, rayleigh: 2.2, mieCoefficient: 0.006, mieDirectionalG: 0.82, cloudCoverage: 0.44, cloudDensity: 0.4, cloudSpeed: 0.0001, cloudElevation: 0.55, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xd8e2e8, fogDensity: 0.0017, sunDisc: true },
    { id: "golden", name: "g.build.sky.golden", elevation: 7, azimuth: 200, turbidity: 8, rayleigh: 2.8, mieCoefficient: 0.011, mieDirectionalG: 0.87, cloudCoverage: 0.4, cloudDensity: 0.46, cloudSpeed: 0.00012, cloudElevation: 0.6, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xe8b184, fogDensity: 0.0018, sunDisc: true },
    { id: "sunset", name: "g.build.sky.sunset", elevation: 1.4, azimuth: 215, turbidity: 11, rayleigh: 2.6, mieCoefficient: 0.02, mieDirectionalG: 0.9, cloudCoverage: 0.5, cloudDensity: 0.52, cloudSpeed: 0.00014, cloudElevation: 0.65, stars: 0.25, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xd88355, fogDensity: 0.0024, sunDisc: true },
    { id: "overcast", name: "g.build.sky.overcast", elevation: 34, azimuth: 150, turbidity: 18, rayleigh: 0.6, mieCoefficient: 0.02, mieDirectionalG: 0.7, cloudCoverage: 0.82, cloudDensity: 0.72, cloudSpeed: 0.00016, cloudElevation: 0.4, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0xb9bfc6, fogDensity: 0.0032, sunDisc: false },
    { id: "storm", name: "g.build.sky.storm", elevation: 16, azimuth: 140, turbidity: 26, rayleigh: 0.35, mieCoefficient: 0.028, mieDirectionalG: 0.68, cloudCoverage: 0.95, cloudDensity: 0.88, cloudSpeed: 0.0004, cloudElevation: 0.72, stars: 0, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0x6f7681, fogDensity: 0.0052, sunDisc: false },
    { id: "night", name: "g.build.sky.night", elevation: -11, azimuth: 300, turbidity: 10, rayleigh: 0.45, mieCoefficient: 0.006, mieDirectionalG: 0.8, cloudCoverage: 0.14, cloudDensity: 0.3, cloudSpeed: 0.00006, cloudElevation: 0.45, stars: 1, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x3b2a6b, fog: 0x121a2c, fogDensity: 0.0022, sunDisc: false },
    { id: "aurora", name: "g.build.sky.aurora", elevation: -16, azimuth: 20, turbidity: 6, rayleigh: 0.4, mieCoefficient: 0.004, mieDirectionalG: 0.78, cloudCoverage: 0.08, cloudDensity: 0.25, cloudSpeed: 0.00006, cloudElevation: 0.4, stars: 1, aurora: 0.55, auroraColor: 0x53ffc0, space: 0, spaceTint: 0x1c3a55, fog: 0x0d1e2a, fogDensity: 0.0026, sunDisc: false },
    { id: "cosmos", name: "g.build.sky.cosmos", elevation: -40, azimuth: 40, turbidity: 2, rayleigh: 0.08, mieCoefficient: 0.002, mieDirectionalG: 0.6, cloudCoverage: 0, cloudDensity: 0, cloudSpeed: 0, cloudElevation: 0.5, stars: 1, aurora: 0.2, auroraColor: 0x8a6cff, space: 0.85, spaceTint: 0x4b2f7a, fog: 0x150c2b, fogDensity: 0.0012, sunDisc: false },
    { id: "nebula", name: "g.build.sky.nebula", elevation: -55, azimuth: 250, turbidity: 2, rayleigh: 0.05, mieCoefficient: 0.002, mieDirectionalG: 0.6, cloudCoverage: 0, cloudDensity: 0, cloudSpeed: 0, cloudElevation: 0.5, stars: 1, aurora: 0.32, auroraColor: 0xff6ec7, space: 0.95, spaceTint: 0x7a2f66, fog: 0x25102e, fogDensity: 0.0014, sunDisc: false },
    { id: "void", name: "g.build.sky.void", elevation: -90, azimuth: 0, turbidity: 1, rayleigh: 0, mieCoefficient: 0, mieDirectionalG: 0, cloudCoverage: 0, cloudDensity: 0, cloudSpeed: 0, cloudElevation: 0.5, stars: 0.35, aurora: 0, auroraColor: 0x4dffc3, space: 0, spaceTint: 0x05050a, fog: 0x05050a, fogDensity: 0.0045, sunDisc: false },
];

export const LIGHT_PRESETS: LightPreset[] = [
    { id: "noon", name: "g.build.light.noon", ambient: 0xffffff, ambientIntensity: 0.35, hemiSky: 0xcfe6ff, hemiGround: 0x6b6455, hemiIntensity: 0.8, sun: 0xfff4de, sunIntensity: 2.2 },
    { id: "morning", name: "g.build.light.morning", ambient: 0xffe9d0, ambientIntensity: 0.3, hemiSky: 0xffe0bd, hemiGround: 0x6a6154, hemiIntensity: 0.65, sun: 0xffd7a1, sunIntensity: 1.8 },
    { id: "evening", name: "g.build.light.evening", ambient: 0xffcf9e, ambientIntensity: 0.26, hemiSky: 0xffb583, hemiGround: 0x4a3f38, hemiIntensity: 0.55, sun: 0xff9b52, sunIntensity: 1.5 },
    { id: "moonlit", name: "g.build.light.moonlit", ambient: 0x8fa8d8, ambientIntensity: 0.2, hemiSky: 0x6f86c0, hemiGround: 0x1a1d26, hemiIntensity: 0.4, sun: 0xaec6ff, sunIntensity: 0.6 },
    { id: "neon", name: "g.build.light.neon", ambient: 0xb478ff, ambientIntensity: 0.36, hemiSky: 0x7be0ff, hemiGround: 0x35124a, hemiIntensity: 0.75, sun: 0xff7bd0, sunIntensity: 1.1 },
    { id: "studio", name: "g.build.light.studio", ambient: 0xffffff, ambientIntensity: 0.7, hemiSky: 0xffffff, hemiGround: 0xbdbdbd, hemiIntensity: 0.85, sun: 0xffffff, sunIntensity: 1.2 },
    { id: "overcast", name: "g.build.light.overcast", ambient: 0xdfe6ee, ambientIntensity: 0.5, hemiSky: 0xc9d6e2, hemiGround: 0x5c5f5a, hemiIntensity: 0.9, sun: 0xd9e2ec, sunIntensity: 0.7 },
];

export function getSkyPreset(id: string): SkyPreset {
    return SKY_PRESETS.find((preset) => preset.id === id) ?? SKY_PRESETS[0];
}

export function getLightPreset(id: string): LightPreset {
    return LIGHT_PRESETS.find((preset) => preset.id === id) ?? LIGHT_PRESETS[0];
}

export function skyDaylight(preset: SkyPreset): number {
    return THREE.MathUtils.clamp((preset.elevation + 4) / 14, 0, 1);
}

function createStarField(radius: number, count: number, size: number, seed: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const theta = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * Math.PI * 2;
        const phi = Math.acos(((Math.sin(i * 78.233 + seed) * 12345.6789) % 1 + 1) % 1 * 2 - 1);

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi));
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

        const warm = ((Math.sin(i * 3.17 + seed) + 1) / 2);
        color.setHSL(0.55 + warm * 0.12, 0.35, 0.72 + warm * 0.2);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return new THREE.Points(geometry, new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: false,
        fog: false,
    }));
}

export class BuildEnvironmentRig {
    private sky: EditorSky;
    private stars: THREE.Points;
    private brightStars: THREE.Points;
    private moon: THREE.Mesh;
    private moonGlow: THREE.Mesh;

    private ambient: THREE.AmbientLight;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;
    private sunTarget: THREE.Object3D;

    private sunDirection = new THREE.Vector3(0, 1, 0);
    private elapsed = 0;

    constructor(private scene: THREE.Scene, radius: number) {
        this.sky = new EditorSky();
        this.sky.scale.setScalar(14000);
        this.sky.renderOrder = -1000;
        this.sky.frustumCulled = false;
        this.scene.add(this.sky);

        this.stars = createStarField(5000, 2200, 1.6, 17);
        this.stars.renderOrder = -999;
        this.stars.frustumCulled = false;
        this.scene.add(this.stars);

        this.brightStars = createStarField(4900, 180, 3.4, 91);
        this.brightStars.renderOrder = -999;
        this.brightStars.frustumCulled = false;
        this.scene.add(this.brightStars);

        this.moon = new THREE.Mesh(
            new THREE.SphereGeometry(80, 24, 16),
            new THREE.MeshBasicMaterial({ color: 0xe6ecfa, fog: false, depthWrite: false })
        );
        this.moon.renderOrder = -998;
        this.scene.add(this.moon);

        this.moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(190, 20, 14),
            new THREE.MeshBasicMaterial({
                color: 0x9fb6e8,
                fog: false,
                depthWrite: false,
                transparent: true,
                opacity: 0.16,
                side: THREE.BackSide,
            })
        );
        this.moonGlow.renderOrder = -998;
        this.scene.add(this.moonGlow);

        this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambient);

        this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(this.hemisphere);

        this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 600;

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

        const uniforms = this.sky.material.uniforms;
        uniforms.turbidity.value = sky.turbidity;
        uniforms.rayleigh.value = sky.rayleigh;
        uniforms.mieCoefficient.value = sky.mieCoefficient;
        uniforms.mieDirectionalG.value = sky.mieDirectionalG;
        uniforms.cloudCoverage.value = sky.cloudCoverage;
        uniforms.cloudDensity.value = sky.cloudDensity;
        uniforms.cloudSpeed.value = sky.cloudSpeed;
        uniforms.cloudElevation.value = sky.cloudElevation;
        uniforms.showSunDisc.value = sky.sunDisc ? 1 : 0;
        uniforms.auroraStrength.value = sky.aurora;
        (uniforms.auroraColor.value as THREE.Color).setHex(sky.auroraColor);
        uniforms.spaceAmount.value = sky.space;
        (uniforms.spaceTint.value as THREE.Color).setHex(sky.spaceTint);

        const phi = THREE.MathUtils.degToRad(90 - sky.elevation);
        const theta = THREE.MathUtils.degToRad(sky.azimuth);
        this.sunDirection.setFromSphericalCoords(1, phi, theta);
        (uniforms.sunPosition.value as THREE.Vector3).copy(this.sunDirection);

        const blackout = sky.rayleigh <= 0.001 && sky.space <= 0.001;
        this.sky.visible = !blackout;
        this.scene.background = blackout ? new THREE.Color(0x02020a) : null;

        for (const field of [this.stars, this.brightStars]) {
            (field.material as THREE.PointsMaterial).opacity = sky.stars;
            field.visible = sky.stars > 0.01;
        }

        const moonVisible = sky.elevation < 6 && sky.space < 0.5;
        this.moon.visible = moonVisible;
        this.moonGlow.visible = moonVisible;

        this.scene.fog = new THREE.FogExp2(new THREE.Color(sky.fog), sky.fogDensity);

        this.ambient.color.setHex(light.ambient);
        this.ambient.intensity = light.ambientIntensity;

        this.hemisphere.color.setHex(light.hemiSky);
        this.hemisphere.groundColor.setHex(light.hemiGround);
        this.hemisphere.intensity = light.hemiIntensity;

        const daylight = skyDaylight(sky);
        this.sun.color.setHex(light.sun);
        this.sun.intensity = light.sunIntensity * (0.25 + 0.75 * daylight);
        this.sun.castShadow = this.sun.intensity > 0.25;

        this.followTarget(this.sunTarget.position.x, this.sunTarget.position.z);
    }

    public followTarget(x: number, z: number) {
        this.sky.position.set(x, 0, z);
        this.stars.position.set(x, 0, z);
        this.brightStars.position.set(x, 0, z);

        const moonX = x - this.sunDirection.x * 3500;
        const moonY = Math.abs(this.sunDirection.y) * 2200 + 400;
        const moonZ = z - this.sunDirection.z * 3500;
        this.moon.position.set(moonX, moonY, moonZ);
        this.moonGlow.position.set(moonX, moonY, moonZ);

        const height = Math.max(0.3, Math.abs(this.sunDirection.y));
        this.sun.position.set(
            x + this.sunDirection.x * 150,
            height * 190,
            z + this.sunDirection.z * 150
        );
        this.sunTarget.position.set(x, 0, z);
        this.sunTarget.updateMatrixWorld();
    }

    public update(delta: number) {
        this.elapsed += delta;
        this.sky.material.uniforms.time.value = this.elapsed;

        if (this.stars.visible) {
            this.stars.rotation.y += delta * 0.002;
            this.brightStars.rotation.y += delta * 0.002;
        }
    }

    public dispose() {
        this.sky.geometry.dispose();
        this.sky.material.dispose();
        this.stars.geometry.dispose();
        (this.stars.material as THREE.Material).dispose();
        this.brightStars.geometry.dispose();
        (this.brightStars.material as THREE.Material).dispose();
        this.moon.geometry.dispose();
        (this.moon.material as THREE.Material).dispose();
        this.moonGlow.geometry.dispose();
        (this.moonGlow.material as THREE.Material).dispose();

        this.scene.background = null;
        this.scene.fog = null;
        this.scene.remove(
            this.sky, this.stars, this.brightStars, this.moon, this.moonGlow,
            this.ambient, this.hemisphere, this.sun, this.sunTarget
        );
    }
}
