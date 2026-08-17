// src/features/game/entities/PointsDragon.ts
import * as THREE from "three";

export interface PointsDragonOptions {
    segments?: number;
    bodyRadius?: number;
    segmentSpacing?: number;
    density?: number;
}

const VERTEX_SHADER = /* glsl */ `
    uniform sampler2D uSpine;
    uniform float uSegments;
    uniform float uTime;
    uniform float uPixelRatio;

    attribute float aSegment;
    attribute vec3 aLocal;
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aSeed;
    attribute float aTrail;
    attribute float aFlow;

    varying vec3 vColor;
    varying float vAlpha;

    vec3 applyQuat(vec4 q, vec3 v) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }

    void main() {
        float u = (aSegment + 0.5) / uSegments;

        vec3 spinePos = texture2D(uSpine, vec2(u, 0.25)).xyz;
        vec4 spineQuat = texture2D(uSpine, vec2(u, 0.75));

        float wobble = 1.0 + 0.05 * sin(uTime * 2.2 + aSegment * 0.4 + aSeed * 6.283) * aFlow;
        vec3 local = aLocal * wobble;

        float drift = aTrail * (6.0 + 26.0 * aSeed);
        local.z += drift;
        local.x += sin(uTime * 1.4 + aSeed * 20.0) * drift * 0.28;
        local.y += cos(uTime * 1.1 + aSeed * 17.0) * drift * 0.22;

        vec3 worldPos = spinePos + applyQuat(spineQuat, local);

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aSize * uPixelRatio * (620.0 / max(1.0, -mvPosition.z));

        float flicker = 0.72 + 0.28 * sin(uTime * 2.6 + aSeed * 12.566);
        vColor = aColor;
        vAlpha = flicker * (1.0 - aTrail * 0.75);
    }
`;

const FRAGMENT_SHADER = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        float falloff = smoothstep(0.5, 0.0, d);
        float core = pow(falloff, 3.0);

        gl_FragColor = vec4(vColor * (0.55 + core * 1.4), falloff * vAlpha);
    }
