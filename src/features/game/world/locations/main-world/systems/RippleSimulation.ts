// src/features/game/world/locations/main-world/systems/RippleSimulation.ts
import * as THREE from "three";
import type { DepthMap } from "../utils/waterDepthMap";

const MAX_DROPS = 8;
const STEP_SECONDS = 1 / 60;
const MAX_SUBSTEPS = 3;

interface Drop {
    x: number;
    z: number;
    radius: number;
    strength: number;
    dx: number;
    dz: number;
}

const simulationVertexShader = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const simulationFragmentShader = /* glsl */`
    precision highp float;

    varying vec2 vUv;

    uniform sampler2D uState;
    uniform sampler2D uBedMap;
    uniform vec4 uBounds;
    uniform float uTexel;
    uniform float uBedOrigin;
    uniform float uBedScale;
    uniform float uWaterLevel;
    uniform float uDamping;
    uniform float uSpeedScale;

    uniform vec2 uDropPos[${MAX_DROPS}];
    uniform vec2 uDropData[${MAX_DROPS}];
    uniform vec2 uDropDir[${MAX_DROPS}];
    uniform int uDropCount;

    float bedHeight(vec2 world) {
        vec2 uv = (world - vec2(uBedOrigin)) * uBedScale;
        return texture2D(uBedMap, clamp(uv, 0.0, 1.0)).r;
    }

    float depthAt(vec2 uv) {
        vec2 world = uBounds.xy + uv * uBounds.zw;
        return max(uWaterLevel - bedHeight(world), 0.0);
    }

    void main() {
        vec2 state = texture2D(uState, vUv).rg;
        float current = state.r;
        float previous = state.g;

        float left = texture2D(uState, vUv + vec2(-uTexel, 0.0)).r;
        float right = texture2D(uState, vUv + vec2(uTexel, 0.0)).r;
        float down = texture2D(uState, vUv + vec2(0.0, -uTexel)).r;
        float up = texture2D(uState, vUv + vec2(0.0, uTexel)).r;

        float laplacian = (left + right + down + up) - 4.0 * current;

        float depth = depthAt(vUv);
        float speed = clamp(sqrt(9.81 * depth) * uSpeedScale, 0.0, 0.68);

        float next = (2.0 * current - previous + speed * speed * laplacian) * uDamping;
        next *= smoothstep(0.0, 0.22, depth);

        for (int i = 0; i < ${MAX_DROPS}; i++) {
            if (i >= uDropCount) break;

            vec2 toDrop = vUv - uDropPos[i];
            float radius = uDropData[i].x;
            float distance = length(toDrop);
            if (distance > radius) continue;

            float falloff = 1.0 - smoothstep(0.0, radius, distance);
            float directional = 1.0 + dot(normalize(toDrop + 1e-5), uDropDir[i]) * 0.85;
            next += falloff * falloff * uDropData[i].y * directional;
        }

        gl_FragColor = vec4(clamp(next, -1.5, 1.5), current, 0.0, 1.0);
    }
`;

const scrollFragmentShader = /* glsl */`
    precision highp float;

    varying vec2 vUv;
    uniform sampler2D uState;
    uniform vec2 uOffset;

    void main() {
        vec2 uv = vUv + uOffset;
        bool outside = any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)));
        gl_FragColor = outside ? vec4(0.0) : texture2D(uState, uv);
    }
`;

export class RippleSimulation {
    public readonly bounds = new THREE.Vector4();

    private targetA: THREE.WebGLRenderTarget;
    private targetB: THREE.WebGLRenderTarget;
    private readonly simulationMaterial: THREE.ShaderMaterial;
    private readonly scrollMaterial: THREE.ShaderMaterial;
    private readonly quad: THREE.Mesh;
    private readonly quadScene = new THREE.Scene();
    private readonly quadCamera = new THREE.Camera();

    private readonly drops: Drop[] = [];
    private accumulator = 0;
    private readonly resolution: number;
    private readonly fieldSize: number;
    private readonly scratch = new THREE.Vector2();

    constructor(
        private readonly renderer: THREE.WebGLRenderer,
        private readonly bedMap: DepthMap,
        waterLevel: number,
        fieldSize: number,
        resolution: number
    ) {
        this.resolution = resolution;
        this.fieldSize = fieldSize;
        this.bounds.set(-fieldSize / 2, -fieldSize / 2, fieldSize, fieldSize);

        const options: THREE.RenderTargetOptions = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
        };

