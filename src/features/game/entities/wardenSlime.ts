// src/features/game/entities/wardenSlime.ts
import * as THREE from "three";
import type { CompanionInstance, CompanionMood } from "./companionModels";

const GEL_RADIUS = 0.38;
const BASE_LIFT = 0.227;
const TAU = Math.PI * 2;

const GEL_COLOR = 0x54dc86;
const GEL_DEEP = 0x1d7a4d;
const RIM_COLOR = 0xbdffd6;
const WARDEN_COLOR = 0x8f3cff;
const RAGE_COLOR = 0xff2f5f;
const GOLD_COLOR = 0xffd166;
const GOLD_DEEP = 0xb47714;
const DARK = 0x120d1a;
const EYE_CALM = 0x9effc4;

const GEL_UNIFORMS = /* glsl */`
    uniform float uTime;
    uniform float uSquash;
    uniform float uSpread;
    uniform float uWobble;
    uniform float uMelt;
    uniform vec3 uLean;
`;

const GEL_BODY = /* glsl */`
    float ripple =
        sin(transformed.y * 6.4 + uTime * 5.4) * 0.5 +
        sin(transformed.x * 8.1 - uTime * 4.3) * 0.3 +
        sin(transformed.z * 7.3 + uTime * 6.1) * 0.2;

    float faceMask = smoothstep(0.5, 0.95, normalize(position).z);
    transformed += normal * ripple * uWobble * (1.0 - faceMask * 0.9);

    float gravity = smoothstep(0.34, -0.36, transformed.y);
    float pool = gravity * (0.2 + uMelt * 0.22);
    transformed.x *= 1.0 + pool;
    transformed.z *= 1.0 + pool;
    transformed.y = mix(transformed.y, max(transformed.y, -0.2), 0.85);

    transformed.y *= uSquash;
    transformed.x *= uSpread;
    transformed.z *= uSpread;
    transformed += uLean * (transformed.y + 0.38);
`;

const SHELL_VERTEX = /* glsl */`
    ${GEL_UNIFORMS}

    varying vec3 vNormalView;
    varying vec3 vViewPosition;

    void main() {
        vec3 transformed = position;
        ${GEL_BODY}

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

        float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 2.1);
        float band = 0.3 + fresnel * 0.7;

        gl_FragColor = vec4(uColor * band * uIntensity, fresnel * uOpacity);
    }
`;

const SPIKE_LAYOUT: Array<{ polar: number; azimuth: number; length: number }> = [
    { polar: 1.08, azimuth: 1.05, length: 0.15 },
    { polar: 1.08, azimuth: 2.09, length: 0.13 },
    { polar: 1.08, azimuth: 3.14, length: 0.16 },
    { polar: 1.08, azimuth: 4.19, length: 0.13 },
    { polar: 1.08, azimuth: 5.24, length: 0.15 },
    { polar: 0.44, azimuth: 0.52, length: 0.12 },
    { polar: 0.44, azimuth: 2.62, length: 0.14 },
    { polar: 0.44, azimuth: 4.71, length: 0.12 },
];

const CROWN_POINTS = [0.14, 0.1, 0.16, 0.06, 0.11];
const FACE_Y = 0.1;
const FACE_INSET = 0.085;
const BROW_INSET = 0.055;
const SMILE_INSET = 0.06;
const MAW_INSET = 0.075;
const MUZZLE_OUTSET = 0.02;
const MAX_WOBBLE = 0.075;

let moteTexture: THREE.CanvasTexture | null = null;

function getMoteTexture(): THREE.CanvasTexture | null {
    if (moteTexture) return moteTexture;
    if (typeof document === "undefined") return null;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const half = size * 0.5;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.6)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    moteTexture = new THREE.CanvasTexture(canvas);
    moteTexture.colorSpace = THREE.SRGBColorSpace;
    return moteTexture;
}

function approach(current: number, target: number, rate: number, delta: number): number {
    return current + (target - current) * (1 - Math.exp(-rate * delta));
}

function gelSurfaceZ(localY: number, squash: number, spread: number, melt: number): number {
    const source = localY / Math.max(0.05, squash);
    const clamped = Math.min(GEL_RADIUS, Math.abs(source));
    const radius = Math.sqrt(Math.max(0, GEL_RADIUS * GEL_RADIUS - clamped * clamped));
    const t = Math.min(1, Math.max(0, (source - 0.34) / -0.7));
    const gravity = t * t * (3 - 2 * t);
    return radius * (1 + gravity * (0.2 + melt * 0.22)) * spread;
}