`;

interface PointInput {
    segment: number;
    local: THREE.Vector3;
    size: number;
    color: THREE.Color;
    seed?: number;
    trail?: number;
    flow?: number;
}

export class PointsDragon {
    public readonly object: THREE.Points;
    public readonly segments: number;
    public readonly segmentSpacing: number;

    private readonly spineTexture: THREE.DataTexture;
    private readonly spineData: Float32Array;
    private readonly material: THREE.ShaderMaterial;
    private readonly geometry: THREE.BufferGeometry;

    private readonly scale: number;

    constructor(options: PointsDragonOptions = {}) {
        this.segments = options.segments ?? 96;
        this.segmentSpacing = options.segmentSpacing ?? 1.8;
        this.scale = options.bodyRadius ?? 3.6;

        this.spineData = new Float32Array(this.segments * 2 * 4);
        for (let i = 0; i < this.segments; i++) {
            this.spineData[(this.segments + i) * 4 + 3] = 1;
        }

        this.spineTexture = new THREE.DataTexture(
            this.spineData,
            this.segments,
            2,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.spineTexture.minFilter = THREE.NearestFilter;
        this.spineTexture.magFilter = THREE.NearestFilter;
        this.spineTexture.needsUpdate = true;

        this.geometry = this.buildGeometry(options.density ?? 46);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uSpine: { value: this.spineTexture },
                uSegments: { value: this.segments },
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio) },
            },
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
        });

        this.object = new THREE.Points(this.geometry, this.material);
        this.object.frustumCulled = false;
        this.object.renderOrder = 6;
    }

    private profileAt(t: number): number {
        const stops: [number, number][] = [
            [0.0, 0.0],
            [0.03, 0.0],
            [0.06, 0.46],
            [0.16, 0.92],
            [0.3, 1.22],
            [0.45, 1.1],
            [0.62, 0.86],
            [0.78, 0.6],
            [0.9, 0.36],
            [1.0, 0.07],
        ];

        for (let i = 1; i < stops.length; i++) {
            if (t > stops[i][0]) continue;
            const [prevT, prevV] = stops[i - 1];
            const [nextT, nextV] = stops[i];
            const blend = (t - prevT) / Math.max(1e-5, nextT - prevT);
            return prevV + (nextV - prevV) * blend;
        }

        return stops[stops.length - 1][1];
    }

    private buildGeometry(density: number): THREE.BufferGeometry {
        const points: PointInput[] = [];
        const s = this.scale;

        const gold = new THREE.Color("#FFD98A");
        const amber = new THREE.Color("#FF9A3C");
        const crimson = new THREE.Color("#FF3B30");
        const ember = new THREE.Color("#B21E2F");
        const jade = new THREE.Color("#5FE3C0");
        const ice = new THREE.Color("#DCF6FF");
        const scratch = new THREE.Color();

        const bodyTone = (t: number) => {
            if (t < 0.12) return scratch.copy(gold).lerp(amber, t / 0.12);
            if (t < 0.4) return scratch.copy(amber).lerp(crimson, (t - 0.12) / 0.28);
            return scratch.copy(crimson).lerp(ember, (t - 0.4) / 0.6);
        };

        for (let seg = 0; seg < this.segments; seg++) {
            const t = seg / (this.segments - 1);
            const profile = this.profileAt(t);
            if (profile < 0.05) continue;

            const rx = s * profile * 1.12;
            const ry = s * profile * 0.82;

            const count = Math.max(10, Math.round(density * profile));
            const tone = bodyTone(t).clone();

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const shell = 0.62 + 0.38 * Math.sqrt(Math.random());

                points.push({
                    segment: seg,
                    local: new THREE.Vector3(
                        Math.cos(angle) * rx * shell,
                        Math.sin(angle) * ry * shell,
                        (Math.random() - 0.5) * this.segmentSpacing
                    ),
                    size: 1.05 + Math.random() * 0.85,
                    color: tone,
                    flow: 1,
                });
            }

            if (seg > 3 && t < 0.94) {
                const crestPhase = 1 - Math.abs(((seg * 0.5) % 2) - 1);
                const crestHeight = ry * (0.55 + crestPhase * 1.1);
                const crestPoints = 4 + Math.round(crestPhase * 5);

                for (let i = 0; i < crestPoints; i++) {
                    const up = (i / crestPoints) * crestHeight;
                    points.push({
                        segment: seg,
                        local: new THREE.Vector3(
                            (Math.random() - 0.5) * s * 0.18,
                            ry * 0.75 + up,
                            (Math.random() - 0.5) * this.segmentSpacing * 0.8
                        ),
                        size: 0.9 + Math.random() * 0.7,
                        color: jade,
                        flow: 1,
                    });
                }
            }

            if (seg % 3 === 0 && t > 0.08 && t < 0.85) {
                for (const side of [-1, 1]) {
                    for (let i = 0; i < 3; i++) {
                        points.push({
                            segment: seg,
                            local: new THREE.Vector3(
                                side * rx * (1.05 + Math.random() * 0.5),
                                -ry * (0.2 + Math.random() * 0.5),
                                (Math.random() - 0.5) * this.segmentSpacing
                            ),
                            size: 0.85 + Math.random() * 0.6,
                            color: jade,
                            flow: 1,
                        });
                    }
                }
            }
        }

        this.buildHead(points, s, { gold, ice, jade, amber });
        this.buildLimbs(points, s, { crimson, jade });
        this.buildTailFin(points, s, jade, ember);
        this.buildTrail(points, s, crimson, jade);

        return this.toGeometry(points);
    }

    private buildHead(
        points: PointInput[],
        s: number,
        colors: { gold: THREE.Color; ice: THREE.Color; jade: THREE.Color; amber: THREE.Color }
    ) {
        const h = s * 1.05;
        const add = (segment: number, x: number, y: number, z: number, size: number, color: THREE.Color, flow = 0) => {
            points.push({ segment, local: new THREE.Vector3(x * h, y * h, z * h), size, color, flow });
        };

        for (let i = 0; i < 900; i++) {
            const angle = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const shell = 0.7 + 0.3 * Math.sqrt(Math.random());

            add(
                0,
                Math.sin(phi) * Math.cos(angle) * 1.0 * shell,
                Math.sin(phi) * Math.sin(angle) * 0.85 * shell + 0.12,
                Math.cos(phi) * 1.25 * shell - 0.35,
                1.15 + Math.random() * 0.9,
                colors.gold
            );
        }

        for (let i = 0; i < 620; i++) {
            const t = Math.random();
            const taper = 0.72 - t * 0.32;
            const angle = Math.random() * Math.PI * 2;
            const shell = 0.6 + 0.4 * Math.sqrt(Math.random());

            add(
                0,
                Math.cos(angle) * taper * shell,
                Math.sin(angle) * taper * 0.72 * shell - 0.08 - t * 0.12,
                -1.5 - t * 1.9,
                1.05 + Math.random() * 0.8,
                colors.gold
            );
        }

        for (let i = 0; i < 260; i++) {
            const t = Math.random();
            add(
                0,
                (Math.random() - 0.5) * 1.05 * (0.75 - t * 0.3),
                -0.55 - t * 0.18 + (Math.random() - 0.5) * 0.16,
                -1.6 - t * 1.6,
                1.0 + Math.random() * 0.7,
                colors.amber
            );
        }

        for (const side of [-1, 1]) {
            for (let i = 0; i < 110; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 0.26 * Math.sqrt(Math.random());
                add(
                    0,
                    side * 0.62 + Math.cos(angle) * r,
                    0.42 + Math.sin(angle) * r * 0.8,
                    -1.45,
                    1.5 + Math.random() * 1.2,
                    colors.ice
                );
            }

            for (let i = 0; i < 130; i++) {
                const t = i / 130;
                const bend = Math.sin(t * Math.PI * 0.8);
                add(
                    0,
                    side * (0.45 + t * 0.55),
                    0.72 + t * 1.5 - bend * 0.25,
                    0.1 + t * 1.5,
                    1.0 + Math.random() * 0.8,
                    colors.gold
                );
            }

            for (let i = 0; i < 160; i++) {
                const t = i / 160;
                add(
                    0,
                    side * (0.5 + t * 0.9 + Math.sin(t * 9) * 0.22),
                    -0.2 + Math.sin(t * 6.5) * 0.55 - t * 0.25,
                    -3.1 - t * 3.4,
                    0.85 + Math.random() * 0.7,
                    colors.jade,
                    1
                );
            }

            for (let i = 0; i < 70; i++) {
                const t = i / 70;
                add(
                    0,
                    side * (0.35 + t * 0.5),
                    0.55 + t * 0.9,
                    -0.9 + t * 0.4,
                    0.85 + Math.random() * 0.6,
                    colors.jade,
                    1
                );
            }
        }

        for (let i = 0; i < 90; i++) {
            const t = Math.random();
            add(
                0,
                (Math.random() - 0.5) * 0.9 * (0.7 - t * 0.3),
                -0.36 + (Math.random() - 0.5) * 0.1,
                -1.8 - t * 1.5,
                0.75 + Math.random() * 0.5,
                colors.ice
            );
        }
    }

    private buildLimbs(points: PointInput[], s: number, colors: { crimson: THREE.Color; jade: THREE.Color }) {
        const legSegments = [
            Math.round(this.segments * 0.2),
            Math.round(this.segments * 0.34),
            Math.round(this.segments * 0.6),
            Math.round(this.segments * 0.74),
        ];

        for (const segment of legSegments) {
            for (const side of [-1, 1]) {
                const joints = [
                    new THREE.Vector3(side * s * 0.9, -s * 0.45, 0),
                    new THREE.Vector3(side * s * 1.7, -s * 1.5, s * 0.5),
                    new THREE.Vector3(side * s * 1.45, -s * 2.6, -s * 0.3),
                ];

                for (let leg = 0; leg < joints.length - 1; leg++) {
                    const from = joints[leg];
                    const to = joints[leg + 1];
                    const thickness = s * (0.42 - leg * 0.14);

                    for (let i = 0; i < 130; i++) {
                        const t = Math.random();
                        const angle = Math.random() * Math.PI * 2;
                        const r = thickness * Math.sqrt(Math.random());

                        points.push({
                            segment,
                            local: new THREE.Vector3(
                                from.x + (to.x - from.x) * t + Math.cos(angle) * r,
                                from.y + (to.y - from.y) * t + Math.sin(angle) * r * 0.8,
                                from.z + (to.z - from.z) * t + Math.cos(angle) * r * 0.6
                            ),
                            size: 0.95 + Math.random() * 0.7,
                            color: colors.crimson,
                            flow: 1,
                        });
                    }
                }

                const paw = joints[joints.length - 1];
                for (let claw = 0; claw < 3; claw++) {
                    const spread = (claw - 1) * 0.5;
                    for (let i = 0; i < 40; i++) {
                        const t = i / 40;
                        points.push({
                            segment,
                            local: new THREE.Vector3(
                                paw.x + spread * s * 0.35,
                                paw.y - t * s * 0.7,
                                paw.z - t * s * 0.9
                            ),
                            size: 0.8 + Math.random() * 0.6,
                            color: colors.jade,
                            flow: 1,
                        });
                    }
                }
            }
        }
    }

    private buildTailFin(points: PointInput[], s: number, jade: THREE.Color, ember: THREE.Color) {
        const start = this.segments - 14;

        for (let seg = start; seg < this.segments; seg++) {
            const t = (seg - start) / 14;
            const spread = s * (0.4 + t * 2.6);

            for (let i = 0; i < 90; i++) {
                const along = Math.random();
                const flare = Math.sin(along * Math.PI) * spread;

                points.push({
                    segment: seg,
                    local: new THREE.Vector3(
                        (Math.random() - 0.5) * s * 0.3,
                        (Math.random() - 0.5) * flare * 2,
                        (Math.random() - 0.5) * this.segmentSpacing
                    ),
                    size: 0.85 + Math.random() * 0.7,
                    color: Math.random() > 0.45 ? jade : ember,
                    flow: 1,
                });
            }
        }
    }

    private buildTrail(points: PointInput[], s: number, crimson: THREE.Color, jade: THREE.Color) {
        for (let i = 0; i < 2200; i++) {
            const segment = this.segments - 1 - Math.floor(Math.random() * 6);
            const angle = Math.random() * Math.PI * 2;
            const r = s * 0.5 * Math.sqrt(Math.random());

            points.push({
                segment,
                local: new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0),
                size: 0.7 + Math.random() * 1.4,
                color: Math.random() > 0.6 ? jade : crimson,
                trail: Math.random(),
                flow: 0,
            });
        }
    }

    private toGeometry(points: PointInput[]): THREE.BufferGeometry {
        const count = points.length;
        const positions = new Float32Array(count * 3);
        const locals = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const segments = new Float32Array(count);
        const sizes = new Float32Array(count);
        const seeds = new Float32Array(count);
        const trails = new Float32Array(count);
        const flows = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const point = points[i];

            locals[i * 3] = point.local.x;
            locals[i * 3 + 1] = point.local.y;
            locals[i * 3 + 2] = point.local.z;

            colors[i * 3] = point.color.r;
            colors[i * 3 + 1] = point.color.g;
            colors[i * 3 + 2] = point.color.b;

            segments[i] = Math.max(0, Math.min(this.segments - 1, point.segment));
            sizes[i] = point.size;
            seeds[i] = point.seed ?? Math.random();
            trails[i] = point.trail ?? 0;
            flows[i] = point.flow ?? 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aLocal", new THREE.BufferAttribute(locals, 3));
        geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("aSegment", new THREE.BufferAttribute(segments, 1));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        geometry.setAttribute("aTrail", new THREE.BufferAttribute(trails, 1));
        geometry.setAttribute("aFlow", new THREE.BufferAttribute(flows, 1));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

        return geometry;
    }

    setSegmentTransform(index: number, position: THREE.Vector3, quaternion: THREE.Quaternion) {
        const posOffset = index * 4;
        this.spineData[posOffset] = position.x;
        this.spineData[posOffset + 1] = position.y;
        this.spineData[posOffset + 2] = position.z;
        this.spineData[posOffset + 3] = 1;

        const quatOffset = (this.segments + index) * 4;
        this.spineData[quatOffset] = quaternion.x;
        this.spineData[quatOffset + 1] = quaternion.y;
        this.spineData[quatOffset + 2] = quaternion.z;
        this.spineData[quatOffset + 3] = quaternion.w;
    }

    commitSpine(elapsed: number) {
        this.spineTexture.needsUpdate = true;
        this.material.uniforms.uTime.value = elapsed;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.spineTexture.dispose();
        this.object.parent?.remove(this.object);
    }
}
