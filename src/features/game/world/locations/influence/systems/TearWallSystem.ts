// src/features/game/world/locations/influence/systems/TearWallSystem.ts
import * as THREE from "three";
import { PORTAL_NOISE_GLSL, getPortalNoiseTexture } from "../../../portalNoise";
import { CITY_BOUNDARY } from "../cityLayout";
import { CITY_TEAR_HEIGHT } from "../cityMesh";

const BASE_Y = -6;
const SEGMENTS_PER_EDGE = 2;

const tearVertexShader = /* glsl */`
    varying vec2 vTearUv;
    varying vec3 vWorld;

    void main() {
        vTearUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const tearFragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uVoidColor;
    uniform vec3 uEdgeColor;
    uniform vec3 uSparkColor;
    uniform float uHeight;

    varying vec2 vTearUv;
    varying vec3 vWorld;

    ${PORTAL_NOISE_GLSL}

    void main() {
        float rise = vTearUv.y;

        float ragged = fbm(vec2(vTearUv.x * 26.0, uTime * 0.04)) * 0.55
            + fbm2(vec2(vTearUv.x * 61.0, uTime * 0.017)) * 0.45;

        float lip = 0.055 + ragged * 0.2;
        if (rise < lip) discard;

        float drift = fbm(vec2(vTearUv.x * 9.0 - uTime * 0.05, rise * 3.4 + uTime * 0.09));
        float filaments = pow(fbm2(vec2(vTearUv.x * 34.0 + uTime * 0.11, rise * 7.0)), 3.2);

        float fade = 1.0 - smoothstep(lip, 1.0, rise);
        float body = smoothstep(0.0, 0.35, fade + drift * 0.4 - 0.1);

        float seam = smoothstep(lip, lip + 0.035, rise) * (1.0 - smoothstep(lip + 0.035, lip + 0.16, rise));

        vec3 color = mix(uVoidColor, uEdgeColor, body * 0.7);
        color += uSparkColor * filaments * 2.4 * fade;
        color += uSparkColor * seam * 2.2;

        float alpha = clamp(body * 0.82 + seam * 0.95 + filaments * 0.6, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha * 0.92);
    }
`;

export class TearWallSystem {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private readonly uniforms = {
        uTime: { value: 0 },
        uNoise: { value: getPortalNoiseTexture() },
        uVoidColor: { value: new THREE.Color(0x05040c) },
        uEdgeColor: { value: new THREE.Color(0x2a1553) },
        uSparkColor: { value: new THREE.Color(0xb388ff) },
        uHeight: { value: CITY_TEAR_HEIGHT },
    };

    constructor(private readonly scene: THREE.Scene) { }

    create() {
        const points: { x: number; z: number }[] = [];
        for (let i = 0; i < CITY_BOUNDARY.length; i++) {
            const p = CITY_BOUNDARY[i];
            const q = CITY_BOUNDARY[(i + 1) % CITY_BOUNDARY.length];
            for (let k = 0; k < SEGMENTS_PER_EDGE; k++) {
                const t = k / SEGMENTS_PER_EDGE;
                points.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
            }
        }

        const count = points.length;
        const position: number[] = [];
        const uv: number[] = [];
        const top = CITY_TEAR_HEIGHT;

        let travelled = 0;
        const arc: number[] = [0];
        for (let i = 1; i <= count; i++) {
            const a = points[i - 1];
            const b = points[i % count];
            travelled += Math.hypot(b.x - a.x, b.z - a.z);
            arc.push(travelled);
        }

        const cycles = 26;
        for (let i = 0; i < count; i++) {
            const a = points[i];
            const b = points[(i + 1) % count];
            const u0 = (arc[i] / travelled) * cycles;
            const u1 = (arc[i + 1] / travelled) * cycles;

            position.push(a.x, BASE_Y, a.z, b.x, BASE_Y, b.z, b.x, top, b.z);
            uv.push(u0, 0, u1, 0, u1, 1);

            position.push(a.x, BASE_Y, a.z, b.x, top, b.z, a.x, top, a.z);
            uv.push(u0, 0, u1, 1, u0, 1);

            position.push(b.x, BASE_Y, b.z, a.x, BASE_Y, a.z, a.x, top, a.z);
            uv.push(u1, 0, u0, 0, u0, 1);

            position.push(b.x, BASE_Y, b.z, a.x, top, a.z, b.x, top, b.z);
            uv.push(u1, 0, u0, 1, u1, 1);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geometry.computeBoundingSphere();

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: tearVertexShader,
            fragmentShader: tearFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.name = "influence-tear";
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 6;
        this.scene.add(this.mesh);
    }

    update(delta: number) {
        this.uniforms.uTime.value += delta;
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }
        this.material?.dispose();
        this.mesh = null;
        this.material = null;
    }
}
