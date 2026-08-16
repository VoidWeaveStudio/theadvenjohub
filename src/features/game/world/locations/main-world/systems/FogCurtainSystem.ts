// src/features/game/world/locations/main-world/systems/FogCurtainSystem.ts
import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";

const CURTAIN_HEIGHT = 110;
const CURTAIN_SINK = 14;
const CURTAIN_SEGMENTS = 96;
const SAMPLE_STEPS = 48;

const curtainVertexShader = /* glsl */`
    varying vec2 vCurtainUv;
    varying vec3 vCurtainWorld;

    void main() {
        vCurtainUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vCurtainWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const curtainFragmentShader = /* glsl */`
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uBottom;
    uniform float uTop;
    uniform float uStrength;

    varying vec2 vCurtainUv;
    varying vec3 vCurtainWorld;

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

    float fbm(vec2 p) {
        float sum = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            sum += noise(p) * amplitude;
            p *= 2.07;
            amplitude *= 0.5;
        }
        return sum;
    }

    void main() {
        float height = clamp((vCurtainWorld.y - uBottom) / max(uTop - uBottom, 1.0), 0.0, 1.0);
        float body = 1.0 - smoothstep(0.16, 0.86, height);

        vec2 flow = vec2(vCurtainUv.x * 34.0 + uTime * 0.035, height * 5.0 - uTime * 0.05);
        float billow = fbm(flow);
        float wisps = fbm(flow * 2.6 + vec2(uTime * 0.02, -uTime * 0.04));

        float alpha = body * (0.62 + billow * 0.55) + wisps * body * 0.22;
        alpha = clamp(alpha * uStrength, 0.0, 1.0);
        if (alpha < 0.006) discard;

        vec3 color = uColor * (0.86 + billow * 0.3);

        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export class FogCurtainSystem {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private radius: number | null = null;

    private readonly uniforms;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        fogColor: THREE.Color
    ) {
        this.uniforms = {
            uColor: { value: fogColor },
            uTime: { value: 0 },
            uBottom: { value: 0 },
            uTop: { value: CURTAIN_HEIGHT },
            uStrength: { value: 1 },
        };
    }

    public setRadius(radius: number | null) {
        if (this.radius === radius) return;
        this.radius = radius;

        this.dispose();
        if (radius === null) return;

        let lowest = Infinity;
        for (let i = 0; i < SAMPLE_STEPS; i++) {
            const angle = (i / SAMPLE_STEPS) * Math.PI * 2;
            const height = this.terrain.getHeightAt(Math.sin(angle) * radius, -Math.cos(angle) * radius);
            if (height < lowest) lowest = height;
        }

        const bottom = lowest - CURTAIN_SINK;
        this.uniforms.uBottom.value = bottom;
        this.uniforms.uTop.value = bottom + CURTAIN_HEIGHT;

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: curtainVertexShader,
            fragmentShader: curtainFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
            fog: false,
        });

        const geometry = new THREE.CylinderGeometry(radius, radius, CURTAIN_HEIGHT, CURTAIN_SEGMENTS, 1, true);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.name = "fog-curtain";
        this.mesh.position.y = bottom + CURTAIN_HEIGHT / 2;
        this.mesh.renderOrder = 1;
        this.mesh.frustumCulled = false;
        this.mesh.matrixAutoUpdate = false;
        this.mesh.updateMatrix();

        this.scene.add(this.mesh);
    }

    public update(delta: number) {
        this.uniforms.uTime.value += delta;
    }

    public dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }

        this.material?.dispose();
        this.material = null;
    }
}
