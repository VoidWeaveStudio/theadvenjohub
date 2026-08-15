// src/features/game/world/locations/main-world/utils/proceduralTree.ts
import * as THREE from "three";
import { createRandom } from "./worldNoise";

export interface TreeSpecies {
    id: string;
    levels: number;
    children: number[];
    branchAngle: number[];
    angleVariance: number;
    lengthRatio: number;
    trunkLength: number;
    trunkRadius: number;
    taper: number;
    taperCurve: number;
    rootFlare: number;
    flareFraction: number;
    radiusExponent: number;
    minRadius: number;
    minLength: number;
    droop: number;
    upPull: number;
    gnarl: number[];
    radialSegments: number;
    sectionLength: number;
    childStart: number;
    trunkClear: number;
    leafCount: number;
    leafSize: number;
    leafAspect: number;
    barkBase: number;
    barkTop: number;
    leafInner: number;
    leafOuter: number;
    leafTop: number;
}

export interface TreeLodPreset {
    levels: number;
    radialSegments: number;
    sectionLength: number;
    leafFactor: number;
    leafScale: number;
    crossed: boolean;
}

export const TREE_LODS: TreeLodPreset[] = [
    { levels: 0, radialSegments: 0, sectionLength: 1, leafFactor: 1, leafScale: 1, crossed: true },
    { levels: 0, radialSegments: -2, sectionLength: 1.7, leafFactor: 0.72, leafScale: 1.35, crossed: false },
    { levels: -1, radialSegments: -3, sectionLength: 2.8, leafFactor: 0.42, leafScale: 1.95, crossed: false },
];

export interface TreeGeometry {
    bark: THREE.BufferGeometry;
    canopy: THREE.BufferGeometry;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = new THREE.Vector3(0, 1, 0);

interface BranchTask {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
    radius: number;
    level: number;
    phase: number;
}

interface BranchRing {
    position: THREE.Vector3;
    tangent: THREE.Vector3;
    normal: THREE.Vector3;
    radius: number;
}

interface BarkBuffer {
    positions: number[];
    normals: number[];
    colors: number[];
    flex: number[];
    indices: number[];
}

const _axis = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _tipColor = new THREE.Color();
const _baseColor = new THREE.Color();
const _ringColor = new THREE.Color();

function perpendicular(direction: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    if (Math.abs(direction.x) < 0.9) target.set(1, 0, 0);
    else target.set(0, 1, 0);

    target.cross(direction).normalize();
    return target;
}

function transport(from: THREE.Vector3, to: THREE.Vector3, normal: THREE.Vector3) {
    _axis.crossVectors(from, to);
    const sin = _axis.length();
    if (sin < 1e-6) return;

    _axis.divideScalar(sin);
    normal.applyAxisAngle(_axis, Math.atan2(sin, from.dot(to))).normalize();
}

function shuffledSlots(count: number, random: () => number): number[] {
    const slots = Array.from({ length: count }, (_, i) => i);

    for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const swap = slots[i];
        slots[i] = slots[j];
        slots[j] = swap;
    }

    return slots;
}

function ringAt(rings: BranchRing[], t: number): BranchRing {
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * (rings.length - 1);
    const index = Math.min(rings.length - 2, Math.floor(scaled));
    const fraction = scaled - index;

    const a = rings[index];
    const b = rings[index + 1];

    return {
        position: a.position.clone().lerp(b.position, fraction),
        tangent: a.tangent.clone().lerp(b.tangent, fraction).normalize(),
        normal: a.normal.clone().lerp(b.normal, fraction).normalize(),
        radius: THREE.MathUtils.lerp(a.radius, b.radius, fraction),
    };
}

