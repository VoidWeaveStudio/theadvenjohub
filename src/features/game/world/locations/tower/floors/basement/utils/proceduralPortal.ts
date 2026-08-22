// src/features/game/world/locations/tower/floors/basement/utils/proceduralPortal.ts
import * as THREE from "three";
import { PORTAL_EXTRA_LAYER, PORTAL_NOISE_GLSL, getPortalNoiseTexture } from "../../../../../portalNoise";

const ARMATURE_SEGMENTS = 12;
const STRUT_COUNT = 6;
const SHARD_COUNT = 14;
const MOTE_COUNT = 260;

const vortexVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const vortexFragment = /* glsl */ `
uniform float uTime;
uniform float uRadius;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec2 vLocal;

${PORTAL_NOISE_GLSL}

void main() {
    float r = length(vLocal) / uRadius;
    if (r > 1.0) discard;

    float angle = atan(vLocal.y, vLocal.x);
    float swirl = angle * 2.0 + pow(max(1.0 - r, 0.0), 0.55) * 9.0 - uTime * 1.15;

    float arms = pow(0.5 + 0.5 * sin(swirl), 1.8);
    float churn = fbm(vec2(swirl * 0.6, r * 4.5 - uTime * 0.55));
    float filaments = pow(0.5 + 0.5 * sin(swirl * 3.0 + churn * 7.0), 3.0);

    float core = smoothstep(0.42, 0.0, r);
    float throat = smoothstep(0.72, 0.18, r);
    float lip = smoothstep(1.0, 0.86, r) * (1.0 - smoothstep(0.86, 0.66, r));

    vec3 color = mix(uOuter, uInner, throat);
    color = mix(color, vec3(1.0), core * 0.85);
    color += uInner * arms * 0.55 * (1.0 - r);
    color += vec3(0.72, 0.9, 1.0) * lip * 1.35;
    color += vec3(1.0, 0.95, 0.85) * filaments * 0.35 * (1.0 - r);

    float alpha = core * 0.95 + throat * 0.45 + lip * 1.0 + arms * 0.3 * (1.0 - r);
    alpha *= 0.55 + churn * 0.6;
    alpha *= smoothstep(1.0, 0.93, r);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

const lensVertex = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
varying vec3 vLocal;
void main() {
    vLocal = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const lensFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
varying vec3 vNormalView;
varying vec3 vViewDir;
varying vec3 vLocal;
void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.2);
    float ripple = 0.6 + 0.4 * sin(length(vLocal.xz) * 5.0 - uTime * 3.2);
    gl_FragColor = vec4(uTint * (0.6 + ripple * 0.8), rim * 0.55 * ripple);
}
`;

const runeVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const runeFragment = /* glsl */ `
uniform float uTime;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform vec3 uTint;
varying vec2 vLocal;

void main() {
    float r = length(vLocal);
    float t = (r - uInnerRadius) / max(uOuterRadius - uInnerRadius, 0.001);
    if (t < 0.0 || t > 1.0) discard;

    float angle = atan(vLocal.y, vLocal.x) + uTime * 0.22;
    float slot = angle / 6.28318 * 48.0;
    float cell = floor(slot);
    float local = fract(slot);

    float mark = step(0.22, local) * step(local, 0.78);
    float pattern = step(0.45, fract(sin(cell * 12.9898) * 43758.5453));
    float band = smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.75, 1.0, t));
    float glow = 0.35 + 0.65 * sin(uTime * 2.4 + cell * 0.7) * 0.5 + 0.3;

    float alpha = mark * pattern * band * glow;
    gl_FragColor = vec4(uTint * (1.0 + glow), alpha);
}
`;

const beamVertex = /* glsl */ `
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

const beamFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uEmitAtTop;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 1.3);
    float fromEmitter = mix(vUv.y, 1.0 - vUv.y, uEmitAtTop);
    float fall = pow(1.0 - fromEmitter, 1.8);
    float streaks = 0.55 + 0.45 * sin(vUv.x * 62.0 + uTime * 1.4);
    gl_FragColor = vec4(uTint, fall * rim * streaks * 0.32);
}
`;

const moteVertex = /* glsl */ `
uniform float uTime;
uniform float uRadius;
attribute float aAngle;
attribute float aRadius;
attribute float aSpeed;
attribute float aDepth;
attribute float aSize;
varying float vFade;
void main() {
    float cycle = fract(uTime * aSpeed + aDepth);
    float radius = mix(aRadius, uRadius * 0.12, cycle);
    float angle = aAngle + cycle * 6.0;
    float drift = (1.0 - cycle) * uRadius * 0.55;

    vec3 local = vec3(cos(angle) * radius, drift, sin(angle) * radius);
    vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);

    vFade = sin(cycle * 3.14159);
    gl_PointSize = clamp(aSize * (240.0 / max(-mvPosition.z, 1.0)), 0.0, 26.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const moteFragment = /* glsl */ `
