// src/features/game/entities/EnergyWisp.ts
import * as THREE from "three";

export const WISP_ANCHOR_Y = 0.55;

const TRAIL_POINTS = 140;
const TRAIL_MIN_STEP = 0.6;
const TRAIL_HEAD_WIDTH = 0.62;
const TRAIL_LIFETIME = 0.85;
const ION_WIDTH_SCALE = 1;
const ION_SAG = 1.2;
const DUST_WIDTH_SCALE = 2.9;
const DUST_SAG = 3.4;
const SPARK_COUNT = 84;
const ARC_COUNT = 3;
const CORE_RADIUS = 0.46;
const NEAR_FADE_START = 1.2;
const NEAR_FADE_END = 4.2;
const EMBER_COUNT = 220;
const EMBER_RATE_IDLE = 14;
const EMBER_RATE_BOOST = 130;
const FORWARD = new THREE.Vector3(0, 0, 1);

const nearFadeChunk = /* glsl */ `
uniform float uFadeNear;
uniform float uFadeFar;
float nearFade(float depth) {
    return smoothstep(uFadeNear, uFadeFar, depth);
}
`;

const plasmaVertex = /* glsl */ `
uniform float uTime;
uniform float uWobble;
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vLocal = normalize(position);
    float ripple =
        sin(position.x * 6.1 + uTime * 2.6) *
        sin(position.y * 5.3 - uTime * 2.1) *
        sin(position.z * 6.7 + uTime * 3.1);
    vec3 displaced = position + normal * ripple * uWobble;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const plasmaFragment = /* glsl */ `
uniform float uTime;
uniform float uPower;
uniform vec3 uCold;
uniform vec3 uHot;
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewDir;

float wave(vec3 p, float t) {
    return sin(p.x * 3.4 + t) * sin(p.y * 2.9 - t * 0.8) * sin(p.z * 3.9 + t * 0.6);
}

float turbulence(vec3 p, float t) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        sum += abs(wave(p, t)) * amp;
        p *= 1.95;
        t *= 1.2;
        amp *= 0.55;
    }
    return sum;
}

