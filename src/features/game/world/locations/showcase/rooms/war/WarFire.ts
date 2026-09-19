// src/features/game/world/locations/showcase/rooms/war/WarFire.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

// Two layers is enough for depth once the shader is doing the shaping, and it keeps the
// draw count per fire close to what the old sprite version cost.
const SHEETS_PER_FIRE = 2;

export interface Fire {
    group: THREE.Group;
    sheets: THREE.Mesh[];
    light: THREE.PointLight | null;
    glow: THREE.Mesh;
    scale: number;
    phase: number;
    smokeTimer: number;
}

// A camera-facing quad built in the vertex stage: the flame has to keep its silhouette
// from every angle, and rotating three crossed planes the old way showed their edges.
const fireVertex = /* glsl */ `
uniform float uWidth;
uniform float uHeight;
uniform float uLean;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.x += position.x * uWidth + uLean * uv.y * uHeight;
    mv.y += position.y * uHeight;
    gl_Position = projectionMatrix * mv;
}
`;

// Scrolling turbulence eats away a tapered mask from the tips down, and whatever
// survives is coloured by how much of it is left — that is what gives licking tongues
// and a white-hot core instead of a glowing sprite.
const fireFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform sampler2D uNoise;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    // Three layers drifting at rates with no common multiple: a single scrolling sheet
    // visibly repeats on its own period, this does not settle into a loop.
    float n1 = texture2D(uNoise, vec2(uv.x * 0.9 + uSeed, uv.y * 0.55 - uTime * 0.23)).r;
    float n2 = texture2D(uNoise, vec2(uv.x * 1.7 - uSeed * 0.6, uv.y * 0.95 - uTime * 0.37)).g;
    float n3 = texture2D(uNoise, vec2(uv.x * 3.1 + uSeed * 1.7, uv.y * 1.6 - uTime * 0.61)).b;
    float turbulence = n1 * 0.46 + n2 * 0.34 + n3 * 0.20;

    // Silhouette: a column that narrows with height, nudged sideways by the slowest
    // layer so the whole flame leans and recovers instead of shimmering in place.
    float taper = max(1.0 - uv.y, 0.0);
    float halfWidth = 0.46 * pow(taper, 0.45);
    float lateral = abs(uv.x - 0.5 + (n1 - 0.5) * 0.3 * uv.y * uv.y);
    float body = 1.0 - smoothstep(halfWidth * 0.25, halfWidth, lateral);

    // Same idea as the reference flame: one field, then separate falloffs for how much
    // is drawn and how hot it looks, which keeps the edge soft instead of chattering.
    float field = body * (1.1 - uv.y * 0.8) - turbulence * (0.14 + uv.y * 1.5);
    if (field <= 0.0) discard;

    float alpha = smoothstep(0.0, 0.34, field);
    float heat = smoothstep(0.02, 0.62, field);

    vec3 color = mix(uEdge, uMid, smoothstep(0.0, 0.55, heat));
    color = mix(color, uCore, smoothstep(0.55, 1.0, heat));

    // The root always stays hot so the flame sits into whatever is burning.
    color = mix(color, uCore, smoothstep(0.2, 0.0, uv.y) * 0.6);

    gl_FragColor = vec4(color, alpha * 0.9);
}
`;

// Fireball: the sphere is eaten away by the same turbulence as the flames while it
// expands, so it churns and breaks up instead of inflating as a clean shell.
export const blastVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const blastFragment = /* glsl */ `
uniform float uProgress;
uniform float uSeed;
uniform sampler2D uNoise;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
    float n1 = texture2D(uNoise, vUv * 2.0 + vec2(uSeed, uSeed * 0.7 - uProgress * 0.22)).r;
    float n2 = texture2D(uNoise, vUv * 4.3 - vec2(uSeed * 0.5, uProgress * 0.45)).g;
    float turbulence = n1 * 0.62 + n2 * 0.38;

    float dissolve = turbulence - uProgress * 1.3;
    if (dissolve <= -0.3) discard;

    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float heat = clamp((1.0 - uProgress) * (0.3 + facing * 0.95) + turbulence * 0.4, 0.0, 1.0);

    vec3 color = mix(vec3(0.30, 0.04, 0.01), vec3(1.0, 0.42, 0.07), smoothstep(0.14, 0.55, heat));
    color = mix(color, vec3(1.0, 0.94, 0.74), smoothstep(0.72, 1.0, heat));

    float alpha = smoothstep(-0.3, 0.12, dissolve) * (1.0 - uProgress * 0.8);
    gl_FragColor = vec4(color, alpha);
}
`;

export class WarFireSystem {
    private readonly fires: Fire[] = [];
    private noise: THREE.CanvasTexture | null = null;
    private glowMaterial: THREE.MeshBasicMaterial | null = null;
    private charMaterial: THREE.MeshStandardMaterial | null = null;
    private quad: THREE.PlaneGeometry | null = null;
    private chunk: THREE.BufferGeometry | null = null;

    constructor(
        private readonly scene: THREE.Object3D,
        private readonly bin: AssetBin,
        private readonly random: () => number
    ) { }

    public prepare(glowMap: THREE.Texture, noise: THREE.CanvasTexture) {
        this.noise = noise;

        const quad = new THREE.PlaneGeometry(1, 1);
        quad.translate(0, 0.5, 0);
        this.quad = this.bin.geometry(quad) as THREE.PlaneGeometry;

        this.chunk = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));

        this.glowMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: glowMap,
            color: 0xff8a3a,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        this.charMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x14100d,
            roughness: 0.98,
            metalness: 0.05,
        }));
    }

    public add(position: THREE.Vector3, scale = 1, withLight = true, charred = true): Fire {
        const group = new THREE.Group();
        group.position.copy(position);

        const sheets: THREE.Mesh[] = [];
        for (let i = 0; i < SHEETS_PER_FIRE; i++) {
            const material = this.bin.material(new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: this.random() * 10 },
                    uSeed: { value: this.random() * 8 },
                    uNoise: { value: this.noise },
                    uWidth: { value: (1.5 - i * 0.32) * scale },
                    uHeight: { value: (2.4 - i * 0.45) * scale },
                    uLean: { value: (this.random() - 0.5) * 0.25 * scale },
                    uCore: { value: new THREE.Color(0xfff2c4) },
                    uMid: { value: new THREE.Color(0xff9c2e) },
                    uEdge: { value: new THREE.Color(0x8c1c06) },
                },
                vertexShader: fireVertex,
                fragmentShader: fireFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: false,
            }));

            const sheet = new THREE.Mesh(this.quad!, material);
            sheet.frustumCulled = false;
            sheet.renderOrder = 5;
            group.add(sheet);
            sheets.push(sheet);
        }

        const glow = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(1, 20)), this.glowMaterial!);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.04;
        glow.scale.setScalar(1.15 * scale);
        glow.renderOrder = 3;
        group.add(glow);

        // Something has to be on fire — bare ground lit up on its own was the tell.
        if (charred) {
            const count = 2 + Math.floor(this.random() * 2);
            for (let i = 0; i < count; i++) {
                const angle = this.random() * Math.PI * 2;
                const distance = scale * (0.1 + this.random() * 0.45);
                const size = scale * (0.16 + this.random() * 0.24);

                const debris = new THREE.Mesh(this.chunk!, this.charMaterial!);
                debris.position.set(Math.cos(angle) * distance, size * 0.35, Math.sin(angle) * distance);
                debris.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3);
                debris.scale.set(size, size * 0.62, size);
                debris.castShadow = true;
                group.add(debris);
            }
        }

        let light: THREE.PointLight | null = null;
        if (withLight) {
            light = new THREE.PointLight(0xff7326, 16 * scale, 24 * scale, 2);
            light.position.y = 1.1 * scale;
            group.add(light);
        }

        this.scene.add(group);

        const fire: Fire = {
            group,
            sheets,
            light,
            glow,
            scale,
            phase: this.random() * 9,
            smokeTimer: this.random(),
        };
        this.fires.push(fire);
        return fire;
    }

    public update(delta: number, elapsed: number, emitSmoke: (position: THREE.Vector3, scale: number) => void, probe: THREE.Vector3) {
        for (const fire of this.fires) {
            // Slow, smooth only. Driving the quad's height off a fast sine made the whole
            // flame pump up and down every frame, which is what read as jerky.
            const flicker = 0.9 + Math.sin(elapsed * 2.1 + fire.phase) * 0.06 + Math.sin(elapsed * 3.7 + fire.phase * 1.7) * 0.04;

            for (let i = 0; i < fire.sheets.length; i++) {
                const material = fire.sheets[i].material as THREE.ShaderMaterial;
                material.uniforms.uTime.value += delta * (0.9 + i * 0.13);
            }

            (fire.glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + flicker * 0.16;

            if (fire.light) fire.light.intensity = 14 * fire.scale * flicker;

            fire.smokeTimer -= delta;
            if (fire.smokeTimer <= 0) {
                fire.smokeTimer = 0.85 + this.random() * 0.9;
                probe.set(
                    fire.group.position.x + (this.random() - 0.5) * fire.scale * 0.8,
                    fire.group.position.y + fire.scale * 1.9,
                    fire.group.position.z + (this.random() - 0.5) * fire.scale * 0.8
                );
                emitSmoke(probe, fire.scale);
            }
        }
    }
}
