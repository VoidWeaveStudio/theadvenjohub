// src/features/game/world/liftCrystal.ts
import * as THREE from "three";
import { PORTAL_NOISE_GLSL, getPortalNoiseTexture } from "./portalNoise";

const ORB_HEIGHT = 1.6;
// Glass look of the shell, tuned by eye — these three are the knobs if it reads
// too solid or too faint.
const SHELL_OPACITY = 0.38;
const SHELL_ROUGHNESS = 0.06;
const SHELL_ENV_INTENSITY = 1.6;
const MOTE_COUNT = 70;
const MOTE_RADIUS = 1.15;
const MOTE_RISE = 3.1;

const coreVertexShader = /* glsl */`
    uniform float uTime;
    uniform float uPulse;

    varying vec3 vLocal;
    varying vec3 vNormalW;
    varying vec3 vViewW;

    void main() {
        vec3 dir = normalize(position);
        float wobble =
            sin(dir.y * 5.0 + uTime * 1.7) * 0.5 +
            sin(dir.x * 4.0 - uTime * 1.3) * 0.3 +
            sin(dir.z * 6.0 + uTime * 2.1) * 0.2;

        vec3 displaced = position + dir * wobble * 0.055 * (0.6 + uPulse * 0.7);

        vLocal = normalize(displaced);
        vNormalW = normalize(mat3(modelMatrix) * normal);

        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vViewW = normalize(cameraPosition - world.xyz);

        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const coreFragmentShader = /* glsl */`
    uniform float uTime;
    uniform float uPulse;
    uniform vec3 uHot;
    uniform vec3 uMid;
    uniform vec3 uCold;

    varying vec3 vLocal;
    varying vec3 vNormalW;
    varying vec3 vViewW;

    ${PORTAL_NOISE_GLSL}

    void main() {
        float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));

        float swirl = atan(vLocal.z, vLocal.x) * 1.5 + uTime * 0.6;
        vec3 flow = vec3(cos(swirl), vLocal.y * 2.2 - uTime * 0.45, sin(swirl));

        float plasma = fbm3(flow * 2.4);
        float filament = fbm3(flow * 6.1 + vec3(0.0, uTime * 0.7, 0.0));

        float heat = smoothstep(0.28, 0.78, plasma + uPulse * 0.18);
        float veins = pow(smoothstep(0.42, 0.78, filament), 1.8);

        vec3 color = mix(uCold, uMid, heat);
        color = mix(color, uHot, veins * 0.85);
        color += uHot * pow(1.0 - facing, 2.4) * 0.7;

        float alpha = 0.55 + heat * 0.3 + veins * 0.35 + pow(1.0 - facing, 3.0) * 0.4;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