        this.targetA = new THREE.WebGLRenderTarget(resolution, resolution, options);
        this.targetB = new THREE.WebGLRenderTarget(resolution, resolution, options);

        const cellSize = fieldSize / resolution;

        this.simulationMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uState: { value: null },
                uBedMap: { value: bedMap.texture },
                uBounds: { value: this.bounds },
                uTexel: { value: 1 / resolution },
                uBedOrigin: { value: bedMap.origin },
                uBedScale: { value: bedMap.scale },
                uWaterLevel: { value: waterLevel },
                uDamping: { value: 0.994 },
                uSpeedScale: { value: STEP_SECONDS / cellSize },
                uDropPos: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector2()) },
                uDropData: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector2()) },
                uDropDir: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector2()) },
                uDropCount: { value: 0 },
            },
            vertexShader: simulationVertexShader,
            fragmentShader: simulationFragmentShader,
            depthTest: false,
            depthWrite: false,
        });

        this.scrollMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uState: { value: null },
                uOffset: { value: new THREE.Vector2() },
            },
            vertexShader: simulationVertexShader,
            fragmentShader: scrollFragmentShader,
            depthTest: false,
            depthWrite: false,
        });

        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simulationMaterial);
        this.quad.frustumCulled = false;
        this.quadScene.add(this.quad);

        this.clear();
    }

    public get texture(): THREE.Texture {
        return this.targetA.texture;
    }

    private clear() {
        const previous = this.renderer.getRenderTarget();
        for (const target of [this.targetA, this.targetB]) {
            this.renderer.setRenderTarget(target);
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.clear(true, false, false);
        }
        this.renderer.setRenderTarget(previous);
    }

    public addDrop(x: number, z: number, radius: number, strength: number, dx = 0, dz = 0) {
        if (this.drops.length >= MAX_DROPS * 3) return;
        this.drops.push({ x, z, radius, strength, dx, dz });
    }

    public recenter(centerX: number, centerZ: number) {
        const cellSize = this.fieldSize / this.resolution;
        const targetMinX = centerX - this.fieldSize * 0.5;
        const targetMinZ = centerZ - this.fieldSize * 0.5;

        const shiftX = Math.round((targetMinX - this.bounds.x) / cellSize);
        const shiftZ = Math.round((targetMinZ - this.bounds.y) / cellSize);
        if (shiftX === 0 && shiftZ === 0) return;

        this.scrollMaterial.uniforms.uState.value = this.targetA.texture;
        this.scrollMaterial.uniforms.uOffset.value.set(shiftX / this.resolution, shiftZ / this.resolution);

        this.quad.material = this.scrollMaterial;
        const previous = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(this.targetB);
        this.renderer.render(this.quadScene, this.quadCamera);
        this.renderer.setRenderTarget(previous);
        this.quad.material = this.simulationMaterial;

        this.swap();

        this.bounds.x += shiftX * cellSize;
        this.bounds.y += shiftZ * cellSize;
    }

    public step(delta: number) {
        this.accumulator += Math.min(delta, 0.05);

        let steps = 0;
        while (this.accumulator >= STEP_SECONDS && steps < MAX_SUBSTEPS) {
            this.accumulator -= STEP_SECONDS;
            steps++;

            const uniforms = this.simulationMaterial.uniforms;
            const taken = Math.min(this.drops.length, MAX_DROPS);

            for (let i = 0; i < taken; i++) {
                const drop = this.drops[i];
                this.scratch.set(
                    (drop.x - this.bounds.x) / this.bounds.z,
                    (drop.z - this.bounds.y) / this.bounds.w
                );
                uniforms.uDropPos.value[i].copy(this.scratch);
                uniforms.uDropData.value[i].set(drop.radius / this.bounds.z, drop.strength);
                uniforms.uDropDir.value[i].set(drop.dx, drop.dz);
            }

            uniforms.uDropCount.value = taken;
            uniforms.uState.value = this.targetA.texture;
            this.drops.splice(0, taken);

            const previous = this.renderer.getRenderTarget();
            this.renderer.setRenderTarget(this.targetB);
            this.renderer.render(this.quadScene, this.quadCamera);
            this.renderer.setRenderTarget(previous);

            this.swap();
        }
    }

    private swap() {
        const temp = this.targetA;
        this.targetA = this.targetB;
        this.targetB = temp;
    }

    public dispose() {
        this.targetA.dispose();
        this.targetB.dispose();
        this.simulationMaterial.dispose();
        this.scrollMaterial.dispose();
        this.quad.geometry.dispose();
    }
}
