// src/features/game/world/locations/main-world/systems/CavePortalSystem.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import { CAVE_PORTAL_X, CAVE_PORTAL_Z } from "../worldConfig";

const INNER_RADIUS = 3.3;
const OUTER_RADIUS = 4.5;
const ARCH_DEPTH = 1.5;
const VOUSSOIR_COUNT = 15;
const PIER_HEIGHT = 3.4;
const PIER_BLOCKS = 5;
const RUNE_COUNT = 7;

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
    uniform vec3 uSparkColor;

    varying vec2 vVeilUv;

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
            p *= 2.03;
            amplitude *= 0.5;
        }
        return sum;
    }

    void main() {
        vec2 centered = vVeilUv - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;

        float angle = atan(centered.y, centered.x);

        float spin = angle * 1.5 + uTime * 0.55 - radius * 2.4;
        vec2 flow = vec2(cos(spin), sin(spin)) * (0.55 - radius * 0.35);
        float turbulence = fbm(flow * 3.2 + vec2(uTime * 0.22, -uTime * 0.16));

        float funnel = pow(1.0 - radius, 1.7);
        float depth = smoothstep(0.0, 0.85, funnel + turbulence * 0.55 - 0.18);

        float rim = smoothstep(0.82, 0.995, radius) * (1.0 - smoothstep(0.995, 1.0, radius));
        float filaments = pow(turbulence, 3.0) * (1.0 - radius) * 2.2;

        vec3 color = mix(uOuterColor, uInnerColor, depth);
        color += uSparkColor * filaments;
        color += uSparkColor * rim * 1.4;

        float alpha = clamp(depth * 0.72 + rim * 0.9 + filaments * 0.5, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
    }
`;

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
    const flattened = parts.map((part) => {
        const flat = part.getIndex() ? part.toNonIndexed() : part;
        for (const name of Object.keys(flat.attributes)) {
            if (name !== "position" && name !== "normal" && name !== "uv") flat.deleteAttribute(name);
        }
        return flat;
    });

    parts.forEach((part, index) => {
        if (flattened[index] !== part) part.dispose();
    });

    const merged = mergeGeometries(flattened, false);
    flattened.forEach((part) => part.dispose());
    return merged;
}

function voussoirGeometry(startAngle: number, endAngle: number, inner: number, outer: number, depth: number) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, startAngle, endAngle, false);
    shape.absarc(0, 0, inner, endAngle, startAngle, true);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.055,
        bevelThickness: 0.05,
        bevelSegments: 1,
        curveSegments: 3,
    });

    geometry.translate(0, 0, -depth / 2);
    return geometry;
}

export class CavePortalSystem {
    public readonly position = new THREE.Vector3();

    private group: THREE.Group | null = null;
    private veil: THREE.Mesh | null = null;
    private light: THREE.PointLight | null = null;
    private runes: THREE.Mesh | null = null;
    private readonly uniforms;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uInnerColor: { value: new THREE.Color(0x0a1a3c) },
            uOuterColor: { value: new THREE.Color(0x2f7fd6) },
            uSparkColor: { value: new THREE.Color(0x9fe4ff) },
        };
    }

    private buildStonework(random: () => number): THREE.BufferGeometry {
        const parts: THREE.BufferGeometry[] = [];
        const gap = 0.012;
        const span = Math.PI / VOUSSOIR_COUNT;

        for (let i = 0; i < VOUSSOIR_COUNT; i++) {
            const start = i * span + gap;
            const end = (i + 1) * span - gap;
            const jitter = 1 + (random() - 0.5) * 0.09;

            const geometry = voussoirGeometry(
                start,
                end,
                INNER_RADIUS,
                OUTER_RADIUS * jitter,
                ARCH_DEPTH * (0.9 + random() * 0.2)
            );
            geometry.translate(0, PIER_HEIGHT, 0);
            parts.push(geometry);
        }

        for (const side of [-1, 1]) {
            for (let i = 0; i < PIER_BLOCKS; i++) {
                const height = PIER_HEIGHT / PIER_BLOCKS;
                const width = (OUTER_RADIUS - INNER_RADIUS) * (1 + (random() - 0.5) * 0.16);
                const block = new THREE.BoxGeometry(width, height * 0.94, ARCH_DEPTH * (0.92 + random() * 0.16));

                block.translate(
                    side * (INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) / 2) + (random() - 0.5) * 0.08,
                    height * (i + 0.5),
                    (random() - 0.5) * 0.1
                );
                parts.push(block);
            }

            const footing = new THREE.BoxGeometry(
                (OUTER_RADIUS - INNER_RADIUS) * 1.55,
                0.55,
                ARCH_DEPTH * 1.4
            );
            footing.translate(side * (INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) / 2), 0.2, 0);
            parts.push(footing);
        }

        for (let i = 0; i < 9; i++) {
            const angle = random() * Math.PI * 2;
            const distance = OUTER_RADIUS * (0.75 + random() * 0.7);
            const size = 0.22 + random() * 0.5;
            const rubble = new THREE.DodecahedronGeometry(size, 0);
            rubble.rotateX(random() * Math.PI);
            rubble.rotateY(random() * Math.PI);
            rubble.translate(Math.cos(angle) * distance, size * 0.45, Math.sin(angle) * distance);
            parts.push(rubble);
        }

        const merged = mergeParts(parts);
        if (!merged) throw new Error("portal stonework merge failed");

        merged.computeVertexNormals();
        merged.computeBoundingSphere();
        return merged;
    }

    private buildRunes(): THREE.BufferGeometry | null {
        const parts: THREE.BufferGeometry[] = [];

        for (let i = 0; i < RUNE_COUNT; i++) {
            const angle = Math.PI * (0.12 + (i / (RUNE_COUNT - 1)) * 0.76);
            const plate = new THREE.PlaneGeometry(0.34, 0.13);
            plate.rotateY(Math.PI / 2);
            plate.rotateZ(angle);
            plate.translate(
                Math.cos(angle) * (INNER_RADIUS + 0.06),
                Math.sin(angle) * (INNER_RADIUS + 0.06) + PIER_HEIGHT,
                0
            );
            parts.push(plate);
        }

        for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const plate = new THREE.PlaneGeometry(0.3, 0.12);
                plate.rotateY(Math.PI / 2);
                plate.translate(side * (INNER_RADIUS + 0.06), 0.75 + i * 0.9, 0);
                parts.push(plate);
            }
        }

        return mergeParts(parts);
    }

    public setPosition(x: number, z: number) {
        this.position.set(x, this.terrain.getHeightAt(x, z), z);

        if (this.group) {
            this.group.position.copy(this.position);
            this.group.rotation.y = Math.atan2(x, z) + Math.PI;
            this.group.updateMatrixWorld();
        }
    }

    public setActive(active: boolean) {
        if (this.group) this.group.visible = active;
    }

    public create(): THREE.Object3D {
        const groundY = this.terrain.getHeightAt(CAVE_PORTAL_X, CAVE_PORTAL_Z);
        this.position.set(CAVE_PORTAL_X, groundY, CAVE_PORTAL_Z);

        const group = new THREE.Group();
        group.position.copy(this.position);
        group.rotation.y = Math.PI * 0.12;
        group.visible = false;
        group.userData.interactionId = "cave-portal";

        const random = createRandom(5150);

        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: 0x5d5a52,
            roughness: 0.88,
            metalness: 0.04,
            flatShading: true,
        });

        const stonework = new THREE.Mesh(this.buildStonework(random), stoneMaterial);
        stonework.castShadow = true;
        stonework.receiveShadow = true;
        stonework.matrixAutoUpdate = false;
        stonework.updateMatrix();
        group.add(stonework);

        const runeGeometry = this.buildRunes();
        if (runeGeometry) {
            this.runes = new THREE.Mesh(
                runeGeometry,
                new THREE.MeshBasicMaterial({
                    color: 0x8fdcff,
                    transparent: true,
                    opacity: 0.85,
                    side: THREE.DoubleSide,
                    toneMapped: false,
                    depthWrite: false,
                })
            );
            this.runes.renderOrder = 3;
            group.add(this.runes);
        }

        this.veil = new THREE.Mesh(
            new THREE.CircleGeometry(INNER_RADIUS * 0.99, 64),
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
        this.veil.position.y = PIER_HEIGHT;
        this.veil.renderOrder = 4;
        group.add(this.veil);

        this.light = new THREE.PointLight(0x6fc8ff, 4, 26, 2);
        this.light.position.set(0, PIER_HEIGHT + 0.6, 0);
        this.light.castShadow = false;
        group.add(this.light);

        this.scene.add(group);
        this.group = group;

        return group;
    }

    public update(delta: number) {
        this.uniforms.uTime.value += delta;

        const pulse = Math.sin(this.uniforms.uTime.value * 2.2);
        if (this.light) this.light.intensity = 3.6 + pulse * 1.1;

        if (this.runes) {
            const material = this.runes.material as THREE.MeshBasicMaterial;
            material.opacity = 0.6 + pulse * 0.25;
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
        this.runes = null;
    }
}