void main() {
    float swirl = turbulence(vLocal * 2.2 + vec3(0.0, uTime * 0.35, 0.0), uTime * 1.4);
    float veins = pow(0.5 + 0.5 * sin(vLocal.y * 11.0 - uTime * 2.2 + swirl * 8.0), 2.2);

    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.0);

    vec3 color = mix(uCold, uHot, clamp(swirl * 1.9, 0.0, 1.0));
    color += uHot * veins * 0.55;
    color += vec3(1.0) * pow(facing, 4.0) * (0.35 + uPower * 0.5);
    color += vec3(0.75, 0.92, 1.0) * fresnel * 1.25;

    gl_FragColor = vec4(color, 1.0);
}
`;

const orbVertex = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const orbFragment = /* glsl */ `
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uOpacity;
uniform float uPow;
uniform float uInvert;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float shaped = mix(pow(facing, uPow), pow(1.0 - facing, uPow), uInvert);
    vec3 color = mix(uColorOuter, uColorInner, shaped);
    gl_FragColor = vec4(color, shaped * uOpacity);
}
`;

const sparkVertex = /* glsl */ `
${nearFadeChunk}
uniform float uTime;
uniform float uPower;
attribute float aSeed;
attribute float aRadius;
attribute float aSpin;
varying float vAlpha;
void main() {
    float angle = aSeed * 6.2831 + uTime * aSpin;
    float radius = aRadius * (0.92 + sin(uTime * 2.4 + aSeed * 9.0) * 0.08);
    float lift = sin(uTime * 1.7 + aSeed * 12.0) * radius * 0.5;

    vec3 local = vec3(cos(angle) * radius, lift, sin(angle) * radius);
    vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);

    vAlpha = (0.45 + uPower * 0.25) * nearFade(-mvPosition.z);
    gl_PointSize = clamp((1.6 + aSeed * 4.2) * (150.0 / max(-mvPosition.z, 0.6)), 0.0, 42.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const sparkFragment = /* glsl */ `
varying float vAlpha;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.86, 0.96, 1.0), falloff * vAlpha);
}
`;

const tailVertex = /* glsl */ `
${nearFadeChunk}
uniform float uSag;
uniform float uWidthScale;
attribute float aSide;
attribute float aAge;
attribute float aWidth;
attribute float aLife;
attribute vec3 aDir;
varying float vAge;
varying float vEdge;
varying float vFade;
varying float vLife;
void main() {
    vLife = aLife;
    vec3 sagged = position - vec3(0.0, aAge * aAge * uSag, 0.0);
    vec4 mvPosition = modelViewMatrix * vec4(sagged, 1.0);
    vec3 dirView = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz);
    vec3 viewDir = normalize(-mvPosition.xyz);

    vec3 crossed = cross(dirView, viewDir);
    float crossLen = length(crossed);
    vec3 side = crossLen > 0.0001 ? crossed / crossLen : vec3(1.0, 0.0, 0.0);

    mvPosition.xyz += side * (aSide * aWidth * uWidthScale);

    vAge = aAge;
    vEdge = aSide;
    vFade = nearFade(-mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const tailFragment = /* glsl */ `
uniform float uOpacity;
uniform float uSoftness;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCold;
varying float vAge;
varying float vEdge;
varying float vFade;
varying float vLife;
void main() {
    vec3 color = vAge < 0.25 ? mix(uHot, uMid, vAge / 0.25) : mix(uMid, uCold, (vAge - 0.25) / 0.75);

    float head = smoothstep(0.0, 0.06, vAge);
    float taper = pow(1.0 - vAge, 1.6);
    float edge = pow(smoothstep(1.0, 0.0, abs(vEdge)), uSoftness);
    float life = pow(clamp(vLife, 0.0, 1.0), 1.4);

    gl_FragColor = vec4(color, head * taper * edge * life * uOpacity * vFade);
}
`;

const emberVertex = /* glsl */ `
${nearFadeChunk}
attribute float aLife;
attribute float aSeed;
attribute float aSize;
varying float vAlpha;
varying float vLife;
void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float fade = clamp(1.0 - aLife, 0.0, 1.0);

    vLife = aLife;
    vAlpha = pow(fade, 1.3) * nearFade(-mvPosition.z);
    gl_PointSize = clamp(aSize * (0.35 + fade * 1.1) * (150.0 / max(-mvPosition.z, 0.6)), 0.0, 34.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const emberFragment = /* glsl */ `
varying float vAlpha;
varying float vLife;
void main() {
    if (vAlpha <= 0.002) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    vec3 hot = vec3(0.95, 0.99, 1.0);
    vec3 mid = vec3(0.32, 0.72, 1.0);
    vec3 cold = vec3(0.16, 0.22, 0.72);
    vec3 color = vLife < 0.35 ? mix(hot, mid, vLife / 0.35) : mix(mid, cold, (vLife - 0.35) / 0.65);
    gl_FragColor = vec4(color, falloff * vAlpha * 0.85);
}
`;

export class EnergyWisp {
    public readonly group: THREE.Group;

    private align: THREE.Group;
    private core: THREE.Mesh;
    private innerGlow: THREE.Mesh;
    private arcs: THREE.Mesh[] = [];
    private sparks: THREE.Points;
    private light: THREE.PointLight | null;

    private worldEffects: THREE.Group | null = null;
    private worldScene: THREE.Scene | null = null;

    private ionTail: THREE.Mesh | null = null;
    private dustTail: THREE.Mesh | null = null;
    private trailSpine!: Float32Array;
    private trailSpineWidth!: Float32Array;
    private trailSpineAge!: Float32Array;
    private trailPositions!: Float32Array;
    private trailDirs!: Float32Array;
    private trailWidths!: Float32Array;
    private trailLives!: Float32Array;
    private trailFilled = 0;
    private lastTrailPoint = new THREE.Vector3();

    private embers: THREE.Points | null = null;
    private emberPositions!: Float32Array;
    private emberVelocities!: Float32Array;
    private emberLife!: Float32Array;
    private emberLifeSpeed!: Float32Array;
    private emberCursor = 0;
    private emberBudget = 0;

    private sparkUniforms = {
        uTime: { value: 0 },
        uPower: { value: 0 },
        uFadeNear: { value: NEAR_FADE_START },
        uFadeFar: { value: NEAR_FADE_END },
    };

    private headWorld = new THREE.Vector3();
    private time = 0;
    private power = 0;

    private static readonly _dir = new THREE.Vector3();
    private static readonly _worldQuat = new THREE.Quaternion();
    private static readonly _parentQuat = new THREE.Quaternion();
    private static readonly _targetQuat = new THREE.Quaternion();

    constructor(options: { withTrail: boolean; withLight: boolean }) {
        this.group = new THREE.Group();
        this.group.visible = false;

        this.align = new THREE.Group();
        this.group.add(this.align);

        this.core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(CORE_RADIUS, 4),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uPower: { value: 0 },
                    uWobble: { value: CORE_RADIUS * 0.16 },
                    uCold: { value: new THREE.Color(0x1d5fd6) },
                    uHot: { value: new THREE.Color(0x9fe8ff) },
                },
                vertexShader: plasmaVertex,
                fragmentShader: plasmaFragment,
                fog: false,
            })
        );
        this.align.add(this.core);

        this.innerGlow = new THREE.Mesh(
            new THREE.SphereGeometry(CORE_RADIUS * 1.55, 28, 20),
            this.createOrbMaterial(0xffffff, 0x53b6ff, 0.85, 1.6, 0)
        );
        this.align.add(this.innerGlow);

        const arcGeometry = new THREE.TorusGeometry(CORE_RADIUS * 1.5, CORE_RADIUS * 0.045, 8, 44);
        const arcMaterial = new THREE.MeshBasicMaterial({
            color: 0xb6ecff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        });
        for (let i = 0; i < ARC_COUNT; i++) {
            const arc = new THREE.Mesh(arcGeometry, arcMaterial);
            arc.rotation.set((i * Math.PI) / ARC_COUNT, (i * Math.PI) / 2, 0);
            this.align.add(arc);
            this.arcs.push(arc);
        }

        this.sparks = this.buildSparks();
        this.align.add(this.sparks);

        this.light = options.withLight ? new THREE.PointLight(0x6fd8ff, 2.2, 26, 1.8) : null;
        if (this.light) this.group.add(this.light);

        if (options.withTrail) this.buildWorldEffects();
    }

    private createOrbMaterial(inner: number, outer: number, opacity: number, power: number, invert: number) {
        return new THREE.ShaderMaterial({
            uniforms: {
                uColorInner: { value: new THREE.Color(inner) },
                uColorOuter: { value: new THREE.Color(outer) },
                uOpacity: { value: opacity },
                uPow: { value: power },
                uInvert: { value: invert },
            },
            vertexShader: orbVertex,
            fragmentShader: orbFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            fog: false,
        });
    }

    private buildSparks(): THREE.Points {
        const positions = new Float32Array(SPARK_COUNT * 3);
        const seeds = new Float32Array(SPARK_COUNT);
        const radii = new Float32Array(SPARK_COUNT);
        const spins = new Float32Array(SPARK_COUNT);

        for (let i = 0; i < SPARK_COUNT; i++) {
            seeds[i] = Math.random();
            radii[i] = CORE_RADIUS * (1.2 + Math.random() * 1.5);
            spins[i] = (1.4 + Math.random() * 2.6) * (Math.random() < 0.5 ? -1 : 1);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
        geometry.setAttribute("aSpin", new THREE.BufferAttribute(spins, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.sparkUniforms,
            vertexShader: sparkVertex,
            fragmentShader: sparkFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 7;
        return points;
    }

    private buildWorldEffects() {
        this.worldEffects = new THREE.Group();
        this.worldEffects.visible = false;

        this.buildTails();
        this.buildEmbers();
    }

    private createTailMaterial(options: {
        widthScale: number;
        sag: number;
        opacity: number;
        softness: number;
        hot: number;
        mid: number;
        cold: number;
    }) {
        return new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: options.opacity },
                uSoftness: { value: options.softness },
                uSag: { value: options.sag },
                uWidthScale: { value: options.widthScale },
                uHot: { value: new THREE.Color(options.hot) },
                uMid: { value: new THREE.Color(options.mid) },
                uCold: { value: new THREE.Color(options.cold) },
                uFadeNear: { value: NEAR_FADE_START },
                uFadeFar: { value: NEAR_FADE_END },
            },
            vertexShader: tailVertex,
            fragmentShader: tailFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        });
    }

    private buildTails() {
        this.trailSpine = new Float32Array(TRAIL_POINTS * 3);
        this.trailSpineWidth = new Float32Array(TRAIL_POINTS);
        this.trailSpineAge = new Float32Array(TRAIL_POINTS);

        const vertexCount = TRAIL_POINTS * 2;
        this.trailPositions = new Float32Array(vertexCount * 3);
        this.trailDirs = new Float32Array(vertexCount * 3);
        this.trailWidths = new Float32Array(vertexCount);
        this.trailLives = new Float32Array(vertexCount);

        const sides = new Float32Array(vertexCount);
        const ages = new Float32Array(vertexCount);
        for (let i = 0; i < TRAIL_POINTS; i++) {
            const age = i / (TRAIL_POINTS - 1);
            sides[i * 2] = -1;
            sides[i * 2 + 1] = 1;
            ages[i * 2] = age;
            ages[i * 2 + 1] = age;
        }

        const indices = new Uint16Array((TRAIL_POINTS - 1) * 6);
        for (let i = 0; i < TRAIL_POINTS - 1; i++) {
            const a = i * 2;
            const offset = i * 6;
            indices[offset] = a;
            indices[offset + 1] = a + 1;
            indices[offset + 2] = a + 2;
            indices[offset + 3] = a + 1;
            indices[offset + 4] = a + 3;
            indices[offset + 5] = a + 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
        geometry.setAttribute("aDir", new THREE.BufferAttribute(this.trailDirs, 3));
        geometry.setAttribute("aWidth", new THREE.BufferAttribute(this.trailWidths, 1));
        geometry.setAttribute("aLife", new THREE.BufferAttribute(this.trailLives, 1));
        geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
        geometry.setAttribute("aAge", new THREE.BufferAttribute(ages, 1));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.setDrawRange(0, 0);

        this.dustTail = new THREE.Mesh(geometry, this.createTailMaterial({
            widthScale: DUST_WIDTH_SCALE,
            sag: DUST_SAG,
            opacity: 0.26,
            softness: 1.5,
            hot: 0xa7d8ff,
            mid: 0x3f6cf0,
            cold: 0x140f4a,
        }));
        this.dustTail.frustumCulled = false;
        this.dustTail.renderOrder = 5;
        this.worldEffects!.add(this.dustTail);

        this.ionTail = new THREE.Mesh(geometry, this.createTailMaterial({
            widthScale: ION_WIDTH_SCALE,
            sag: ION_SAG,
            opacity: 0.9,
            softness: 0.55,
            hot: 0xf2fdff,
            mid: 0x5fc8ff,
            cold: 0x12266e,
        }));
        this.ionTail.frustumCulled = false;
        this.ionTail.renderOrder = 6;
        this.worldEffects!.add(this.ionTail);
    }

    private buildEmbers() {
        this.emberPositions = new Float32Array(EMBER_COUNT * 3);
        this.emberVelocities = new Float32Array(EMBER_COUNT * 3);
        this.emberLife = new Float32Array(EMBER_COUNT).fill(1);
        this.emberLifeSpeed = new Float32Array(EMBER_COUNT);

        const seeds = new Float32Array(EMBER_COUNT);
        const sizes = new Float32Array(EMBER_COUNT);
        for (let i = 0; i < EMBER_COUNT; i++) {
            seeds[i] = Math.random();
            sizes[i] = 1.4 + Math.random() * 3.4;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.emberPositions, 3));
        geometry.setAttribute("aLife", new THREE.BufferAttribute(this.emberLife, 1));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uFadeNear: { value: NEAR_FADE_START },
                uFadeFar: { value: NEAR_FADE_END },
            },
            vertexShader: emberVertex,
            fragmentShader: emberFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.embers = new THREE.Points(geometry, material);
        this.embers.frustumCulled = false;
        this.embers.renderOrder = 6;
        this.worldEffects!.add(this.embers);
    }

    public attach(parent: THREE.Object3D, scene: THREE.Scene | null) {
        parent.add(this.group);
        this.group.position.y = WISP_ANCHOR_Y;

        if (this.worldEffects && scene) {
            scene.add(this.worldEffects);
            this.worldScene = scene;
        }
    }

    public moveTrailToScene(scene: THREE.Scene) {
        if (!this.worldEffects) return;
        this.worldScene?.remove(this.worldEffects);
        scene.add(this.worldEffects);
        this.worldScene = scene;
        this.resetWorldEffects();
    }

    public setActive(active: boolean) {
        if (this.group.visible === active) return;
        this.group.visible = active;
        if (this.worldEffects) this.worldEffects.visible = active;
        if (!active) this.resetWorldEffects();
    }

    public isActive(): boolean {
        return this.group.visible;
    }

    private resetWorldEffects() {
        this.trailFilled = 0;
        this.trailSpineAge?.fill(TRAIL_LIFETIME);
        this.ionTail?.geometry.setDrawRange(0, 0);

        if (this.embers) {
            this.emberLife.fill(1);
            this.emberBudget = 0;
            this.embers.geometry.attributes.aLife.needsUpdate = true;
        }
    }

    private alignToVelocity(worldVelocity: THREE.Vector3, delta: number) {
        if (worldVelocity.lengthSq() < 0.04) return;

        EnergyWisp._dir.copy(worldVelocity).normalize();
        EnergyWisp._worldQuat.setFromUnitVectors(FORWARD, EnergyWisp._dir);

        const parent = this.group.parent;
        if (parent) {
            parent.getWorldQuaternion(EnergyWisp._parentQuat);
            EnergyWisp._targetQuat.copy(EnergyWisp._parentQuat).invert().multiply(EnergyWisp._worldQuat);
        } else {
            EnergyWisp._targetQuat.copy(EnergyWisp._worldQuat);
        }

        this.align.quaternion.slerp(EnergyWisp._targetQuat, Math.min(1, 9 * delta));
    }

    update(delta: number, speedRatio: number, boosting: boolean, worldVelocity: THREE.Vector3) {
        if (!this.group.visible) return;

        this.time += delta;
        const target = THREE.MathUtils.clamp(speedRatio, 0, 1) * (boosting ? 1 : 0.8);
        this.power += (target - this.power) * Math.min(1, 6 * delta);

        this.group.getWorldPosition(this.headWorld);
        this.alignToVelocity(worldVelocity, delta);

        const pulse = 1 + Math.sin(this.time * 7) * 0.06;
        const stretch = 1 + this.power * 1.5;
        const squash = 1 / Math.sqrt(stretch);

        this.core.scale.set(pulse * squash, pulse * squash, pulse * stretch);
        const coreMaterial = this.core.material as THREE.ShaderMaterial;
        coreMaterial.uniforms.uTime.value = this.time;
        coreMaterial.uniforms.uPower.value = this.power;

        this.innerGlow.scale.set(squash * 1.05, squash * 1.05, stretch);
        (this.innerGlow.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.7 + this.power * 0.3;

        this.arcs.forEach((arc, i) => {
            arc.rotation.x += delta * (0.9 + i * 0.4);
            arc.rotation.y += delta * (0.6 + i * 0.3);
            arc.scale.setScalar(squash * (1 + Math.sin(this.time * 3 + i) * 0.08));
        });
        (this.arcs[0].material as THREE.MeshBasicMaterial).opacity = 0.35 + this.power * 0.4;

        this.sparkUniforms.uTime.value = this.time;
        this.sparkUniforms.uPower.value = this.power;

        if (this.light) {
            this.light.intensity = 1.8 + this.power * 4.5;
            this.light.distance = 22 + this.power * 20;
            this.light.color.setRGB(0.45 + this.power * 0.5, 0.78 + this.power * 0.2, 1.0);
        }

        this.updateTails(delta);
        this.updateEmbers(delta, worldVelocity);
    }

    private updateTails(delta: number) {
        if (!this.ionTail || !this.dustTail) return;

        const head = this.headWorld;

        for (let i = 0; i < this.trailFilled; i++) {
            this.trailSpineAge[i] += delta;
        }
        while (this.trailFilled > 0 && this.trailSpineAge[this.trailFilled - 1] >= TRAIL_LIFETIME) {
            this.trailFilled -= 1;
        }

        if (this.trailFilled === 0) {
            this.trailSpineAge[0] = 0;
            this.trailSpine[0] = head.x;
            this.trailSpine[1] = head.y;
            this.trailSpine[2] = head.z;
            this.trailSpineWidth[0] = TRAIL_HEAD_WIDTH * (0.45 + this.power * 0.55);
            this.trailFilled = 1;
            this.lastTrailPoint.copy(head);
        } else if (this.lastTrailPoint.distanceTo(head) > TRAIL_MIN_STEP) {
            this.trailSpine.copyWithin(3, 0, this.trailSpine.length - 3);
            this.trailSpineWidth.copyWithin(1, 0, this.trailSpineWidth.length - 1);
            this.trailSpineAge.copyWithin(1, 0, this.trailSpineAge.length - 1);
            this.trailFilled = Math.min(TRAIL_POINTS, this.trailFilled + 1);
            this.lastTrailPoint.copy(head);
        }

        this.trailSpine[0] = head.x;
        this.trailSpine[1] = head.y;
        this.trailSpine[2] = head.z;
        this.trailSpineAge[0] = 0;
        this.trailSpineWidth[0] = TRAIL_HEAD_WIDTH * (0.45 + this.power * 0.55);

        const last = this.trailFilled - 1;
        for (let i = 0; i < this.trailFilled; i++) {
            const prev = Math.max(0, i - 1) * 3;
            const next = Math.min(last, i + 1) * 3;

            let dx = this.trailSpine[next] - this.trailSpine[prev];
            let dy = this.trailSpine[next + 1] - this.trailSpine[prev + 1];
            let dz = this.trailSpine[next + 2] - this.trailSpine[prev + 2];
            const length = Math.hypot(dx, dy, dz);
            if (length > 1e-5) {
                dx /= length;
                dy /= length;
                dz /= length;
            } else {
                dx = 0;
                dy = 0;
                dz = 1;
            }

            const t = i / (TRAIL_POINTS - 1);
            const coma = Math.min(1, t / 0.09);
            const life = Math.max(0, 1 - this.trailSpineAge[i] / TRAIL_LIFETIME);
            const profile = (0.28 + 0.72 * coma) * Math.pow(1 - t, 0.9);
            const width = this.trailSpineWidth[i] * profile * life;
            const base = i * 3;

            for (let side = 0; side < 2; side++) {
                const vertex = (i * 2 + side) * 3;
                this.trailPositions[vertex] = this.trailSpine[base];
                this.trailPositions[vertex + 1] = this.trailSpine[base + 1];
                this.trailPositions[vertex + 2] = this.trailSpine[base + 2];
                this.trailDirs[vertex] = dx;
                this.trailDirs[vertex + 1] = dy;
                this.trailDirs[vertex + 2] = dz;
                this.trailWidths[i * 2 + side] = width;
                this.trailLives[i * 2 + side] = life;
            }
        }

        const geometry = this.ionTail.geometry;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.aDir.needsUpdate = true;
        geometry.attributes.aWidth.needsUpdate = true;
        geometry.attributes.aLife.needsUpdate = true;
        geometry.setDrawRange(0, Math.max(0, this.trailFilled - 1) * 6);

        (this.ionTail.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.45 + this.power * 0.55;
        (this.dustTail.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.12 + this.power * 0.22;
    }

    private updateEmbers(delta: number, worldVelocity: THREE.Vector3) {
        if (!this.embers) return;

        const speed = worldVelocity.length();
        const dirX = speed > 0.001 ? worldVelocity.x / speed : 0;
        const dirY = speed > 0.001 ? worldVelocity.y / speed : 0;
        const dirZ = speed > 0.001 ? worldVelocity.z / speed : 1;

        this.emberBudget += delta * (EMBER_RATE_IDLE + this.power * EMBER_RATE_BOOST);
        while (this.emberBudget >= 1) {
            this.emberBudget -= 1;
            this.spawnEmber(dirX, dirY, dirZ);
        }

        for (let i = 0; i < EMBER_COUNT; i++) {
            if (this.emberLife[i] >= 1) continue;

            const p = i * 3;
            this.emberVelocities[p + 1] -= 1.4 * delta;

            const damping = Math.max(0, 1 - 1.1 * delta);
            this.emberVelocities[p] *= damping;
            this.emberVelocities[p + 1] *= damping;
            this.emberVelocities[p + 2] *= damping;

            this.emberPositions[p] += this.emberVelocities[p] * delta;
            this.emberPositions[p + 1] += this.emberVelocities[p + 1] * delta;
            this.emberPositions[p + 2] += this.emberVelocities[p + 2] * delta;

            this.emberLife[i] = Math.min(1, this.emberLife[i] + this.emberLifeSpeed[i] * delta);
        }

        this.embers.geometry.attributes.position.needsUpdate = true;
        this.embers.geometry.attributes.aLife.needsUpdate = true;
    }

    private spawnEmber(dirX: number, dirY: number, dirZ: number) {
        const i = this.emberCursor;
        this.emberCursor = (this.emberCursor + 1) % EMBER_COUNT;

        const p = i * 3;
        const spread = CORE_RADIUS * 1.4;
        this.emberPositions[p] = this.headWorld.x + (Math.random() - 0.5) * spread;
        this.emberPositions[p + 1] = this.headWorld.y + (Math.random() - 0.5) * spread;
        this.emberPositions[p + 2] = this.headWorld.z + (Math.random() - 0.5) * spread;

        const back = 2.5 + Math.random() * 5 * (0.3 + this.power);
        const jitter = 1.6 + this.power * 2.2;
        this.emberVelocities[p] = -dirX * back + (Math.random() - 0.5) * jitter;
        this.emberVelocities[p + 1] = -dirY * back + (Math.random() - 0.5) * jitter - 0.8;
        this.emberVelocities[p + 2] = -dirZ * back + (Math.random() - 0.5) * jitter;

        this.emberLife[i] = 0;
        this.emberLifeSpeed[i] = 0.55 + Math.random() * 0.75;
    }

    dispose() {
        this.group.traverse((obj) => {
            const renderable = obj as THREE.Mesh | THREE.Points;
            if (!(renderable as THREE.Mesh).isMesh && !(renderable as THREE.Points).isPoints) return;
            renderable.geometry.dispose();
            const material = renderable.material;
            if (Array.isArray(material)) {
                material.forEach((m) => m.dispose());
            } else {
                (material as THREE.Material).dispose();
            }
        });
        this.group.removeFromParent();

        if (this.worldEffects) {
            this.ionTail?.geometry.dispose();
            (this.ionTail?.material as THREE.Material | undefined)?.dispose();
            (this.dustTail?.material as THREE.Material | undefined)?.dispose();
            this.embers?.geometry.dispose();
            (this.embers?.material as THREE.Material | undefined)?.dispose();

            this.worldScene?.remove(this.worldEffects);
            this.worldEffects = null;
            this.ionTail = null;
            this.dustTail = null;
            this.embers = null;
        }
    }
}
