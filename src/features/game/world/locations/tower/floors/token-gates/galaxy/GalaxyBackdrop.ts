// src/features/game/world/locations/tower/floors/token-gates/galaxy/GalaxyBackdrop.ts
import * as THREE from "three";
import { GALAXY, hashInt } from "./GalaxyLayout";

const STAR_COUNT = 2600;
const STAR_SHELL_RADIUS = 4200;
const DUST_COUNT = 1800;

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
attribute vec3 aTint;
varying vec3 vTint;
varying float vFade;
void main() {
    float angle = aPhase + uOmega * uTime;
    vec3 orbit = vec3(cos(angle) * aRadius, aY, sin(angle) * aRadius);
    vec4 mvPosition = modelViewMatrix * vec4(orbit, 1.0);
    float dist = -mvPosition.z;
    vTint = aTint;
    vFade = clamp(1.0 - dist / 4000.0, 0.0, 1.0);
    gl_PointSize = aSize * (900.0 / max(dist, 1.0));
    gl_Position = projectionMatrix * mvPosition;
}
`;

const dustFragment = /* glsl */ `
varying vec3 vTint;
varying float vFade;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * 0.28 * vFade;
    gl_FragColor = vec4(vTint, alpha);
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
    private core!: THREE.Group;
    private dustUniforms!: { uTime: { value: number }; uOmega: { value: number } };

    constructor(private scene: THREE.Object3D, private options: GalaxyBackdropOptions = {}) { }

    create() {
        const { withStars = true, withBackground = true, withLights = true } = this.options;

        if (withBackground && (this.scene as THREE.Scene).isScene) {
            (this.scene as THREE.Scene).background = new THREE.Color(0x05030f);
        }
        if (withStars) this.buildStars();
        this.buildDust();
        this.buildCoreGlow();
        if (withLights) this.buildAmbientLight();
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
        const tints = new Float32Array(DUST_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < DUST_COUNT; i++) {
            const h1 = hashInt(i * 2654435761) / 4294967296;
            const h2 = hashInt(i * 40503 + 991) / 4294967296;
            const h3 = hashInt(i * 92837111 + 5) / 4294967296;

            const radius = GALAXY.coreBubbleRadius * 2 + Math.pow(h1, 0.6) * (GALAXY.maxRadius * 0.75);
            radii[i] = radius;
            phases[i] = h2 * Math.PI * 2 + radius * 0.0016;
            ys[i] = (h3 - 0.5) * GALAXY.diskThickness * 1.6;
            sizes[i] = 14 + h3 * 40;

            color.setHSL(0.62 + h2 * 0.14, 0.7, 0.55 + h1 * 0.2);
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

        this.dustUniforms = { uTime: { value: 0 }, uOmega: { value: 0 } };

        const material = new THREE.ShaderMaterial({
            uniforms: this.dustUniforms,
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

    private buildCoreGlow() {
        this.core = new THREE.Group();

        const discGeometry = new THREE.RingGeometry(GALAXY.coreBubbleRadius * 1.4, GALAXY.maxRadius * 0.7, 96, 1);
        const discMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a3ea8,
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
        });
        const disc = new THREE.Mesh(discGeometry, discMaterial);
        disc.rotation.x = -Math.PI / 2;
        this.core.add(disc);

        this.core.renderOrder = -12;
        this.scene.add(this.core);
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
        this.dustUniforms.uTime.value = orbitTime;
        this.dustUniforms.uOmega.value = (Math.PI * 2) / GALAXY.orbitPeriodSec;
    }

    dispose() {
        [this.stars, this.dust].forEach((points: THREE.Points | null) => {
            if (!points) return;
            points.geometry.dispose();
            (points.material as THREE.Material).dispose();
            this.scene.remove(points);
        });
        if (this.core) {
            this.core.traverse((obj) => {
                const mesh = obj as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.geometry.dispose();
                    (mesh.material as THREE.Material).dispose();
                }
            });
            this.scene.remove(this.core);
        }
    }
}
