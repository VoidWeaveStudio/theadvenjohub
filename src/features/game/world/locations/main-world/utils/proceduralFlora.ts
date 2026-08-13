// src/features/game/world/locations/main-world/utils/proceduralFlora.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom, valueNoise3 } from "./worldNoise";

function paint(geometry: THREE.BufferGeometry, base: THREE.Color, tip: THREE.Color, spanY: number, offsetY: number) {
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp((position.getY(i) - offsetY) / spanY, 0, 1);
        color.copy(base).lerp(tip, t);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const flattened = parts.map((part) => (part.getIndex() ? part.toNonIndexed() : part));
    parts.forEach((part, index) => {
        if (flattened[index] !== part) part.dispose();
    });

    for (const part of flattened) {
        part.deleteAttribute("normal");
        part.deleteAttribute("uv");
        part.deleteAttribute("uv1");
    }

    const merged = mergeGeometries(flattened, false);
    flattened.forEach((part) => part.dispose());

    if (!merged) throw new Error("flora merge failed");
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
}

interface TreeProfile {
    conifer: boolean;
    trunkHeight: number;
    trunkRadius: number;
    trunkTaper: number;
    trunkFlare: number;
    trunkLean: number;
    trunkSides: number;
    limbCount: number;
    limbStart: number;
    limbLength: number;
    limbRise: number;
    crownRadius: number;
    crownSquash: number;
    fillClusters: number;
    whorlCount: number;
    whorlSpread: number;
    barkBase: number;
    barkTop: number;
    leafBase: number;
    leafTip: number;
}

const TREE_PROFILES: TreeProfile[] = [
    {
        conifer: false,
        trunkHeight: 7.4, trunkRadius: 0.36, trunkTaper: 0.34, trunkFlare: 1.5, trunkLean: 0.5, trunkSides: 8,
        limbCount: 6, limbStart: 0.52, limbLength: 2.9, limbRise: 1.5,
        crownRadius: 1.55, crownSquash: 0.72, fillClusters: 3,
        whorlCount: 0, whorlSpread: 0,
        barkBase: 0x2f2318, barkTop: 0x6a5641, leafBase: 0x1b3316, leafTip: 0x54803a,
    },
    {
        conifer: false,
        trunkHeight: 9.2, trunkRadius: 0.28, trunkTaper: 0.28, trunkFlare: 1.1, trunkLean: 1.15, trunkSides: 7,
        limbCount: 5, limbStart: 0.6, limbLength: 2.3, limbRise: 2.1,
        crownRadius: 1.25, crownSquash: 0.86, fillClusters: 2,
        whorlCount: 0, whorlSpread: 0,
        barkBase: 0x4a4438, barkTop: 0x9d9585, leafBase: 0x24401c, leafTip: 0x6f9445,
    },
    {
        conifer: true,
        trunkHeight: 11.5, trunkRadius: 0.31, trunkTaper: 0.16, trunkFlare: 1.3, trunkLean: 0.28, trunkSides: 7,
        limbCount: 0, limbStart: 0, limbLength: 0, limbRise: 0,
        crownRadius: 0, crownSquash: 0, fillClusters: 0,
        whorlCount: 8, whorlSpread: 2.65,
        barkBase: 0x2a2018, barkTop: 0x5b4634, leafBase: 0x102718, leafTip: 0x33562c,
    },
    {
        conifer: true,
        trunkHeight: 8.6, trunkRadius: 0.26, trunkTaper: 0.18, trunkFlare: 1.15, trunkLean: 0.45, trunkSides: 6,
        limbCount: 0, limbStart: 0, limbLength: 0, limbRise: 0,
        crownRadius: 0, crownSquash: 0, fillClusters: 0,
        whorlCount: 6, whorlSpread: 2.1,
        barkBase: 0x33261a, barkTop: 0x6d5738, leafBase: 0x16301b, leafTip: 0x3f6431,
    },
];

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _control = new THREE.Vector3();
const _point = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _binormal = new THREE.Vector3();

function bezierAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    const inv = 1 - t;
    return out
        .set(0, 0, 0)
        .addScaledVector(_from, inv * inv)
        .addScaledVector(_control, 2 * inv * t)
        .addScaledVector(_to, t * t);
}