function emitTube(
    buffer: BarkBuffer,
    rings: BranchRing[],
    segments: number,
    level: number,
    species: TreeSpecies
) {
    _baseColor.setHex(species.barkBase);
    _tipColor.setHex(species.barkTop);

    let previous = -1;

    for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        const t = r / (rings.length - 1);

        const flex = level === 0
            ? Math.pow(t, 2.2) * 0.5
            : THREE.MathUtils.clamp(0.32 + level * 0.2 + t * 0.35, 0, 1);

        _ringColor.copy(_baseColor).lerp(_tipColor, Math.min(1, level * 0.28 + t * 0.35));
        _binormal.crossVectors(ring.tangent, ring.normal).normalize();

        const start = buffer.positions.length / 3;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            _offset.copy(ring.normal).multiplyScalar(Math.cos(angle)).addScaledVector(_binormal, Math.sin(angle));

            buffer.positions.push(
                ring.position.x + _offset.x * ring.radius,
                ring.position.y + _offset.y * ring.radius,
                ring.position.z + _offset.z * ring.radius
            );
            buffer.normals.push(_offset.x, _offset.y, _offset.z);
            buffer.colors.push(_ringColor.r, _ringColor.g, _ringColor.b);
            buffer.flex.push(flex);
        }

        if (previous >= 0) {
            for (let i = 0; i < segments; i++) {
                const next = (i + 1) % segments;
                buffer.indices.push(previous + i, start + i, previous + next);
                buffer.indices.push(previous + next, start + i, start + next);
            }
        }

        previous = start;
    }
}

function growBranch(
    task: BranchTask,
    species: TreeSpecies,
    lod: TreeLodPreset,
    buffer: BarkBuffer,
    tips: { position: THREE.Vector3; flex: number }[],
    queue: BranchTask[],
    random: () => number
) {
    const levels = Math.max(1, species.levels + lod.levels);
    const segments = Math.max(3, species.radialSegments + lod.radialSegments - task.level);
    const sectionLength = species.sectionLength * lod.sectionLength;
    const sections = Math.max(3, Math.min(24, Math.round(task.length / sectionLength)));

    const gnarl = species.gnarl[Math.min(task.level, species.gnarl.length - 1)];
    const step = task.length / sections;

    const tangent = task.direction.clone().normalize();
    const normal = perpendicular(tangent, new THREE.Vector3());
    const position = task.origin.clone();
    const rings: BranchRing[] = [];

    for (let s = 0; s <= sections; s++) {
        const t = s / sections;

        let radius = task.radius * ((1 - species.taper) + species.taper * Math.pow(1 - t, species.taperCurve));

        if (task.level === 0 && species.rootFlare > 0) {
            const flare = Math.max(0, (species.flareFraction - t) / species.flareFraction);
            radius *= 1 + species.rootFlare * flare * flare * flare;
        }

        radius = Math.max(species.minRadius, radius);

        rings.push({
            position: position.clone(),
            tangent: tangent.clone(),
            normal: normal.clone(),
            radius,
        });

        if (s === sections) break;

        const thinness = THREE.MathUtils.clamp(1 / Math.sqrt(Math.max(radius, 0.02)), 1, 3.2);
        const wobble = gnarl * thinness;

        const next = tangent.clone();
        next.x += (random() * 2 - 1) * wobble;
        next.y += (random() * 2 - 1) * wobble;
        next.z += (random() * 2 - 1) * wobble;
        next.normalize();

        if (task.level > 0 && species.droop > 0) {
            const sag = Math.min(0.2, (species.droop * step) / Math.max(0.08, Math.sqrt(radius)));
            next.y -= sag;
            next.normalize();
        }

        transport(tangent, next, normal);
        position.addScaledVector(next, step);
        tangent.copy(next);
    }

    emitTube(buffer, rings, segments, task.level, species);

    const tipFlex = task.level === 0 ? 0.5 : 1;

    if (task.level >= levels - 1 || task.length < species.minLength) {
        tips.push({ position: rings[rings.length - 1].position.clone(), flex: tipFlex });
        tips.push({ position: ringAt(rings, 0.62).position, flex: tipFlex * 0.9 });
        return;
    }

    const childCount = species.children[Math.min(task.level, species.children.length - 1)];
    const angle = species.branchAngle[Math.min(task.level, species.branchAngle.length - 1)];
    const pipeDrop = Math.pow(1 / childCount, 1 / species.radiusExponent);
    const start = task.level === 0 ? species.trunkClear : species.childStart;
    const slots = shuffledSlots(childCount, random);

    for (let i = 0; i < childCount; i++) {
        const along = start + ((i + 0.5 + (random() - 0.5) * 0.6) / childCount) * (1 - start);
        const ring = ringAt(rings, along);

        const tilt = THREE.MathUtils.degToRad(angle + (random() * 2 - 1) * species.angleVariance);
        const roll = ((slots[i] + random()) / childCount) * Math.PI * 2 + task.phase;

        const direction = ring.tangent.clone()
            .applyAxisAngle(ring.normal, tilt)
            .applyAxisAngle(ring.tangent, roll);

        if (species.upPull > 0) direction.lerp(UP, species.upPull).normalize();

        queue.push({
            origin: ring.position,
            direction,
            length: task.length * species.lengthRatio * (0.85 + random() * 0.3),
            radius: Math.max(species.minRadius, Math.min(task.radius * pipeDrop, ring.radius)),
            level: task.level + 1,
            phase: task.phase + GOLDEN_ANGLE,
        });
    }
}