export function createWardenSlime(): CompanionInstance {
    const root = new THREE.Group();
    root.name = "pet-slime";

    const uniforms = {
        uTime: { value: 0 },
        uSquash: { value: 1 },
        uSpread: { value: 1 },
        uWobble: { value: 0.014 },
        uMelt: { value: 0 },
        uLean: { value: new THREE.Vector3() },
    };

    const gelBase = new THREE.Color(GEL_COLOR);
    const gelDeep = new THREE.Color(GEL_DEEP);
    const rim = new THREE.Color(RIM_COLOR);
    const warden = new THREE.Color(WARDEN_COLOR);
    const rageTone = new THREE.Color(RAGE_COLOR);
    const eyeCalm = new THREE.Color(EYE_CALM);
    const gold = new THREE.Color(GOLD_COLOR);
    const scratch = new THREE.Color();

    const body = new THREE.Group();
    root.add(body);

    const gelGeometry = new THREE.IcosahedronGeometry(GEL_RADIUS, 3);
    gelGeometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(-GEL_RADIUS * 1.2, -BASE_LIFT, -GEL_RADIUS * 1.2),
        new THREE.Vector3(GEL_RADIUS * 1.2, GEL_RADIUS, GEL_RADIUS * 1.2)
    );

    const gelMat = new THREE.MeshStandardMaterial({
        color: gelBase.clone().multiplyScalar(0.82),
        roughness: 0.16,
        metalness: 0,
        transparent: true,
        opacity: 0.66,
        depthWrite: false,
        emissive: gelDeep.clone(),
        emissiveIntensity: 0.9,
    });
    gelMat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = GEL_UNIFORMS + shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\n${GEL_BODY}`
        );
    };

    const gel = new THREE.Mesh(gelGeometry, gelMat);
    gel.castShadow = true;
    gel.renderOrder = 1;
    body.add(gel);

    const shellMat = new THREE.ShaderMaterial({
        uniforms: {
            ...uniforms,
            uColor: { value: rim.clone() },
            uIntensity: { value: 1.3 },
            uOpacity: { value: 0.8 },
        },
        vertexShader: SHELL_VERTEX,
        fragmentShader: SHELL_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
    });

    const shell = new THREE.Mesh(gelGeometry, shellMat);
    shell.scale.setScalar(1.05);
    shell.renderOrder = 5;
    body.add(shell);

    const heartMat = new THREE.MeshBasicMaterial({ color: warden.clone(), toneMapped: false });
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), heartMat);
    heart.renderOrder = 2;
    body.add(heart);

    const cageMat = new THREE.MeshBasicMaterial({
        color: gold.clone(),
        toneMapped: false,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
    });
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), cageMat);
    cage.renderOrder = 2;
    body.add(cage);

    const face = new THREE.Group();
    face.renderOrder = 3;
    body.add(face);

    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xf4fff4,
        emissive: new THREE.Color(EYE_CALM),
        emissiveIntensity: 0.85,
        roughness: 0.22,
        metalness: 0,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: DARK, toneMapped: false });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

    const eyeGeometry = new THREE.SphereGeometry(0.062, 14, 12);
    const pupilGeometry = new THREE.SphereGeometry(0.032, 10, 8);
    const glintGeometry = new THREE.SphereGeometry(0.011, 6, 6);

    const eyes: THREE.Mesh[] = [];
    const pupils: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeometry, eyeMat);
        eye.position.set(side * 0.095, 0, 0);
        eye.renderOrder = 3;
        face.add(eye);
        eyes.push(eye);

        const pupil = new THREE.Mesh(pupilGeometry, pupilMat);
        pupil.position.set(0, 0, 0.042);
        pupil.renderOrder = 4;
        eye.add(pupil);
        pupils.push(pupil);

        const glint = new THREE.Mesh(glintGeometry, glintMat);
        glint.position.set(side * 0.016, 0.024, 0.05);
        glint.renderOrder = 4;
        eye.add(glint);
    }

    const browMat = new THREE.MeshStandardMaterial({
        color: 0x1c6f45,
        emissive: new THREE.Color(0x0d3a24),
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0,
    });
    const browGeometry = new THREE.BoxGeometry(0.13, 0.026, 0.03);
    const brows: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
        const brow = new THREE.Mesh(browGeometry, browMat);
        brow.position.set(side * 0.1, 0.07, 0);
        brow.renderOrder = 4;
        face.add(brow);
        brows.push(brow);
    }

    const smileMat = new THREE.MeshBasicMaterial({
        color: DARK,
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
    });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 16, Math.PI), smileMat);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.085, 0);
    smile.renderOrder = 4;
    face.add(smile);

    const maw = new THREE.Group();
    maw.position.set(0, -0.102, 0);
    face.add(maw);

    const mawMat = new THREE.MeshBasicMaterial({
        color: 0x14060f,
        toneMapped: false,
        transparent: true,
        opacity: 0,
    });
    const mawShell = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), mawMat);
    mawShell.scale.set(1, 0.68, 0.4);
    mawShell.renderOrder = 4;
    maw.add(mawShell);

    const fangMat = new THREE.MeshBasicMaterial({
        color: 0xe8fff0,
        toneMapped: false,
        transparent: true,
        opacity: 0,
    });
    const fangGeometry = new THREE.ConeGeometry(0.014, 0.042, 4);
    for (const spec of [
        { x: -0.036, y: 0.052, flip: 1 },
        { x: 0.036, y: 0.052, flip: 1 },
        { x: 0, y: -0.05, flip: -1 },
    ]) {
        const fang = new THREE.Mesh(fangGeometry, fangMat);
        fang.position.set(spec.x, spec.y, 0.03);
        fang.rotation.z = spec.flip > 0 ? Math.PI : 0;
        fang.renderOrder = 5;
        maw.add(fang);
    }

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.1, 0);
    face.add(muzzle);

    const spikeGroup = new THREE.Group();
    spikeGroup.visible = false;
    body.add(spikeGroup);

    const spikeMat = new THREE.MeshStandardMaterial({
        color: gelBase.clone().multiplyScalar(0.9),
        emissive: new THREE.Color(RAGE_COLOR),
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.05,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
    });

    const spikes: THREE.Mesh[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const spec of SPIKE_LAYOUT) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, spec.length, 5), spikeMat);
        const sinP = Math.sin(spec.polar);
        const dir = new THREE.Vector3(
            sinP * Math.cos(spec.azimuth),
            Math.cos(spec.polar),
            sinP * Math.sin(spec.azimuth)
        );
        spike.position.copy(dir).multiplyScalar(GEL_RADIUS * 0.82);
        spike.quaternion.setFromUnitVectors(up, dir);
        spike.renderOrder = 2;
        spikeGroup.add(spike);
        spikes.push(spike);
    }

    const lootMat = new THREE.MeshBasicMaterial({ color: gold.clone(), toneMapped: false });
    const loot = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), lootMat);
    loot.position.set(0, -0.05, 0.06);
    loot.visible = false;
    loot.renderOrder = 2;
    body.add(loot);

    const drips: THREE.Mesh[] = [];
    const dripMats: THREE.MeshStandardMaterial[] = [];
    const dripGeometry = new THREE.SphereGeometry(0.048, 8, 6);
    for (let i = 0; i < 4; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: gelBase.clone().multiplyScalar(0.85),
            emissive: gelDeep.clone(),
            emissiveIntensity: 0.7,
            roughness: 0.18,
            metalness: 0,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
        });
        const drip = new THREE.Mesh(dripGeometry, material);
        drip.renderOrder = 2;
        root.add(drip);
        drips.push(drip);
        dripMats.push(material);
    }

    const crown = new THREE.Group();
    root.add(crown);

    const crownMat = new THREE.MeshStandardMaterial({
        color: gold.clone(),
        emissive: new THREE.Color(GOLD_DEEP),
        emissiveIntensity: 1.5,
        roughness: 0.28,
        metalness: 0.65,
    });

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 20), crownMat);
    band.rotation.x = Math.PI / 2;
    band.castShadow = true;
    crown.add(band);

    for (let i = 0; i < CROWN_POINTS.length; i++) {
        const angle = (i / CROWN_POINTS.length) * TAU;
        const height = CROWN_POINTS[i];
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.032, height, 4), crownMat);
        point.position.set(Math.cos(angle) * 0.17, height * 0.5, Math.sin(angle) * 0.17);
        point.rotation.y = -angle;
        if (i === 3) point.rotation.z = 0.55;
        crown.add(point);
    }

    const gemMat = new THREE.MeshBasicMaterial({ color: warden.clone(), toneMapped: false });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.046, 0), gemMat);
    gem.position.set(0, 0.055, 0.17);
    crown.add(gem);

    const shardMat = new THREE.MeshStandardMaterial({
        color: gold.clone(),
        emissive: new THREE.Color(GOLD_DEEP),
        emissiveIntensity: 1.6,
        roughness: 0.3,
        metalness: 0.5,
    });
    const shardGeometry = new THREE.TetrahedronGeometry(0.055, 0);
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(shardGeometry, shardMat);
        root.add(shard);
        shards.push(shard);
    }

    const moteCount = 26;
    const motePositions = new Float32Array(moteCount * 3);
    const moteSeeds = new Float32Array(moteCount);
    const moteSpread = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
        moteSeeds[i] = Math.random();
        moteSpread[i] = 0.16 + Math.random() * 0.3;
    }

    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));

    const moteMat = new THREE.PointsMaterial({
        color: rim.clone(),
        size: 0.075,
        map: getMoteTexture(),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    const motes = new THREE.Points(moteGeometry, moteMat);
    motes.frustumCulled = false;
    root.add(motes);

    const light = new THREE.PointLight(GEL_COLOR, 1.1, 5.2, 2);
    light.position.y = 0.3;
    root.add(light);

    let rage = 0;
    let rest = 0;
    let run = 0;
    let hold = 0;
    let hopPhase = 0;
    let orbitPhase = 0;
    let splat = 0;
    let lean = 0;
    let blinkTimer = 1.6;
    let blink = 0;
    let wake = 0;
    let flinch = 0;
    let wasSettling = false;
    let wasCombat = false;
    let attackTime = -1;

    const update = (elapsed: number, speed01: number, carrying: boolean, mood?: CompanionMood) => {
        const delta = Math.min(0.1, Math.max(0.0005, mood?.delta ?? 1 / 60));
        const combat = mood?.combat === true;
        const settling = !combat && mood?.resting === true;

        if (combat && !wasCombat) flinch = 1;
        if (!settling && wasSettling && rest > 0.3) wake = 1;
        wasCombat = combat;
        wasSettling = settling;

        wake = Math.max(0, wake - delta * 2.6);
        flinch = Math.max(0, flinch - delta * 2.2);

        const wakePop = Math.sin(wake * Math.PI);
        const flinchPop = Math.sin(flinch * Math.PI);

        let lunge = 0;
        let spit = 0;
        let strike = 1;

        if (attackTime >= 0) {
            attackTime += delta;
            if (attackTime < 0.09) {
                const t = attackTime / 0.09;
                lunge = t;
                spit = 1;
                strike = 1 + t * 0.3;
            } else if (attackTime < 0.26) {
                const t = (attackTime - 0.09) / 0.17;
                lunge = 1 - t * 1.4;
                spit = attackTime < 0.14 ? 1 : 1 - (attackTime - 0.14) / 0.26;
                strike = 1.3 - t * 0.5;
            } else if (attackTime < 0.5) {
                const t = (attackTime - 0.26) / 0.24;
                lunge = -0.4 + t * 0.4;
                spit = Math.max(0, 1 - (attackTime - 0.14) / 0.26);
                strike = 0.8 + t * 0.2;
            } else {
                attackTime = -1;
            }
        }

        rage = approach(rage, combat ? 1 : 0, combat ? 9 : 1.3, delta);
        rest = approach(rest, settling ? 1 : 0, settling ? 0.9 : 7, delta);
        run = approach(run, Math.min(1, Math.max(0, speed01)), 6, delta);
        hold = approach(hold, carrying ? 1 : 0, 5, delta);

        const previousPhase = hopPhase;
        hopPhase += delta * (2 + run * 9.5 + rage * 3) * (1 - rest * 0.8);
        orbitPhase += delta * (0.9 + rage * 3.2 - rest * 0.55);

        if (run > 0.15 && Math.floor(previousPhase / Math.PI) !== Math.floor(hopPhase / Math.PI)) splat = 1;
        splat = Math.max(0, splat - delta * 5.5);

        const wave = Math.sin(hopPhase);
        const air = Math.max(0, wave) * run;
        const land = Math.max(0, -wave) * run;
        const hop = air * (0.11 + run * 0.15 + rage * 0.05) + flinchPop * 0.06 + wakePop * 0.03
            + Math.max(0, lunge) * 0.05;

        let squash = 1 + air * 0.24 - land * 0.2 - splat * 0.16;
        squash *= 1 + Math.sin(elapsed * (1.7 + rage * 5.2) * (1 - rest * 0.45)) * (0.028 + rage * 0.045 + rest * 0.05);
        squash *= 1 - rest * 0.44;
        squash *= 1 + rage * 0.14 + hold * 0.08;
        squash *= 1 + wakePop * 0.2 + flinchPop * 0.14;
        squash *= strike;
        squash = Math.min(1.8, Math.max(0.4, squash));

        const spread = 1 / Math.sqrt(squash);

        uniforms.uTime.value = elapsed;
        uniforms.uSquash.value = squash;
        uniforms.uSpread.value = spread;
        uniforms.uWobble.value = Math.min(
            MAX_WOBBLE,
            0.013 + splat * 0.05 + rage * 0.03 + run * 0.012 + flinchPop * 0.045 + wakePop * 0.03 + spit * 0.03
        );
        uniforms.uMelt.value = rest;

        const targetLean = (run * 0.14 + rage * 0.1) * (1 - rest);
        lean += (targetLean - lean) * Math.min(1, delta * 6);

        const strikeLean = lean + lunge * 0.2;
        uniforms.uLean.value.set(0, 0, strikeLean);

        const lift = BASE_LIFT * squash;
        body.position.y = lift + hop;
        body.position.z = lunge * 0.1;
        body.rotation.z = Math.sin(elapsed * 0.9) * 0.02 * (1 - rest);

        gelMat.emissive.lerpColors(gelDeep, rageTone, rage * 0.75);
        gelMat.emissiveIntensity = 0.9 + rage * 0.9 + splat * 0.5;
        gelMat.opacity = 0.66 + rage * 0.1 - rest * 0.04;

        shellMat.uniforms.uColor.value.lerpColors(rim, rageTone, rage);
        shellMat.uniforms.uIntensity.value = 1.3 + rage * 1.7 + splat * 1.2 + spit * 1.4 - rest * 0.5;
        shellMat.uniforms.uOpacity.value = 0.8 - rest * 0.28;

        heart.position.y = -0.02 * squash;
        heart.rotation.y = elapsed * (0.9 + rage * 3.4) * (1 - rest * 0.7);
        heart.rotation.x = elapsed * (0.5 + rage * 1.8);
        const heartPulse = 0.9 + Math.sin(elapsed * (2.4 + rage * 6)) * 0.1;
        heart.scale.setScalar(heartPulse * (1 + rage * 0.35) * (1 - rest * 0.22));
        heartMat.color.lerpColors(warden, rageTone, rage);

        cage.position.y = heart.position.y;
        cage.rotation.y = -heart.rotation.y * 0.55;
        cage.rotation.z = elapsed * 0.4;
        cage.scale.setScalar((1 + rage * 0.28) * (1 - rest * 0.18));
        cageMat.color.lerpColors(gold, rageTone, rage * 0.8);
        cageMat.opacity = 0.5 + rage * 0.3 - rest * 0.25;

        const faceY = FACE_Y * squash;
        const faceScaleY = 1 + (squash - 1) * 0.5;
        const skinAt = (localY: number) => {
            const at = faceY + localY * faceScaleY;
            return gelSurfaceZ(at, squash, spread, rest) + strikeLean * (at + 0.38);
        };

        face.position.set(0, faceY, skinAt(0) - FACE_INSET);
        face.scale.set(1 + (spread - 1) * 0.5, faceScaleY, 1);

        const skinBase = face.position.z;
        brows[0].position.z = skinAt(0.07) - BROW_INSET - skinBase;
        brows[1].position.z = brows[0].position.z;
        smile.position.z = skinAt(-0.085) - SMILE_INSET - skinBase;
        maw.position.z = skinAt(-0.102) - MAW_INSET - skinBase;
        muzzle.position.z = skinAt(-0.1) + MUZZLE_OUTSET - skinBase;

        blinkTimer -= delta;
        if (blinkTimer <= 0) {
            blink = 1;
            blinkTimer = 2.2 + Math.random() * 2.6;
        }
        blink = Math.max(0, blink - delta * 7);

        const lidClose = Math.max(rest * 0.94, Math.sin(Math.min(1, blink) * Math.PI) * 0.92);
        const openness = Math.max(0.06, (1 - lidClose) * (1 - rage * 0.32));

        for (let i = 0; i < eyes.length; i++) {
            const side = i === 0 ? -1 : 1;
            const eye = eyes[i];
            eye.position.x = side * (0.095 - rage * 0.008);
            eye.position.y = rage * 0.012 - rest * 0.01;
            eye.scale.set(1 + rage * 0.12, openness, 1);
            eye.rotation.z = side * rage * -0.4;
            pupils[i].scale.setScalar(1 - rage * 0.42);
        }

        eyeMat.emissive.lerpColors(eyeCalm, rageTone, rage);
        eyeMat.emissiveIntensity = 0.85 + rage * 0.9 - rest * 0.4;

        for (let i = 0; i < brows.length; i++) {
            const side = i === 0 ? -1 : 1;
            const brow = brows[i];
            brow.position.x = side * (0.1 - rage * 0.012);
            brow.position.y = 0.07 - rage * 0.03 + rest * 0.012;
            brow.rotation.z = side * (-0.08 + rage * 0.92 - rest * 0.3);
            brow.scale.set(1 + rage * 0.12, 1 + rage * 0.5, 1);
        }

        smileMat.opacity = Math.max(0, 0.9 - rage * 1.6);
        smile.scale.set(1 - rest * 0.42, (1 - rest * 0.3) * (0.9 + Math.sin(elapsed * 1.5) * 0.1 * rest), 1);

        const mawOpen = Math.max(spit, Math.max(0, rage - 0.12) / 0.88);
        mawMat.opacity = mawOpen * 0.95;
        fangMat.opacity = mawOpen * 0.95;
        maw.scale.set(0.6 + mawOpen * 0.55, 0.5 + mawOpen * (0.7 + Math.abs(Math.sin(elapsed * 7)) * 0.25), 1);
        maw.visible = mawOpen > 0.02;

        spikeGroup.visible = rage > 0.03;
        if (spikeGroup.visible) {
            spikeGroup.scale.set(spread, squash, spread);
            for (let i = 0; i < spikes.length; i++) {
                const jitter = 0.82 + Math.sin(elapsed * 7 + i * 1.7) * 0.16;
                spikes[i].scale.setScalar(rage * jitter);
            }
            spikeMat.emissiveIntensity = 0.4 + rage * 0.9;
            spikeMat.opacity = 0.55 + rage * 0.35;
        }

        loot.visible = hold > 0.03;
        if (loot.visible) {
            loot.position.y = -0.05 * squash;
            loot.rotation.y = elapsed * 2.2;
            loot.rotation.x = elapsed * 1.1;
            loot.scale.setScalar(hold * (0.9 + Math.sin(elapsed * 6) * 0.1));
        }

        const dripReach = (0.24 + rest * 0.14) * spread;
        for (let i = 0; i < drips.length; i++) {
            const fall = (elapsed * (0.5 + i * 0.09) + i * 0.27) % 1;
            const angle = i * (TAU / drips.length) + 0.6 + rage * 0.4;
            drips[i].position.set(
                Math.cos(angle) * dripReach,
                Math.max(0.01, lift + hop * 0.35 - 0.02 - fall * (0.17 + rest * 0.05)),
                Math.sin(angle) * dripReach
            );
            drips[i].scale.setScalar((0.85 - fall * 0.45) * (0.8 + rest * 0.45));
            dripMats[i].opacity = 0.55 * (1 - fall) * (0.7 + rest * 0.5);
            dripMats[i].emissive.lerpColors(gelDeep, rageTone, rage * 0.6);
        }

        const crownLag = Math.max(0, Math.sin(hopPhase - 0.55)) * run * 0.1;
        crown.position.y = lift + GEL_RADIUS * squash + 0.16 + crownLag + hop * 0.8 - rest * 0.13 + rage * 0.05;
        crown.position.y += flinchPop * 0.08 + wakePop * 0.05;
        crown.position.z = lean * 0.35 - rest * 0.06 + lunge * 0.06;
        crown.rotation.y += delta * (0.55 + rage * 2.8) * (1 - rest * 0.85);
        crown.rotation.x = -0.05 + rage * 0.22 - rest * 0.08 + hold * 0.12;
        crown.rotation.z = Math.sin(elapsed * 0.8) * 0.05 * (1 - rest) + rest * 0.48;
        crownMat.emissiveIntensity = 1.2 + Math.sin(elapsed * 2.2) * 0.25 + rage * 1.2 - rest * 0.6;
        crownMat.color.lerpColors(gold, rageTone, rage * 0.55);
        gemMat.color.lerpColors(warden, rageTone, rage);

        const orbitRadius = 0.46 - rage * 0.1 + rest * 0.18;
        const orbitHeight = 0.3 + rage * 0.12 - rest * 0.25;
        for (let i = 0; i < shards.length; i++) {
            const angle = orbitPhase + (i / shards.length) * TAU;
            const shard = shards[i];
            shard.position.set(
                Math.cos(angle) * orbitRadius,
                Math.max(0.05, orbitHeight + Math.sin(elapsed * 1.6 + i) * 0.05 * (1 - rest)),
                Math.sin(angle) * orbitRadius
            );
            shard.rotation.y = -angle;
            shard.rotation.x = elapsed * (1.1 + i * 0.2) * (1 - rage * 0.8) + rage * Math.PI * 0.5;
            shard.rotation.z = Math.sin(elapsed + i) * 0.4 * (1 - rage);
            shard.scale.setScalar((0.85 + rage * 0.35) * (1 - rest * 0.25));
        }
        shardMat.color.lerpColors(gold, rageTone, rage * 0.7);
        shardMat.emissiveIntensity = 1.3 + rage * 1.4 - rest * 0.7;

        const pulse = 0.5 + Math.abs(Math.sin(elapsed * (1.5 + rage * 2.4))) * 0.5;

        const moteRise = 0.7 + rage * 0.35;
        for (let i = 0; i < moteCount; i++) {
            const seed = moteSeeds[i];
            const climb = (elapsed * (0.28 + seed * 0.3) * (0.7 + rage * 1.5) + seed) % 1;
            const angle = seed * TAU + elapsed * (0.4 + rage * 1.2);
            const radius = moteSpread[i] * (1 + rage * 0.35) * (1 - rest * 0.35);
            motePositions[i * 3] = Math.cos(angle) * radius;
            motePositions[i * 3 + 1] = 0.04 + climb * moteRise * (1 - rest * 0.55);
            motePositions[i * 3 + 2] = Math.sin(angle) * radius;
        }
        moteGeometry.attributes.position.needsUpdate = true;
        moteMat.color.lerpColors(rim, rageTone, rage);
        moteMat.opacity = Math.max(0, 0.45 + rage * 0.4 - rest * 0.3);
        moteMat.size = 0.07 + rage * 0.02;

        scratch.lerpColors(gelBase, rageTone, rage);
        light.color.copy(scratch);
        light.intensity = (0.85 + pulse * 0.3 + rage * 1.7 + spit * 1.2) * (1 - rest * 0.45);
        light.position.y = lift + 0.2 * squash + hop;
    };

    const dispose = () => {
        root.traverse((object) => {
            const renderable = object as THREE.Mesh & THREE.Points;
            if (!renderable.isMesh && !renderable.isPoints) return;
            renderable.geometry?.dispose();
            const material = renderable.material as THREE.Material | THREE.Material[];
            const list = Array.isArray(material) ? material : [material];
            for (const entry of list) entry?.dispose();
        });
        root.removeFromParent();
    };

    const attack = () => {
        attackTime = 0;
        flinch = Math.max(flinch, 0.55);
    };

    const getMuzzle = (out: THREE.Vector3): boolean => {
        muzzle.getWorldPosition(out);
        return true;
    };

    return { root, update, dispose, attack, getMuzzle };
}