`;

function createMoteTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.28, "rgba(170,240,255,0.85)");
    gradient.addColorStop(1, "rgba(110,180,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export class LiftCrystal {
    public readonly group: THREE.Group;

    private readonly shell: THREE.Mesh;
    private readonly core: THREE.Mesh;
    private readonly halo: THREE.Sprite;
    private readonly motes: THREE.Points;
    private readonly light: THREE.PointLight;

    private readonly coreUniforms;
    private readonly shellMaterial: THREE.MeshPhysicalMaterial;
    private readonly haloTexture: THREE.CanvasTexture;
    private readonly moteMaterial: THREE.PointsMaterial;
    private readonly moteTexture: THREE.CanvasTexture;
    private readonly motePhase: Float32Array;

    private time = 0;

    constructor() {
        this.group = new THREE.Group();

        // No `transmission` here, deliberately. A transmissive material makes
        // three.js run renderTransmissionPass() every frame the mesh is in the
        // frustum: the whole opaque scene is drawn a second time into a
        // full-viewport render target forced to at least 4x MSAA, resolved, and
        // mipmapped. That is why turning to face a portal used to cost more than
        // the rest of the frame put together, on any quality preset. The crystal
        // sits in every tower floor, the main world, the canyon and the basement,
        // so the pass was running almost everywhere.
        //
        // Opacity replaces the see-through that transmission used to provide;
        // it is the one value worth eyeballing if the glass reads too thin.
        this.shellMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x9fd8ff,
            roughness: SHELL_ROUGHNESS,
            metalness: 0,
            iridescence: 1,
            iridescenceIOR: 1.9,
            iridescenceThicknessRange: [120, 620],
            transparent: true,
            opacity: SHELL_OPACITY,
            envMapIntensity: SHELL_ENV_INTENSITY,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        this.shell = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 2), this.shellMaterial);
        this.shell.name = "portal-shell";
        this.shell.position.y = ORB_HEIGHT;
        this.shell.renderOrder = 2;

        this.coreUniforms = {
            uTime: { value: 0 },
            uPulse: { value: 0 },
            uNoise: { value: getPortalNoiseTexture() },
            uHot: { value: new THREE.Color(0xffffff) },
            uMid: { value: new THREE.Color(0x2ff0ff) },
            uCold: { value: new THREE.Color(0x5b1bd6) },
        };

        this.core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.52, 3),
            new THREE.ShaderMaterial({
                uniforms: this.coreUniforms,
                vertexShader: coreVertexShader,
                fragmentShader: coreFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.FrontSide,
                fog: false,
                toneMapped: false,
            })
        );
        this.core.name = "portal-core";
        this.core.position.y = ORB_HEIGHT;
        this.core.renderOrder = 3;

        this.haloTexture = createMoteTexture();
        this.halo = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: this.haloTexture,
                color: 0x6fd8ff,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: false,
                toneMapped: false,
            })
        );
        this.halo.position.y = ORB_HEIGHT;
        this.halo.scale.setScalar(5.4);
        this.halo.renderOrder = 1;

        const positions = new Float32Array(MOTE_COUNT * 3);
        this.motePhase = new Float32Array(MOTE_COUNT * 3);

        for (let i = 0; i < MOTE_COUNT; i++) {
            this.motePhase[i * 3] = Math.random() * Math.PI * 2;
            this.motePhase[i * 3 + 1] = Math.random();
            this.motePhase[i * 3 + 2] = 0.55 + Math.random() * 0.85;
        }

        const moteGeometry = new THREE.BufferGeometry();
        moteGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        moteGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, ORB_HEIGHT, 0), 4);

        this.moteTexture = createMoteTexture();
        this.moteMaterial = new THREE.PointsMaterial({
            map: this.moteTexture,
            color: 0xbdf3ff,
            size: 0.13,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        });

        this.motes = new THREE.Points(moteGeometry, this.moteMaterial);
        this.motes.name = "portal-motes";
        this.motes.renderOrder = 3;

        this.light = new THREE.PointLight(0x59d8ff, 6, 30, 2);
        this.light.position.y = ORB_HEIGHT;
        this.light.castShadow = false;

        this.group.add(this.halo, this.shell, this.core, this.motes, this.light);
    }

    public update(delta: number) {
        this.time += delta;

        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.15);

        this.coreUniforms.uTime.value = this.time;
        this.coreUniforms.uPulse.value = pulse;

        this.shell.rotation.y += delta * 0.22;
        this.shell.rotation.x += delta * 0.09;
        this.core.rotation.y -= delta * 0.35;

        this.shellMaterial.iridescenceIOR = 1.6 + pulse * 0.55;
        this.halo.scale.setScalar(4.9 + pulse * 0.9);
        (this.halo.material as THREE.SpriteMaterial).opacity = 0.26 + pulse * 0.22;
        const swell = 1 + pulse * 0.06;
        this.shell.scale.setScalar(swell);
        this.core.scale.setScalar(1 + pulse * 0.12);

        const attribute = this.motes.geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;

        for (let i = 0; i < MOTE_COUNT; i++) {
            const angle = this.motePhase[i * 3];
            const speed = this.motePhase[i * 3 + 2];

            let rise = this.motePhase[i * 3 + 1] + delta * speed * 0.22;
            if (rise > 1) rise -= 1;
            this.motePhase[i * 3 + 1] = rise;

            const spin = angle + this.time * speed * 0.85;
            const taper = Math.sin(rise * Math.PI) * MOTE_RADIUS;

            array[i * 3] = Math.cos(spin) * taper;
            array[i * 3 + 1] = rise * MOTE_RISE;
            array[i * 3 + 2] = Math.sin(spin) * taper;
        }

        attribute.needsUpdate = true;

        this.moteMaterial.opacity = 0.55 + pulse * 0.35;
        this.light.intensity = 4.5 + pulse * 2.6;
    }

    public dispose() {
        this.group.removeFromParent();

        this.shell.geometry.dispose();
        this.shellMaterial.dispose();
        this.core.geometry.dispose();
        (this.core.material as THREE.Material).dispose();

        this.halo.material.dispose();
        this.haloTexture.dispose();

        this.motes.geometry.dispose();
        this.moteMaterial.dispose();
        this.moteTexture.dispose();
    }
}