uniform vec3 uTint;
varying float vFade;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uTint, falloff * vFade * 0.7);
}
`;

export interface ProceduralPortal {
    group: THREE.Group;
    update: (delta: number) => void;
    dispose: () => void;
}

export function createProceduralPortal(options: {
    radius: number;
    inner: number;
    outer: number;
    ringColor: number;
    facing: "down" | "up";
    withBeam?: boolean;
}): ProceduralPortal {
    const { radius, facing } = options;
    const sign = facing === "down" ? -1 : 1;
    const group = new THREE.Group();

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
        geometries.push(geometry);
        return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
        materials.push(material);
        return material;
    };

    const vortexUniforms = {
        uTime: { value: 0 },
        uNoise: { value: getPortalNoiseTexture() },
        uRadius: { value: radius },
        uInner: { value: new THREE.Color(options.inner) },
        uOuter: { value: new THREE.Color(options.outer) },
    };

    const vortex = new THREE.Mesh(
        track(new THREE.CircleGeometry(radius, 128)),
        trackMaterial(new THREE.ShaderMaterial({
            uniforms: vortexUniforms,
            vertexShader: vortexVertex,
            fragmentShader: vortexFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        }))
    );
    vortex.rotation.x = facing === "down" ? Math.PI / 2 : -Math.PI / 2;
    group.add(vortex);

    const lensUniforms = { uTime: { value: 0 }, uTint: { value: new THREE.Color(options.inner) } };
    const lens = new THREE.Mesh(
        track(new THREE.SphereGeometry(radius * 0.94, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        trackMaterial(new THREE.ShaderMaterial({
            uniforms: lensUniforms,
            vertexShader: lensVertex,
            fragmentShader: lensFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        }))
    );
    lens.scale.y = 0.42 * sign;
    lens.name = PORTAL_EXTRA_LAYER;
    group.add(lens);

    const runeUniforms = {
        uTime: { value: 0 },
        uInnerRadius: { value: radius * 1.02 },
        uOuterRadius: { value: radius * 1.3 },
        uTint: { value: new THREE.Color(options.ringColor) },
    };
    const runes = new THREE.Mesh(
        track(new THREE.RingGeometry(radius * 1.02, radius * 1.3, 128, 1)),
        trackMaterial(new THREE.ShaderMaterial({
            uniforms: runeUniforms,
            vertexShader: runeVertex,
            fragmentShader: runeFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        }))
    );
    runes.rotation.x = -Math.PI / 2;
    runes.position.y = sign * radius * 0.02;
    group.add(runes);

    const hullMaterial = trackMaterial(new THREE.MeshStandardMaterial({
        color: 0x1b2430,
        roughness: 0.34,
        metalness: 0.92,
        emissive: 0x081722,
        emissiveIntensity: 0.6,
    }));

    const emissiveMaterial = trackMaterial(new THREE.MeshStandardMaterial({
        color: options.ringColor,
        emissive: options.ringColor,
        emissiveIntensity: 2.6,
        roughness: 0.28,
        metalness: 0.5,
    }));

    const innerRim = new THREE.Mesh(
        track(new THREE.TorusGeometry(radius * 1.01, radius * 0.055, 16, 128)),
        hullMaterial
    );
    innerRim.rotation.x = Math.PI / 2;
    group.add(innerRim);

    const innerGlowRim = new THREE.Mesh(
        track(new THREE.TorusGeometry(radius * 0.985, radius * 0.02, 10, 128)),
        emissiveMaterial
    );
    innerGlowRim.rotation.x = Math.PI / 2;
    group.add(innerGlowRim);

    const dummy = new THREE.Object3D();

    const armature = new THREE.Group();
    const plates = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(radius * 0.42, radius * 0.13, radius * 0.3)),
        hullMaterial,
        ARMATURE_SEGMENTS
    );
    const inlays = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(radius * 0.3, radius * 0.035, radius * 0.34)),
        emissiveMaterial,
        ARMATURE_SEGMENTS
    );
    for (let i = 0; i < ARMATURE_SEGMENTS; i++) {
        const angle = (i / ARMATURE_SEGMENTS) * Math.PI * 2;
        const x = Math.cos(angle) * radius * 1.42;
        const z = Math.sin(angle) * radius * 1.42;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, -angle, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        plates.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, sign * radius * 0.055, z);
        dummy.updateMatrix();
        inlays.setMatrixAt(i, dummy.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    inlays.instanceMatrix.needsUpdate = true;
    plates.computeBoundingSphere();
    inlays.computeBoundingSphere();
    armature.add(plates, inlays);
    group.add(armature);

    const struts = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(radius * 0.42, radius * 0.05, radius * 0.07)),
        hullMaterial,
        STRUT_COUNT
    );
    for (let i = 0; i < STRUT_COUNT; i++) {
        const angle = (i / STRUT_COUNT) * Math.PI * 2 + Math.PI / STRUT_COUNT;
        dummy.position.set(Math.cos(angle) * radius * 1.21, 0, Math.sin(angle) * radius * 1.21);
        dummy.rotation.set(0, -angle, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        struts.setMatrixAt(i, dummy.matrix);
    }
    struts.instanceMatrix.needsUpdate = true;
    struts.computeBoundingSphere();
    group.add(struts);

    const shards = new THREE.InstancedMesh(
        track(new THREE.OctahedronGeometry(radius * 0.06, 0)),
        emissiveMaterial,
        SHARD_COUNT
    );
    shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shards.frustumCulled = false;
    group.add(shards);

    const moteUniforms = { uTime: { value: 0 }, uRadius: { value: radius }, uTint: { value: new THREE.Color(options.inner) } };
    const moteGeometry = track(new THREE.BufferGeometry());
    {
        const positions = new Float32Array(MOTE_COUNT * 3);
        const angles = new Float32Array(MOTE_COUNT);
        const radii = new Float32Array(MOTE_COUNT);
        const speeds = new Float32Array(MOTE_COUNT);
        const depths = new Float32Array(MOTE_COUNT);
        const sizes = new Float32Array(MOTE_COUNT);

        for (let i = 0; i < MOTE_COUNT; i++) {
            angles[i] = Math.random() * Math.PI * 2;
            radii[i] = radius * (1.05 + Math.random() * 0.75);
            speeds[i] = 0.08 + Math.random() * 0.14;
            depths[i] = Math.random();
            sizes[i] = 0.8 + Math.random() * 2.2;
        }

        moteGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        moteGeometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
        moteGeometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
        moteGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
        moteGeometry.setAttribute("aDepth", new THREE.BufferAttribute(depths, 1));
        moteGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    }
    const motes = new THREE.Points(
        moteGeometry,
        trackMaterial(new THREE.ShaderMaterial({
            uniforms: moteUniforms,
            vertexShader: moteVertex,
            fragmentShader: moteFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        }))
    );
    motes.frustumCulled = false;
    motes.scale.y = sign;
    group.add(motes);

    const beamUniforms = {
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(options.inner) },
        uEmitAtTop: { value: facing === "down" ? 1 : 0 },
    };
    if (options.withBeam) {
        const beamHeight = radius * 4.2;
        const narrow = radius * 0.96;
        const wide = radius * 1.75;
        const beamGeometry = track(new THREE.CylinderGeometry(
            facing === "down" ? narrow : wide,
            facing === "down" ? wide : narrow,
            beamHeight,
            48,
            1,
            true
        ));
        const beam = new THREE.Mesh(
            beamGeometry,
            trackMaterial(new THREE.ShaderMaterial({
                uniforms: beamUniforms,
                vertexShader: beamVertex,
                fragmentShader: beamFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
            }))
        );
        beam.position.y = sign * beamHeight * 0.5;
        beam.name = PORTAL_EXTRA_LAYER;
        group.add(beam);
    }

    let time = 0;

    return {
        group,
        update: (delta: number) => {
            time += delta;

            vortexUniforms.uTime.value = time;
            lensUniforms.uTime.value = time;
            runeUniforms.uTime.value = time;
            moteUniforms.uTime.value = time;
            beamUniforms.uTime.value = time;

            armature.rotation.y += delta * 0.12;
            innerGlowRim.rotation.z += delta * 0.3;
            emissiveMaterial.emissiveIntensity = 2.2 + Math.sin(time * 1.6) * 0.7;

            for (let i = 0; i < SHARD_COUNT; i++) {
                const angle = (i / SHARD_COUNT) * Math.PI * 2 - time * 0.3;
                const tilt = (i % 3) * 0.25;
                const orbit = radius * (1.62 + tilt * 0.2);
                const bob = Math.sin(time * 1.4 + i) * radius * 0.09;

                dummy.position.set(Math.cos(angle) * orbit, bob + sign * radius * 0.12, Math.sin(angle) * orbit);
                dummy.rotation.set(0, -angle, Math.sin(time * 0.9 + i) * 0.5);
                dummy.scale.set(0.6, 1.9, 0.6);
                dummy.updateMatrix();
                shards.setMatrixAt(i, dummy.matrix);
            }
            shards.instanceMatrix.needsUpdate = true;
        },
        dispose: () => {
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
            group.removeFromParent();
        },
    };
}