function buildLimb(
    from: THREE.Vector3,
    to: THREE.Vector3,
    bendX: number,
    bendY: number,
    bendZ: number,
    startRadius: number,
    endRadius: number,
    flare: number,
    sides: number,
    segments: number,
    seed: number
): THREE.BufferGeometry {
    _from.copy(from);
    _to.copy(to);
    _control.addVectors(from, to).multiplyScalar(0.5).add(new THREE.Vector3(bendX, bendY, bendZ));

    const positions: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        bezierAt(t, _point);
        bezierAt(Math.min(1, t + 0.02), _ahead);

        _tangent.subVectors(_ahead, _point);
        if (_tangent.lengthSq() < 1e-8) _tangent.set(0, 1, 0);
        _tangent.normalize();

        _normal.set(0, 1, 0);
        if (Math.abs(_tangent.y) > 0.94) _normal.set(1, 0, 0);
        _binormal.crossVectors(_tangent, _normal).normalize();
        _normal.crossVectors(_binormal, _tangent).normalize();

        const taper = startRadius + (endRadius - startRadius) * t;
        const rooted = taper * (1 + flare * Math.pow(1 - t, 5));

        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const bark = 1 + (valueNoise3(cos * 2.4, t * 6.5, sin * 2.4, seed) - 0.5) * 0.42;
            const radius = rooted * bark;

            positions.push(
                _point.x + (_normal.x * cos + _binormal.x * sin) * radius,
                _point.y + (_normal.y * cos + _binormal.y * sin) * radius,
                _point.z + (_normal.z * cos + _binormal.z * sin) * radius
            );
        }
    }

    for (let s = 0; s < segments; s++) {
        for (let i = 0; i < sides; i++) {
            const a = s * sides + i;
            const b = s * sides + ((i + 1) % sides);
            const c = a + sides;
            const d = b + sides;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
}

function buildFoliage(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    squash: number,
    seed: number
): THREE.BufferGeometry {
    const geometry = new THREE.IcosahedronGeometry(radius, 0);
    const position = geometry.getAttribute("position");
    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        const ragged = valueNoise3(
            vertex.x * 1.7 + 13,
            vertex.y * 1.7 + 13,
            vertex.z * 1.7 + 13,
            seed
        ) - 0.5;

        const stretch = 1 + ragged * 0.82;
        position.setXYZ(i, vertex.x * stretch, vertex.y * stretch * squash, vertex.z * stretch);
    }

    position.needsUpdate = true;
    geometry.translate(centerX, centerY, centerZ);
    return geometry;
}

function buildWhorl(y: number, radius: number, droop: number, rise: number, sides: number, seed: number): THREE.BufferGeometry {
    const positions: number[] = [0, y + rise, 0];
    const indices: number[] = [];

    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const ragged = 0.68 + valueNoise3(cos * 3.1, y * 0.7, sin * 3.1, seed) * 0.62;

        positions.push(cos * radius * ragged, y - droop * ragged, sin * radius * ragged);
    }

    for (let i = 0; i < sides; i++) {
        indices.push(0, 1 + i, 1 + ((i + 1) % sides));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
}

export function createTreeGeometry(variant: number): THREE.BufferGeometry {
    const profile = TREE_PROFILES[variant % TREE_PROFILES.length];
    const seed = 9001 + variant * 733;
    const random = createRandom(seed);

    const parts: THREE.BufferGeometry[] = [];
    const barkBase = new THREE.Color(profile.barkBase);
    const barkTop = new THREE.Color(profile.barkTop);
    const leafBase = new THREE.Color(profile.leafBase);
    const leafTip = new THREE.Color(profile.leafTip);

    const height = profile.trunkHeight;
    const leanAngle = random() * Math.PI * 2;
    const leanX = Math.cos(leanAngle) * profile.trunkLean;
    const leanZ = Math.sin(leanAngle) * profile.trunkLean;

    const trunk = buildLimb(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(leanX, height, leanZ),
        leanX * 0.35 - 0.18,
        0,
        leanZ * 0.35 + 0.14,
        profile.trunkRadius,
        profile.trunkRadius * profile.trunkTaper,
        profile.trunkFlare,
        profile.trunkSides,
        7,
        seed
    );
    parts.push(paint(trunk, barkBase, barkTop, height * 0.8, 0));

    if (profile.conifer) {
        for (let i = 0; i < profile.whorlCount; i++) {
            const t = i / (profile.whorlCount - 1);
            const y = height * (0.24 + t * 0.72);
            const taper = Math.pow(1 - t, 1.35);
            const radius = 0.45 + profile.whorlSpread * taper;

            parts.push(paint(
                buildWhorl(y, radius, 0.55 + taper * 0.7, 0.75 + taper * 0.5, 9, seed + i * 57),
                leafBase,
                leafTip,
                radius * 1.4,
                y - radius
            ));
        }

        parts.push(paint(
            buildFoliage(leanX * 0.9, height * 1.02, leanZ * 0.9, 0.72, 1.5, seed + 991),
            leafBase,
            leafTip,
            1.6,
            height * 0.94
        ));

        return combine(parts);
    }

    const crownCenterY = height * 0.94;

    for (let i = 0; i < profile.limbCount; i++) {
        const angle = (i / profile.limbCount) * Math.PI * 2 + random() * 0.7;
        const startT = profile.limbStart + random() * 0.3;
        const startY = height * startT;
        const startX = leanX * startT;
        const startZ = leanZ * startT;

        const reach = profile.limbLength * (0.65 + random() * 0.6);
        const rise = profile.limbRise * (0.6 + random() * 0.7);
        const endX = startX + Math.cos(angle) * reach;
        const endZ = startZ + Math.sin(angle) * reach;
        const endY = startY + rise;

        const limb = buildLimb(
            new THREE.Vector3(startX, startY, startZ),
            new THREE.Vector3(endX, endY, endZ),
            Math.cos(angle) * reach * 0.15,
            -rise * 0.42,
            Math.sin(angle) * reach * 0.15,
            profile.trunkRadius * 0.42,
            profile.trunkRadius * 0.13,
            0,
            5,
            3,
            seed + i * 131
        );
        parts.push(paint(limb, barkBase, barkTop, height * 0.8, 0));

        const clusterRadius = profile.crownRadius * (0.7 + random() * 0.6);
        parts.push(paint(
            buildFoliage(
                endX + (random() - 0.5) * 0.5,
                endY + clusterRadius * 0.35,
                endZ + (random() - 0.5) * 0.5,
                clusterRadius,
                profile.crownSquash,
                seed + i * 271
            ),
            leafBase,
            leafTip,
            clusterRadius * 2.1,
            endY - clusterRadius
        ));
    }

    for (let i = 0; i < profile.fillClusters; i++) {
        const angle = random() * Math.PI * 2;
        const spread = profile.crownRadius * (0.3 + random() * 0.7);
        const clusterRadius = profile.crownRadius * (0.6 + random() * 0.45);
        const y = crownCenterY + (random() - 0.3) * profile.crownRadius;

        parts.push(paint(
            buildFoliage(
                leanX + Math.cos(angle) * spread,
                y,
                leanZ + Math.sin(angle) * spread,
                clusterRadius,
                profile.crownSquash,
                seed + 613 + i * 89
            ),
            leafBase,
            leafTip,
            clusterRadius * 2.1,
            y - clusterRadius
        ));
    }

    return combine(parts);
}

