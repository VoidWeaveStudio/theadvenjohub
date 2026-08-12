// src/features/game/entities/spawnShield.ts
import * as THREE from "three";

const DOME_RADIUS = 1.12;
const DOME_CENTER_Y = 0.95;
const DOME_STRETCH_Y = 1.32;
const RING_INNER = 0.62;
const RING_OUTER = 1.75;

const domeVertexShader = /* glsl */`
    varying vec3 vNormalW;
    varying vec3 vViewW;
    varying vec2 vUvW;

    void main() {
        vUvW = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const domeFragmentShader = /* glsl */`
    uniform float uTime;
    uniform float uIntensity;
    uniform float uFlash;
    uniform vec3 uColor;
    uniform vec3 uEdgeColor;

    varying vec3 vNormalW;
    varying vec3 vViewW;
    varying vec2 vUvW;

    float hexEdge(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h;
        vec2 b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 q = abs(g);
        return max(q.x * 0.8660254 + q.y * 0.5, q.y);
    }

    void main() {
        float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));
        float fresnel = pow(1.0 - facing, 2.6);

        float band = max(sin(vUvW.y * 3.14159), 0.35);
        float cells = smoothstep(0.33, 0.5, hexEdge(vec2(vUvW.x * 34.0 * band, vUvW.y * 17.0)));

        float scan = smoothstep(0.87, 1.0, sin((vUvW.y * 4.5 - uTime * 0.5) * 6.28318));
        float shimmer = 0.78 + 0.22 * sin(uTime * 4.0 + vUvW.x * 18.0);

        float alpha = fresnel * 0.5 + cells * fresnel * 0.6 + scan * 0.32 + uFlash * 0.45;
        alpha *= uIntensity * shimmer;

        vec3 color = mix(uColor, uEdgeColor, fresnel) + scan * 0.35 + uFlash * 0.6;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
`;

const ringVertexShader = /* glsl */`
    varying vec2 vUvW;

    void main() {
        vUvW = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const ringFragmentShader = /* glsl */`
    uniform float uTime;
    uniform float uIntensity;
    uniform float uFlash;
    uniform vec3 uColor;

    varying vec2 vUvW;

    void main() {
        float d = clamp(length(vUvW - 0.5) * 2.0, 0.0, 1.0);
        float body = smoothstep(0.5, 0.88, d) * (1.0 - smoothstep(0.94, 1.0, d));
        float wave = fract(d * 2.2 - uTime * 0.75);
        float pulse = smoothstep(0.72, 1.0, wave) * 0.7;

        float alpha = (body * 0.42 + pulse * body + uFlash * body * 1.6) * uIntensity;
        gl_FragColor = vec4(uColor + uFlash * 0.5, clamp(alpha, 0.0, 1.0));
    }
`;

export class SpawnShield {
    public readonly group: THREE.Group;

    private readonly dome: THREE.Mesh;
    private readonly ring: THREE.Mesh;
    private readonly domeUniforms;
    private readonly ringUniforms;

    private active = false;
    private time = 0;
    private intensity = 0;
    private flash = 0;

    constructor() {
        this.group = new THREE.Group();
        this.group.renderOrder = 8;

        this.domeUniforms = {
            uTime: { value: 0 },
            uIntensity: { value: 0 },
            uFlash: { value: 0 },
            uColor: { value: new THREE.Color(0x2fb6ff) },
            uEdgeColor: { value: new THREE.Color(0xcdf3ff) },
        };

        this.ringUniforms = {
            uTime: { value: 0 },
            uIntensity: { value: 0 },
            uFlash: { value: 0 },
            uColor: { value: new THREE.Color(0x54d8ff) },
        };

        this.dome = new THREE.Mesh(
            new THREE.SphereGeometry(DOME_RADIUS, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: this.domeUniforms,
                vertexShader: domeVertexShader,
                fragmentShader: domeFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false,
            })
        );
        this.dome.position.y = DOME_CENTER_Y;
        this.dome.scale.set(1, DOME_STRETCH_Y, 1);

        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(RING_INNER, RING_OUTER, 48),
            new THREE.ShaderMaterial({
                uniforms: this.ringUniforms,
                vertexShader: ringVertexShader,
                fragmentShader: ringFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false,
            })
        );
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.06;

        this.group.add(this.dome, this.ring);
        this.group.visible = false;
    }

    public setActive(active: boolean) {
        if (this.active === active) return;
        this.active = active;
        if (active) {
            this.flash = 1;
            this.group.visible = true;
        }
    }

    public isVisible(): boolean {
        return this.group.visible;
    }

    public update(delta: number, ownerRotationY: number) {
        if (!this.group.visible) return;

        this.time += delta;
        this.flash = Math.max(0, this.flash - delta * 2.4);

        const target = this.active ? 1 : 0;
        const speed = this.active ? 12 : 5;
        this.intensity += (target - this.intensity) * Math.min(1, delta * speed);

        if (!this.active && this.intensity < 0.01) {
            this.group.visible = false;
            this.intensity = 0;
            return;
        }

        const grow = this.active ? 1 - (1 - this.intensity) * 0.42 : 1 + (1 - this.intensity) * 0.3;

        this.group.rotation.y = -ownerRotationY;
        this.dome.scale.set(grow, DOME_STRETCH_Y * grow, grow);
        this.ring.scale.setScalar(grow);

        this.domeUniforms.uTime.value = this.time;
        this.domeUniforms.uIntensity.value = this.intensity;
        this.domeUniforms.uFlash.value = this.flash;

        this.ringUniforms.uTime.value = this.time;
        this.ringUniforms.uIntensity.value = this.intensity;
        this.ringUniforms.uFlash.value = this.flash;
    }

    public dispose() {
        this.group.removeFromParent();
        this.dome.geometry.dispose();
        (this.dome.material as THREE.Material).dispose();
        this.ring.geometry.dispose();
        (this.ring.material as THREE.Material).dispose();
    }
}
