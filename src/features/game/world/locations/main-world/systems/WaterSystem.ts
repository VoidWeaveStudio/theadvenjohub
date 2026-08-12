// src/features/game/world/locations/main-world/systems/WaterSystem.ts
import * as THREE from "three";
import type { TerrainSystem } from "./TerrainSystem";
import { SEA_LEVEL, WORLD_SIZE } from "../worldConfig";

const OCEAN_EXTENT = WORLD_SIZE * 2.6;
const OCEAN_SEGMENTS = 96;
const LAKE_SEGMENTS = 40;

const waterVertexShader = /* glsl */`
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveScale;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;

    float waveAt(vec2 p) {
        return sin(p.x * uWaveScale + uTime * 0.9) * 0.6
             + sin((p.y * 1.3 - p.x * 0.4) * uWaveScale * 1.7 + uTime * 1.35) * 0.28
             + sin((p.x * 0.7 + p.y * 0.9) * uWaveScale * 3.1 - uTime * 1.9) * 0.12;
    }

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);

        float h = waveAt(world.xz) * uWaveHeight;
        float hx = waveAt(world.xz + vec2(1.6, 0.0)) * uWaveHeight;
        float hz = waveAt(world.xz + vec2(0.0, 1.6)) * uWaveHeight;

        world.y += h;
        vWorldPos = world.xyz;
        vWaveNormal = normalize(vec3(h - hx, 1.2, h - hz));

        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const waterFragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform float uOpacity;

    varying vec3 vWorldPos;
    varying vec3 vWaveNormal;

    void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - clamp(dot(normalize(vWaveNormal), viewDir), 0.0, 1.0), 2.6);

        float ripple = sin(vWorldPos.x * 0.35 + uTime * 1.4) * sin(vWorldPos.z * 0.31 - uTime * 1.1);
        float sparkle = smoothstep(0.72, 1.0, ripple) * 0.35;

        vec3 color = mix(uDeepColor, uShallowColor, clamp(fresnel * 1.4, 0.0, 1.0));
        color += uFoamColor * sparkle;

        float alpha = clamp(uOpacity + fresnel * 0.35 + sparkle * 0.4, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
    }
`;

export class WaterSystem {
    private readonly meshes: THREE.Mesh[] = [];
    private readonly material: THREE.ShaderMaterial;
    private readonly uniforms;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uWaveHeight: { value: 0.42 },
            uWaveScale: { value: 0.055 },
            uShallowColor: { value: new THREE.Color(0x4a9ec0) },
            uDeepColor: { value: new THREE.Color(0x0c2c44) },
            uFoamColor: { value: new THREE.Color(0xbfe6ff) },
            uOpacity: { value: 0.72 },
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
            const disc = new THREE.Mesh(
                new THREE.CircleGeometry(lake.radius * 0.99, LAKE_SEGMENTS),
                this.material
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

    public getWaterHeightAt(x: number, z: number): number | null {
        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz > lake.radius * lake.radius) continue;
            return this.terrain.getHeightAt(x, z) < lake.level ? lake.level : null;
        }

        return this.terrain.getHeightAt(x, z) < SEA_LEVEL ? SEA_LEVEL : null;
    }

    public update(delta: number) {
        this.uniforms.uTime.value += delta;
    }

    public dispose() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.meshes.length = 0;
        this.material.dispose();
    }
}
