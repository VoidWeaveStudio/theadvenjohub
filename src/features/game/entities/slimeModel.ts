// src/features/game/entities/slimeModel.ts
import * as THREE from "three";

const DEFORM_UNIFORMS = /* glsl */`
    uniform float uTime;
    uniform float uSquash;
    uniform float uSpread;
    uniform float uWobble;
    uniform vec3 uLean;
`;

const DEFORM_BODY = /* glsl */`
    float ripple =
        sin(transformed.y * 3.4 + uTime * 6.2) * 0.5 +
        sin(transformed.x * 4.6 - uTime * 4.9) * 0.3 +
        sin(transformed.z * 5.1 + uTime * 7.4) * 0.2;

    transformed += normal * ripple * uWobble;

    float gravity = smoothstep(0.5, -0.55, transformed.y);
    transformed.x *= 1.0 + gravity * 0.26;
    transformed.z *= 1.0 + gravity * 0.26;
    transformed.y = mix(transformed.y, max(transformed.y, -0.28), 0.88);
    transformed.y -= 0.05;

    transformed.y *= uSquash;
    transformed.x *= uSpread;
    transformed.z *= uSpread;
    transformed += uLean * (transformed.y + 0.55);
`;

const SHELL_VERTEX = /* glsl */`
    ${DEFORM_UNIFORMS}

    varying vec3 vNormalView;
    varying vec3 vViewPosition;

    void main() {
        vec3 transformed = position;
        ${DEFORM_BODY}

        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewPosition = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
    }
`;

const SHELL_FRAGMENT = /* glsl */`
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uOpacity;

    varying vec3 vNormalView;
    varying vec3 vViewPosition;

    void main() {
        vec3 normal = normalize(vNormalView);
        vec3 view = normalize(vViewPosition);

        float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 2.3);
        float band = 0.35 + fresnel * 0.65;

        gl_FragColor = vec4(uColor * band * uIntensity, fresnel * uOpacity);
    }
`;

export interface SlimeMotion {
    moving: boolean;
    aggro: boolean;
    darkness: number;
}

let auraTexture: THREE.Texture | null = null;

function getAuraTexture(): THREE.Texture | null {
    if (auraTexture) return auraTexture;
    if (typeof document === "undefined") return null;

    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const half = size * 0.5;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.42)");
    gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.12)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    auraTexture = new THREE.CanvasTexture(canvas);
    auraTexture.colorSpace = THREE.SRGBColorSpace;
    auraTexture.needsUpdate = true;
    return auraTexture;
}

export class SlimeModel {
    public readonly group = new THREE.Group();

    private readonly inner = new THREE.Group();
    private readonly bodyMaterial: THREE.MeshStandardMaterial;
    private readonly shellMaterial: THREE.ShaderMaterial;
    private readonly coreMaterial: THREE.MeshBasicMaterial;
    private readonly eyeMaterial: THREE.MeshStandardMaterial;
    private readonly glowMaterial: THREE.MeshBasicMaterial;
    private readonly geometries: THREE.BufferGeometry[] = [];

    private readonly uniforms = {
        uTime: { value: 0 },
        uSquash: { value: 1 },
        uSpread: { value: 1 },
        uWobble: { value: 0.02 },
        uLean: { value: new THREE.Vector3() },
    };

    private readonly baseColor: THREE.Color;
    private readonly bubbles: THREE.Mesh[] = [];
    private aura: THREE.Sprite | null = null;
    private auraMaterial: THREE.SpriteMaterial | null = null;

    private time = 0;
    private hopPhase = 0;
    private attackTime = -1;
    private castTime = -1;
    private castDuration = 1;
    private recoilTime = -1;
    private hitEnergy = 0;
    private lean = 0;

