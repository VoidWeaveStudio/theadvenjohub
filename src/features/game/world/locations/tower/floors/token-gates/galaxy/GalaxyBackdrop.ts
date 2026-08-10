// src/features/game/world/locations/tower/floors/token-gates/galaxy/GalaxyBackdrop.ts
import * as THREE from "three";
import { GALAXY, hashInt } from "./GalaxyLayout";

const STAR_COUNT = 2600;
const STAR_SHELL_RADIUS = 4200;
const DUST_COUNT = 3200;
const NEBULA_COUNT = 64;
const ARM_COUNT = 2;
const ARM_TWIST = 0.0022;

let sharedNebulaTexture: THREE.Texture | null = null;

function getNebulaTexture(): THREE.Texture {
    if (sharedNebulaTexture) return sharedNebulaTexture;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < 26; i++) {
        const x = size * (0.2 + Math.random() * 0.6);
        const y = size * (0.2 + Math.random() * 0.6);
        const r = size * (0.08 + Math.random() * 0.26);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, "rgba(255,255,255,0.10)");
        gradient.addColorStop(0.5, "rgba(255,255,255,0.04)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }

    const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.72, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);

    sharedNebulaTexture = new THREE.CanvasTexture(canvas);
    return sharedNebulaTexture;
}

const starVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aTint;
varying vec3 vTint;
void main() {
    vTint = aTint;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const starFragment = /* glsl */ `
varying vec3 vTint;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vTint, alpha);
}
`;

const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uOmega;
attribute float aRadius;
attribute float aPhase;
attribute float aY;
attribute float aSize;
attribute float aTwinkle;
attribute vec3 aTint;
varying vec3 vTint;
varying float vFade;
void main() {
    float angle = aPhase + uOmega * uTime;
    vec3 orbit = vec3(cos(angle) * aRadius, aY, sin(angle) * aRadius);
    vec4 mvPosition = modelViewMatrix * vec4(orbit, 1.0);
    float dist = -mvPosition.z;

    float twinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aTwinkle * 2.4) + aTwinkle * 31.0);

    vTint = aTint;
    vFade = clamp(1.0 - dist / 5200.0, 0.0, 1.0) * twinkle;
    gl_PointSize = clamp(aSize * (900.0 / max(dist, 1.0)), 0.0, 26.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const dustFragment = /* glsl */ `
varying vec3 vTint;
varying float vFade;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * 0.34 * vFade;
    gl_FragColor = vec4(vTint, alpha);
}
`;

const nebulaVertex = /* glsl */ `
uniform float uTime;
uniform float uOmega;
attribute float aRadius;
attribute float aPhase;
attribute float aY;
attribute float aSize;
attribute vec3 aTint;
varying vec3 vTint;
varying float vFade;
void main() {
    float angle = aPhase + uOmega * uTime;
    vec3 orbit = vec3(cos(angle) * aRadius, aY, sin(angle) * aRadius);
    vec4 mvPosition = modelViewMatrix * vec4(orbit, 1.0);
    float dist = -mvPosition.z;

    vTint = aTint;
    vFade = smoothstep(120.0, 700.0, dist) * clamp(1.0 - dist / 6000.0, 0.0, 1.0);
    gl_PointSize = clamp(aSize * (900.0 / max(dist, 1.0)), 0.0, 260.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const nebulaFragment = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vTint;
varying float vFade;
void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    if (texel.a <= 0.001) discard;
    gl_FragColor = vec4(vTint, texel.a * vFade * 1.6);
}
`;

export interface GalaxyBackdropOptions {
    withStars?: boolean;
    withBackground?: boolean;
    withLights?: boolean;
}

export class GalaxyBackdrop {
    private stars: THREE.Points | null = null;
    private dust!: THREE.Points;
    private nebula!: THREE.Points;
    private orbitUniforms!: { uTime: { value: number }; uOmega: { value: number } };
    private nebulaUniforms!: { uTime: { value: number }; uOmega: { value: number }; uMap: { value: THREE.Texture } };

    constructor(private scene: THREE.Object3D, private options: GalaxyBackdropOptions = {}) { }

    create() {
        const { withStars = true, withBackground = true, withLights = true } = this.options;

        if (withBackground && (this.scene as THREE.Scene).isScene) {
            (this.scene as THREE.Scene).background = new THREE.Color(0x05030f);
        }
        if (withStars) this.buildStars();
        this.buildDust();
        this.buildNebula();
        if (withLights) this.buildAmbientLight();
    }

    private armPhase(seed: number, radius: number, spread: number): number {
        const arm = Math.floor(seed * ARM_COUNT);
        const offset = (seed * ARM_COUNT - arm - 0.5) * spread;
        return (arm / ARM_COUNT) * Math.PI * 2 + radius * ARM_TWIST + offset;
    }

    private buildStars() {
        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes = new Float32Array(STAR_COUNT);
        const tints = new Float32Array(STAR_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < STAR_COUNT; i++) {
            const h1 = hashInt(i * 7919) / 4294967296;
            const h2 = hashInt(i * 104729 + 13) / 4294967296;
            const h3 = hashInt(i * 15485863 + 7) / 4294967296;

            const theta = h1 * Math.PI * 2;
            const phi = Math.acos(2 * h2 - 1);
            const r = STAR_SHELL_RADIUS * (0.75 + h3 * 0.25);

            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            positions[i * 3 + 1] = Math.cos(phi) * r;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

            sizes[i] = 1.0 + h3 * 2.4;
            color.setHSL(0.55 + h1 * 0.16, 0.35 + h2 * 0.4, 0.72 + h3 * 0.22);
            tints[i * 3] = color.r;
            tints[i * 3 + 1] = color.g;
            tints[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

        const material = new THREE.ShaderMaterial({
            vertexShader: starVertex,
            fragmentShader: starFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.stars = new THREE.Points(geometry, material);
        this.stars.frustumCulled = false;
        this.stars.renderOrder = -20;
        this.scene.add(this.stars);
    }

    private buildDust() {
        const positions = new Float32Array(DUST_COUNT * 3);
        const radii = new Float32Array(DUST_COUNT);
        const phases = new Float32Array(DUST_COUNT);
        const ys = new Float32Array(DUST_COUNT);
        const sizes = new Float32Array(DUST_COUNT);
        const twinkles = new Float32Array(DUST_COUNT);
        const tints = new Float32Array(DUST_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < DUST_COUNT; i++) {
            const h1 = hashInt(i * 2654435761) / 4294967296;
            const h2 = hashInt(i * 40503 + 991) / 4294967296;
            const h3 = hashInt(i * 92837111 + 5) / 4294967296;
            const h4 = hashInt(i * 19349663 + 17) / 4294967296;

            const radius = GALAXY.coreBubbleRadius * 1.6 + Math.pow(h1, 0.65) * (GALAXY.maxRadius * 0.85);
            const spread = 1.1 + (1 - Math.min(1, radius / GALAXY.maxRadius)) * 1.5;

            radii[i] = radius;
            phases[i] = this.armPhase(h2, radius, spread);
            ys[i] = (h3 - 0.5) * GALAXY.diskThickness * 1.5;
            sizes[i] = 10 + h3 * 34;
            twinkles[i] = h4;

            color.setHSL(0.58 + h2 * 0.2, 0.75, 0.5 + h1 * 0.28);
            tints[i * 3] = color.r;
            tints[i * 3 + 1] = color.g;
            tints[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
        geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute("aY", new THREE.BufferAttribute(ys, 1));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 1));
        geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

        this.orbitUniforms = { uTime: { value: 0 }, uOmega: { value: 0 } };

        const material = new THREE.ShaderMaterial({
            uniforms: this.orbitUniforms,
            vertexShader: dustVertex,
            fragmentShader: dustFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.dust = new THREE.Points(geometry, material);
        this.dust.frustumCulled = false;
        this.dust.renderOrder = -15;
        this.scene.add(this.dust);
    }

    private buildNebula() {
        const positions = new Float32Array(NEBULA_COUNT * 3);
        const radii = new Float32Array(NEBULA_COUNT);
        const phases = new Float32Array(NEBULA_COUNT);
        const ys = new Float32Array(NEBULA_COUNT);
        const sizes = new Float32Array(NEBULA_COUNT);
        const tints = new Float32Array(NEBULA_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < NEBULA_COUNT; i++) {
            const h1 = hashInt(i * 6700417 + 3) / 4294967296;
            const h2 = hashInt(i * 999983 + 41) / 4294967296;
            const h3 = hashInt(i * 15485867 + 29) / 4294967296;

            const radius = GALAXY.coreBubbleRadius * 2.2 + Math.pow(h1, 0.7) * (GALAXY.maxRadius * 0.9);

            radii[i] = radius;
            phases[i] = this.armPhase(h2, radius, 2.4);
            ys[i] = (h3 - 0.5) * GALAXY.diskThickness * 2.2;
            sizes[i] = 260 + h1 * 520;

            color.setHSL(0.60 + h2 * 0.22, 0.7, 0.42 + h3 * 0.2);
            tints[i * 3] = color.r;
            tints[i * 3 + 1] = color.g;
            tints[i * 3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
        geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute("aY", new THREE.BufferAttribute(ys, 1));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

        this.nebulaUniforms = {
            uTime: { value: 0 },
            uOmega: { value: 0 },
            uMap: { value: getNebulaTexture() },
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.nebulaUniforms,
            vertexShader: nebulaVertex,
            fragmentShader: nebulaFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.nebula = new THREE.Points(geometry, material);
        this.nebula.frustumCulled = false;
        this.nebula.renderOrder = -18;
        this.scene.add(this.nebula);
    }

    private buildAmbientLight() {
        this.scene.add(new THREE.AmbientLight(0x8899ff, 0.55));

        const coreLight = new THREE.PointLight(0xffd28a, 3.2, GALAXY.maxRadius * 1.2, 1.4);
        coreLight.position.set(0, 0, 0);
        this.scene.add(coreLight);

        const rim = new THREE.DirectionalLight(0x6f8cff, 0.6);
        rim.position.set(-400, 600, -300);
        this.scene.add(rim);
    }

    update(orbitTime: number) {
        const omega = (Math.PI * 2) / GALAXY.orbitPeriodSec;

        this.orbitUniforms.uTime.value = orbitTime;
        this.orbitUniforms.uOmega.value = omega;
        this.nebulaUniforms.uTime.value = orbitTime;
        this.nebulaUniforms.uOmega.value = omega * 0.85;
    }

    dispose() {
        [this.stars, this.dust, this.nebula].forEach((points: THREE.Points | null) => {
            if (!points) return;
            points.geometry.dispose();
            (points.material as THREE.Material).dispose();
            this.scene.remove(points);
        });
    }
}