const CARD_CORNERS = [
    new THREE.Vector2(-0.5, -0.5),
    new THREE.Vector2(0.5, -0.5),
    new THREE.Vector2(0.5, 0.5),
    new THREE.Vector2(-0.5, 0.5),
];

const CARD_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

function buildCanopy(
    tips: { position: THREE.Vector3; flex: number }[],
    species: TreeSpecies,
    lod: TreeLodPreset,
    random: () => number
): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const flexValues: number[] = [];
    const indices: number[] = [];

    const wanted = Math.max(2, Math.round(species.leafCount * lod.leafFactor));
    const stride = Math.max(1, Math.floor(tips.length / wanted));

    const crownCenter = new THREE.Vector3();
    for (const tip of tips) crownCenter.add(tip.position);
    if (tips.length > 0) crownCenter.divideScalar(tips.length);

    let crownRadius = 0.001;
    for (const tip of tips) crownRadius = Math.max(crownRadius, tip.position.distanceTo(crownCenter));

    const inner = new THREE.Color(species.leafInner);
    const outer = new THREE.Color(species.leafOuter);
    const top = new THREE.Color(species.leafTop);

    const radial = new THREE.Vector3();
    const cardNormal = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const anchor = new THREE.Vector3();
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const color = new THREE.Color();
    const quaternion = new THREE.Quaternion();

    const emitCard = (roll: number, tip: { position: THREE.Vector3; flex: number }, size: number) => {
        const base = positions.length / 3;
        const height = size * species.leafAspect;

        quaternion.setFromAxisAngle(radial, roll);
        right.set(1, 0, 0).applyQuaternion(quaternion);
        right.addScaledVector(radial, -right.dot(radial));

        if (right.lengthSq() < 1e-5) right.set(radial.z, 0, -radial.x);
        right.normalize();

        up.crossVectors(radial, right).normalize();
        cardNormal.crossVectors(right, up).normalize();

        for (let c = 0; c < 4; c++) {
            const corner = CARD_CORNERS[c];
            vertex.copy(anchor)
                .addScaledVector(right, corner.x * size)
                .addScaledVector(up, corner.y * height);

            normal.copy(vertex).sub(crownCenter).normalize();
            if (normal.lengthSq() < 1e-5) normal.copy(cardNormal);
            normal.lerp(cardNormal, 0.18).normalize();

            const distance = THREE.MathUtils.clamp(vertex.distanceTo(crownCenter) / crownRadius, 0, 1);
            const elevation = THREE.MathUtils.clamp((vertex.y - crownCenter.y) / (crownRadius * 1.4) + 0.5, 0, 1);

            color.copy(inner).lerp(outer, distance);
            color.lerp(top, elevation * 0.55);

            positions.push(vertex.x, vertex.y, vertex.z);
            normals.push(normal.x, normal.y, normal.z);
            colors.push(color.r, color.g, color.b);
            uvs.push(CARD_UVS[c * 2], CARD_UVS[c * 2 + 1]);
            flexValues.push(tip.flex);
        }

        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let i = 0; i < tips.length; i += stride) {
        const tip = tips[i];
        const size = species.leafSize * lod.leafScale * (0.8 + random() * 0.45);

        radial.copy(tip.position).sub(crownCenter);
        if (radial.lengthSq() < 1e-4) radial.set(random() - 0.5, random() * 0.5 + 0.2, random() - 0.5);
        radial.normalize();

        anchor.copy(tip.position).addScaledVector(radial, size * 0.22);
        anchor.x += (random() - 0.5) * size * 0.3;
        anchor.z += (random() - 0.5) * size * 0.3;
        anchor.y += (random() - 0.5) * size * 0.2;

        const roll = random() * Math.PI * 2;
        emitCard(roll, tip, size);
        if (lod.crossed) emitCard(roll + Math.PI * 0.5, tip, size * 0.94);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("aFlex", new THREE.Float32BufferAttribute(flexValues, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}

export function createTree(species: TreeSpecies, lod: TreeLodPreset, seed: number): TreeGeometry {
    const random = createRandom(seed);

    const buffer: BarkBuffer = { positions: [], normals: [], colors: [], flex: [], indices: [] };
    const tips: { position: THREE.Vector3; flex: number }[] = [];

    const queue: BranchTask[] = [{
        origin: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(0, 1, 0),
        length: species.trunkLength,
        radius: species.trunkRadius,
        level: 0,
        phase: 0,
    }];

    let guard = 0;
    while (queue.length > 0 && guard < 4000) {
        guard++;
        const task = queue.shift()!;
        growBranch(task, species, lod, buffer, tips, queue, random);
    }

    const bark = new THREE.BufferGeometry();
    bark.setAttribute("position", new THREE.Float32BufferAttribute(buffer.positions, 3));
    bark.setAttribute("normal", new THREE.Float32BufferAttribute(buffer.normals, 3));
    bark.setAttribute("color", new THREE.Float32BufferAttribute(buffer.colors, 3));
    bark.setAttribute("aFlex", new THREE.Float32BufferAttribute(buffer.flex, 1));
    bark.setIndex(buffer.indices);
    bark.computeBoundingSphere();

    return { bark, canopy: buildCanopy(tips, species, lod, random) };
}

export const TREE_SPECIES: TreeSpecies[] = [
    {
        id: "oak",
        levels: 4, children: [4, 8, 5], branchAngle: [38, 50, 58], angleVariance: 14,
        lengthRatio: 0.56, trunkLength: 11.5, trunkRadius: 0.46, taper: 0.55, taperCurve: 0.7,
        rootFlare: 0.6, flareFraction: 0.18, radiusExponent: 2.3, minRadius: 0.045, minLength: 0.7,
        droop: 0.05, upPull: 0.3, gnarl: [0.03, 0.07, 0.1, 0.13], radialSegments: 6,
        sectionLength: 1.3, childStart: 0.12, trunkClear: 0.3,
        leafCount: 460, leafSize: 2.15, leafAspect: 0.85,
        barkBase: 0x2f2418, barkTop: 0x574734, leafInner: 0x1d3315, leafOuter: 0x3f6b21, leafTop: 0x6d9a34,
    },
    {
        id: "birch",
        levels: 4, children: [4, 7, 5], branchAngle: [30, 44, 52], angleVariance: 12,
        lengthRatio: 0.58, trunkLength: 13.5, trunkRadius: 0.32, taper: 0.62, taperCurve: 0.8,
        rootFlare: 0.35, flareFraction: 0.12, radiusExponent: 2.1, minRadius: 0.035, minLength: 0.6,
        droop: 0.07, upPull: 0.22, gnarl: [0.02, 0.06, 0.09, 0.12], radialSegments: 6,
        sectionLength: 1.5, childStart: 0.18, trunkClear: 0.42,
        leafCount: 380, leafSize: 1.75, leafAspect: 0.95,
        barkBase: 0x8d8b80, barkTop: 0xa8a294, leafInner: 0x24401c, leafOuter: 0x4f7d28, leafTop: 0x8fb445,
    },
    {
        id: "shrub",
        levels: 3, children: [5, 6], branchAngle: [46, 58], angleVariance: 18,
        lengthRatio: 0.6, trunkLength: 1.45, trunkRadius: 0.11, taper: 0.5, taperCurve: 0.7,
        rootFlare: 0.4, flareFraction: 0.25, radiusExponent: 2, minRadius: 0.02, minLength: 0.25,
        droop: 0.02, upPull: 0.45, gnarl: [0.05, 0.11, 0.14], radialSegments: 5,
        sectionLength: 0.55, childStart: 0.1, trunkClear: 0.12,
        leafCount: 190, leafSize: 0.95, leafAspect: 0.9,
        barkBase: 0x3a2c1d, barkTop: 0x5f4c33, leafInner: 0x22381a, leafOuter: 0x4a7326, leafTop: 0x7ba63a,
    },
];
