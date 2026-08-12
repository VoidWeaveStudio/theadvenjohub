// src/features/game/world/locations/main-world/systems/CavePortalSystem.ts
import * as THREE from "three";
import { createRandom } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import { CAVE_PORTAL_X, CAVE_PORTAL_Z } from "../worldConfig";

const ARCH_RADIUS = 3.6;
const ARCH_THICKNESS = 0.62;
const STONE_COUNT = 9;

const veilVertexShader = /* glsl */`
    varying vec2 vVeilUv;

    void main() {
        vVeilUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const veilFragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uInnerColor;
    uniform vec3 uOuterColor;

    varying vec2 vVeilUv;

    void main() {
        vec2 centered = vVeilUv - 0.5;
        float radius = length(centered) * 2.0;
        float angle = atan(centered.y, centered.x);

        float swirl = sin(angle * 4.0 + uTime * 1.6 - radius * 9.0) * 0.5 + 0.5;
        float core = 1.0 - smoothstep(0.0, 0.95, radius);
        float rim = smoothstep(0.72, 0.98, radius) * (1.0 - smoothstep(0.98, 1.0, radius));

        vec3 color = mix(uOuterColor, uInnerColor, core * (0.55 + swirl * 0.45));
        float alpha = core * (0.32 + swirl * 0.4) + rim * 0.85;

        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
`;

export class CavePortalSystem {
    public readonly position = new THREE.Vector3();

    private group: THREE.Group | null = null;
    private veil: THREE.Mesh | null = null;
    private light: THREE.PointLight | null = null;
    private readonly uniforms;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uInnerColor: { value: new THREE.Color(0x8ad8ff) },
            uOuterColor: { value: new THREE.Color(0x1b2f6b) },
        };
    }

    public create(): THREE.Object3D {
        const groundY = this.terrain.getHeightAt(CAVE_PORTAL_X, CAVE_PORTAL_Z);
        this.position.set(CAVE_PORTAL_X, groundY, CAVE_PORTAL_Z);

        const group = new THREE.Group();
        group.position.copy(this.position);
        group.userData.interactionId = "cave-portal";

        const random = createRandom(5150);
        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4741,
            roughness: 0.93,
            metalness: 0.03,
            flatShading: true,
        });

        for (let i = 0; i < STONE_COUNT; i++) {
            const t = i / (STONE_COUNT - 1);
            const angle = Math.PI * (0.08 + t * 0.84);
            const stone = new THREE.Mesh(
                new THREE.DodecahedronGeometry(ARCH_THICKNESS * (0.85 + random() * 0.5), 0),
                stoneMaterial
            );
            stone.position.set(
                Math.cos(angle) * ARCH_RADIUS,
                Math.sin(angle) * ARCH_RADIUS,
                (random() - 0.5) * 0.3
            );
            stone.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
            stone.castShadow = true;
            stone.receiveShadow = true;
            group.add(stone);
        }

        for (const side of [-1, 1]) {
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.95, 1.25, 1.1, 7),
                stoneMaterial
            );
            base.position.set(side * ARCH_RADIUS, 0.4, 0);
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
        }

        this.veil = new THREE.Mesh(
            new THREE.CircleGeometry(ARCH_RADIUS * 0.92, 48),
            new THREE.ShaderMaterial({
                uniforms: this.uniforms,
                vertexShader: veilVertexShader,
                fragmentShader: veilFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false,
            })
        );
        this.veil.position.y = ARCH_RADIUS * 0.55;
        this.veil.renderOrder = 4;
        group.add(this.veil);

        this.light = new THREE.PointLight(0x6fc8ff, 4, 24, 2);
        this.light.position.set(0, ARCH_RADIUS * 0.6, 0);
        this.light.castShadow = false;
        group.add(this.light);

        this.scene.add(group);
        this.group = group;

        return group;
    }

    public update(delta: number) {
        this.uniforms.uTime.value += delta;
        if (this.light) {
            this.light.intensity = 3.4 + Math.sin(this.uniforms.uTime.value * 2.2) * 0.9;
        }
    }

    public dispose() {
        if (!this.group) return;

        this.scene.remove(this.group);
        this.group.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            const material = mesh.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material?.dispose();
        });

        this.group = null;
        this.veil = null;
        this.light = null;
    }
}