interface RockShape {
    lumpScale: number;
    lumpAmount: number;
    detailScale: number;
    detailAmount: number;
    squash: number;
    stretch: number;
    bury: number;
}

const ROCK_SHAPES: RockShape[] = [
    { lumpScale: 1.5, lumpAmount: 0.34, detailScale: 4.1, detailAmount: 0.11, squash: 0.74, stretch: 1.0, bury: 0.22 },
    { lumpScale: 1.1, lumpAmount: 0.28, detailScale: 5.6, detailAmount: 0.08, squash: 0.44, stretch: 1.25, bury: 0.3 },
    { lumpScale: 2.2, lumpAmount: 0.4, detailScale: 3.4, detailAmount: 0.14, squash: 0.92, stretch: 0.86, bury: 0.16 },
    { lumpScale: 1.7, lumpAmount: 0.24, detailScale: 6.8, detailAmount: 0.06, squash: 0.6, stretch: 1.05, bury: 0.26 },
];

export function createRockGeometry(variant: number): THREE.BufferGeometry {
    const shape = ROCK_SHAPES[variant % ROCK_SHAPES.length];
    const seed = 4400 + variant * 977;
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const position = geometry.getAttribute("position");

    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).normalize();

        const lump = valueNoise3(
            vertex.x * shape.lumpScale + 8,
            vertex.y * shape.lumpScale + 8,
            vertex.z * shape.lumpScale + 8,
            seed
        ) - 0.5;

        const detail = valueNoise3(
            vertex.x * shape.detailScale + 40,
            vertex.y * shape.detailScale + 40,
            vertex.z * shape.detailScale + 40,
            seed + 313
        ) - 0.5;

        const radius = 1 + lump * shape.lumpAmount * 2 + detail * shape.detailAmount * 2;

        let x = vertex.x * radius * shape.stretch;
        let y = vertex.y * radius * shape.squash;
        let z = vertex.z * radius;

        const floor = -0.5 + shape.bury;
        if (y < floor) y = floor + (y - floor) * 0.18;

        position.setXYZ(i, x, y, z);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.translate(0, 0.5 * shape.squash - shape.bury * 0.5, 0);

    return combine([paint(geometry, new THREE.Color(0x3b3833), new THREE.Color(0x8a8478), 1.4, -0.2)]);
}

export function createGrassBladeGeometry(): THREE.BufferGeometry {
    const height = 0.62;
    const halfWidth = 0.055;

    const positions = new Float32Array([
        -halfWidth, 0, 0,
        halfWidth, 0, 0,
        -halfWidth * 0.6, height * 0.55, 0.04,

        halfWidth, 0, 0,
        halfWidth * 0.6, height * 0.55, 0.04,
        -halfWidth * 0.6, height * 0.55, 0.04,

        -halfWidth * 0.6, height * 0.55, 0.04,
        halfWidth * 0.6, height * 0.55, 0.04,
        0, height, 0.11,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}