    constructor(color: number, isBoss: boolean) {
        this.baseColor = new THREE.Color(color);

        const bodyGeometry = new THREE.IcosahedronGeometry(0.52, isBoss ? 4 : 3);
        this.geometries.push(bodyGeometry);

        this.bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.baseColor.clone().multiplyScalar(0.85),
            roughness: 0.18,
            metalness: 0,
            transparent: true,
            opacity: 0.62,
            depthWrite: false,
            emissive: this.baseColor.clone().multiplyScalar(0.18),
        });

        this.bodyMaterial.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, this.uniforms);
            shader.vertexShader = DEFORM_UNIFORMS + shader.vertexShader.replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>\n${DEFORM_BODY}`
            );
        };

        const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        body.renderOrder = 1;
        this.inner.add(body);

        this.shellMaterial = new THREE.ShaderMaterial({
            uniforms: {
                ...this.uniforms,
                uColor: { value: this.baseColor.clone().lerp(new THREE.Color(0xffffff), 0.35) },
                uIntensity: { value: 1.5 },
                uOpacity: { value: 0.85 },
            },
            vertexShader: SHELL_VERTEX,
            fragmentShader: SHELL_FRAGMENT,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide,
        });

        const shell = new THREE.Mesh(bodyGeometry, this.shellMaterial);
        shell.position.y = 0.5;
        shell.scale.setScalar(1.06);
        shell.renderOrder = 3;
        this.inner.add(shell);

        const coreGeometry = new THREE.IcosahedronGeometry(0.15, 1);
        this.geometries.push(coreGeometry);

        this.coreMaterial = new THREE.MeshBasicMaterial({
            color: this.baseColor.clone().lerp(new THREE.Color(0xffffff), 0.55),
            toneMapped: false,
            transparent: true,
            opacity: 0.9,
        });

        const core = new THREE.Mesh(coreGeometry, this.coreMaterial);
        core.position.y = 0.44;
        core.renderOrder = 2;
        this.inner.add(core);

        const bubbleGeometry = new THREE.IcosahedronGeometry(0.055, 0);
        this.geometries.push(bubbleGeometry);

        this.glowMaterial = new THREE.MeshBasicMaterial({
            color: this.baseColor.clone().lerp(new THREE.Color(0xffffff), 0.7),
            toneMapped: false,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
        });

        for (let i = 0; i < 5; i++) {
            const bubble = new THREE.Mesh(bubbleGeometry, this.glowMaterial);
            const angle = (i / 5) * Math.PI * 2;
            bubble.position.set(Math.cos(angle) * 0.24, 0.34 + (i % 3) * 0.13, Math.sin(angle) * 0.24);
            bubble.renderOrder = 2;
            this.bubbles.push(bubble);
            this.inner.add(bubble);
        }

        const aura = getAuraTexture();
        if (aura) {
            const glow = this.baseColor.clone().lerp(new THREE.Color(0xffffff), 0.4);
            const luminance = glow.r * 0.299 + glow.g * 0.587 + glow.b * 0.114;
            if (luminance < 0.42) glow.multiplyScalar(0.42 / Math.max(luminance, 0.05));

            this.auraMaterial = new THREE.SpriteMaterial({
                map: aura,
                color: glow,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false,
                toneMapped: false,
            });

            this.aura = new THREE.Sprite(this.auraMaterial);
            this.aura.scale.setScalar(2.5);
            this.aura.position.y = 0.5;
            this.aura.renderOrder = 0;
            this.inner.add(this.aura);
        }

        const eyeGeometry = new THREE.SphereGeometry(0.085, 10, 8);
        this.geometries.push(eyeGeometry);

        this.eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x0b1014,
            roughness: 0.22,
            metalness: 0.1,
        });

        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeometry, this.eyeMaterial);
            eye.position.set(side * 0.17, 0.58, 0.4);
            eye.scale.set(1, 1.22, 0.7);
            eye.renderOrder = 4;
            this.inner.add(eye);
        }

        this.group.add(this.inner);
    }

    public triggerAttack() {
        this.attackTime = 0;
    }

    public beginCast(seconds: number) {
        this.castDuration = Math.max(0.15, seconds);
        this.castTime = 0;
        this.recoilTime = -1;
    }

    public flashHit() {
        this.hitEnergy = 1;
    }

    public update(delta: number, motion: SlimeMotion): boolean {
        this.time += delta;
        this.uniforms.uTime.value = this.time;

        const previousPhase = this.hopPhase;
        this.hopPhase += delta * (motion.moving ? (motion.aggro ? 8.4 : 5.2) : 1.6);
        this.hitEnergy = Math.max(0, this.hitEnergy - delta * 2.6);

        const landed = motion.moving && Math.floor(previousPhase / Math.PI) !== Math.floor(this.hopPhase / Math.PI);
        const wave = Math.sin(this.hopPhase);
        const airborne = motion.moving ? Math.max(0, wave) : 0;
        const landing = motion.moving ? Math.max(0, -wave) : 0;

        let squash = 1 + airborne * 0.22 - landing * 0.2;
        let forward = 0;
        let height = airborne * (motion.aggro ? 0.5 : 0.32);

        if (this.attackTime >= 0) {
            this.attackTime += delta;

            if (this.attackTime < 0.18) {
                const t = this.attackTime / 0.18;
                squash *= THREE.MathUtils.lerp(1, 0.68, t);
                forward = -0.18 * t;
            } else if (this.attackTime < 0.34) {
                const t = (this.attackTime - 0.18) / 0.16;
                squash *= THREE.MathUtils.lerp(0.68, 1.34, t);
                forward = THREE.MathUtils.lerp(-0.18, 0.62, t);
                height += Math.sin(t * Math.PI) * 0.24;
            } else if (this.attackTime < 0.62) {
                const t = (this.attackTime - 0.34) / 0.28;
                squash *= THREE.MathUtils.lerp(1.34, 1, t);
                forward = THREE.MathUtils.lerp(0.62, 0, t);
            } else {
                this.attackTime = -1;
            }
        }

        let charge = 0;

        if (this.castTime >= 0) {
            this.castTime += delta;
            const t = Math.min(1, this.castTime / this.castDuration);

            charge = t;
            squash *= 1 + Math.pow(t, 1.6) * 0.34;
            height += Math.pow(t, 2) * 0.3;
            forward -= t * 0.16;

            if (this.castTime >= this.castDuration) {
                this.castTime = -1;
                this.recoilTime = 0;
            }
        }

        if (this.recoilTime >= 0) {
            this.recoilTime += delta;
            const t = Math.min(1, this.recoilTime / 0.34);

            charge = 1 - t;
            squash *= THREE.MathUtils.lerp(0.7, 1, t);
            forward += (1 - t) * 0.34;

            if (this.recoilTime >= 0.34) this.recoilTime = -1;
        }

        squash *= 1 + Math.sin(this.time * 1.8) * 0.03;
        squash = THREE.MathUtils.clamp(squash, 0.55, 1.7);

        this.uniforms.uSquash.value = squash;
        this.uniforms.uSpread.value = 1 / Math.sqrt(squash);
        this.uniforms.uWobble.value = 0.018 + this.hitEnergy * 0.075 + landing * 0.03 + charge * 0.05;

        const targetLean = motion.moving ? 0.1 : 0;
        this.lean += (targetLean - this.lean) * Math.min(1, delta * 6);
        this.uniforms.uLean.value.set(0, 0, this.lean);

        this.inner.position.set(0, height, forward);

        const flash = this.hitEnergy;
        this.bodyMaterial.emissive.copy(this.baseColor).multiplyScalar(0.18 + flash * 1.4 + charge * 1.1);
        this.bodyMaterial.opacity = 0.62 + flash * 0.2;
        this.shellMaterial.uniforms.uIntensity.value =
            1.5 + flash * 2.4 + charge * 3.2 + (this.attackTime >= 0 ? 1.1 : 0);

        if (this.aura && this.auraMaterial) {
            const pulse = 0.5 + Math.sin(this.time * 1.7) * 0.07;
            const alert = motion.aggro ? 0.22 : 0;
            const reach = 0.28 + THREE.MathUtils.clamp(motion.darkness, 0, 1) * 0.72;

            this.auraMaterial.opacity = (pulse + alert + flash * 0.45 + charge * 0.6) * reach;
            this.aura.scale.setScalar(2.5 + Math.sin(this.time * 1.7) * 0.14 + alert + charge * 1.4);
        }

        for (let i = 0; i < this.bubbles.length; i++) {
            const bubble = this.bubbles[i];
            bubble.position.y = 0.3 + ((this.time * 0.22 + i * 0.2) % 0.42);
            const fade = 1 - ((this.time * 0.22 + i * 0.2) % 0.42) / 0.42;
            bubble.scale.setScalar(0.6 + fade * 0.7);
        }

        return landed;
    }

    public dispose() {
        for (const geometry of this.geometries) geometry.dispose();
        this.bodyMaterial.dispose();
        this.shellMaterial.dispose();
        this.coreMaterial.dispose();
        this.eyeMaterial.dispose();
        this.glowMaterial.dispose();
        this.auraMaterial?.dispose();
    }
}
