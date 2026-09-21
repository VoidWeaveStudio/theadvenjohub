// src/features/game/world/locations/showcase/rooms/garden/GardenAir.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { GardenLighting } from "./gardenShading";
import { bokehTexture, butterflyWingTexture, dragonflyWingTexture, petalTexture, shaftTexture } from "./gardenTextures";

const PETAL_COUNT = 900;
const MOTE_COUNT = 520;
const BUTTERFLY_COUNT = 22;
const DRAGONFLY_COUNT = 10;
const SHAFT_OPACITY = 0.16;

const petalVertex = /* glsl */`
    precision highp float;

    attribute vec4 aSeedA;
    attribute vec4 aSeedB;

    uniform float uTime;
    uniform vec2 uWindDir;
    uniform float uWindStrength;
    uniform float uTop;
    uniform vec3 uCamPos;

    varying vec2 vUv;
    varying float vShade;
    varying float vFade;

    mat3 axisRotation(vec3 axis, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        float t = 1.0 - c;
        return mat3(
            t * axis.x * axis.x + c, t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
            t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z - s * axis.x,
            t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c
        );
    }

    void main() {
        float phase = aSeedA.z;
        float size = aSeedA.w;
        float fall = aSeedB.z;
        float drift = aSeedB.w;

        float life = mod(uTime * fall + phase * 53.0, uTop);
        float y = uTop - life;

        vec2 sway = vec2(
            sin(uTime * 0.82 + phase * 6.2831),
            cos(uTime * 0.61 + phase * 4.13)
        ) * drift;

        vec2 wind = uWindDir * uWindStrength * life * 0.42;
        vec3 world = vec3(aSeedA.x + sway.x + wind.x, y, aSeedA.y + sway.y + wind.y);

        mat3 spin = axisRotation(normalize(vec3(0.42, 1.0, 0.18)), uTime * aSeedB.x + phase * 9.0)
                  * axisRotation(vec3(1.0, 0.0, 0.0), uTime * aSeedB.y + phase * 5.0);

        vec3 local = spin * vec3(position.xy * size, 0.0);
        vec3 finalPos = world + local;

        float distance = length(finalPos - uCamPos);
        vFade = smoothstep(0.6, 2.6, distance)
              * (1.0 - smoothstep(52.0, 78.0, distance))
              * smoothstep(0.0, 1.6, y);
        vShade = 0.72 + 0.34 * clamp(spin[1].y, 0.0, 1.0);
        vUv = uv;

        gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
    }
`;

const petalFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uMap;
    uniform vec3 uTint;

    varying vec2 vUv;
    varying float vShade;
    varying float vFade;

    void main() {
        vec4 texel = texture2D(uMap, vUv);
        float alpha = texel.a * vFade;
        if (alpha < 0.35) discard;

        vec3 color = texel.rgb * uTint * vShade;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const moteVertex = /* glsl */`
    precision highp float;

    attribute vec4 aSeed;

    uniform float uTime;
    uniform float uSize;
    uniform vec2 uWindDir;
    uniform float uWindStrength;

    varying float vAlpha;

    void main() {
        float phase = aSeed.z;
        float rise = aSeed.w;

        float life = mod(uTime * rise + phase * 31.0, 1.0);
        float y = mix(0.25, 7.5, life);

        vec2 sway = vec2(
            sin(uTime * 0.44 + phase * 6.2831) + sin(uTime * 1.21 + phase * 2.7) * 0.4,
            cos(uTime * 0.37 + phase * 5.13) + cos(uTime * 1.07 + phase * 3.4) * 0.4
        ) * 1.6;

        vec2 wind = uWindDir * uWindStrength * life * 6.0;
        vec3 world = vec3(aSeed.x + sway.x + wind.x, y, aSeed.y + sway.y + wind.y);

        vec4 viewPosition = viewMatrix * vec4(world, 1.0);
        float fade = smoothstep(0.0, 0.14, life) * (1.0 - smoothstep(0.78, 1.0, life));
        vAlpha = fade * (0.35 + 0.65 * fract(phase * 7.31));

        gl_PointSize = clamp(uSize * (260.0 / max(0.1, -viewPosition.z)), 1.0, 56.0);
        gl_Position = projectionMatrix * viewPosition;
    }
`;

const moteFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uMap;
    uniform vec3 uTint;

    varying float vAlpha;

    void main() {
        vec4 texel = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uTint * texel.rgb, texel.a * vAlpha);
        if (gl_FragColor.a < 0.01) discard;
    }
`;

interface Flyer {
    group: THREE.Group;
    wings: THREE.Object3D[];
    center: THREE.Vector3;
    radius: number;
    speed: number;
    phase: number;
    height: number;
    flap: number;
    bob: number;
}

export class GardenAir {
    private petals: THREE.Mesh[] = [];
    private motes: THREE.Points[] = [];
    private butterflies: Flyer[] = [];
    private dragonflies: Flyer[] = [];
    private shafts: THREE.Group[] = [];
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly lighting: GardenLighting,
        private readonly random: () => number,
        private readonly fieldRadius: number,
        private readonly particles: boolean
    ) { }

    public create() {
        if (this.particles) {
            this.buildPetals();
            this.buildMotes();
        }
        this.buildButterflies();
        this.buildDragonflies();
        if (this.particles) this.buildShafts();
    }

    private buildPetals() {
        for (const warm of [true, false]) {
            const count = warm ? Math.round(PETAL_COUNT * 0.62) : Math.round(PETAL_COUNT * 0.38);
            const quad = new THREE.PlaneGeometry(1, 1);
            const instanced = this.bin.geometry(new THREE.InstancedBufferGeometry());
            instanced.index = quad.index;
            instanced.attributes.position = quad.attributes.position;
            instanced.attributes.uv = quad.attributes.uv;
            quad.dispose();

            const seedA = new Float32Array(count * 4);
            const seedB = new Float32Array(count * 4);

            for (let i = 0; i < count; i++) {
                const angle = this.random() * Math.PI * 2;
                const distance = Math.sqrt(this.random()) * this.fieldRadius;
                seedA[i * 4] = Math.cos(angle) * distance;
                seedA[i * 4 + 1] = Math.sin(angle) * distance;
                seedA[i * 4 + 2] = this.random();
                seedA[i * 4 + 3] = warm ? 0.1 + this.random() * 0.12 : 0.07 + this.random() * 0.08;

                seedB[i * 4] = 0.7 + this.random() * 1.9;
                seedB[i * 4 + 1] = 0.5 + this.random() * 1.6;
                seedB[i * 4 + 2] = 0.45 + this.random() * 0.7;
                seedB[i * 4 + 3] = 0.5 + this.random() * 1.5;
            }

            instanced.setAttribute("aSeedA", new THREE.InstancedBufferAttribute(seedA, 4));
            instanced.setAttribute("aSeedB", new THREE.InstancedBufferAttribute(seedB, 4));
            instanced.instanceCount = count;

            const material = this.bin.material(new THREE.ShaderMaterial({
                uniforms: {
                    uMap: { value: petalTexture(this.bin, warm) },
                    uTime: this.lighting.uniforms.uTime,
                    uWindDir: this.lighting.uniforms.uWindDir,
                    uWindStrength: this.lighting.uniforms.uWindStrength,
                    uCamPos: this.lighting.uniforms.uCamPos,
                    uTop: { value: warm ? 15 : 19 },
                    uTint: { value: new THREE.Color(warm ? 0xfff0f6 : 0xfff6e4) },
                },
                vertexShader: petalVertex,
                fragmentShader: petalFragment,
                side: THREE.DoubleSide,
            }));

            const mesh = new THREE.Mesh(instanced, material);
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.renderOrder = 5;
            this.scene.add(mesh);
            this.petals.push(mesh);
        }
    }

    private buildMotes() {
        const map = bokehTexture(this.bin);

        for (const layer of [0, 1]) {
            const count = layer === 0 ? MOTE_COUNT : Math.round(MOTE_COUNT * 0.35);
            const seeds = new Float32Array(count * 4);

            for (let i = 0; i < count; i++) {
                const angle = this.random() * Math.PI * 2;
                const distance = Math.sqrt(this.random()) * this.fieldRadius * (layer === 0 ? 0.85 : 1);
                seeds[i * 4] = Math.cos(angle) * distance;
                seeds[i * 4 + 1] = Math.sin(angle) * distance;
                seeds[i * 4 + 2] = this.random();
                seeds[i * 4 + 3] = layer === 0 ? 0.022 + this.random() * 0.035 : 0.01 + this.random() * 0.016;
            }

            const geometry = this.bin.geometry(new THREE.BufferGeometry());
            geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
            geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));

            const material = this.bin.material(new THREE.ShaderMaterial({
                uniforms: {
                    uMap: { value: map },
                    uTime: this.lighting.uniforms.uTime,
                    uWindDir: this.lighting.uniforms.uWindDir,
                    uWindStrength: this.lighting.uniforms.uWindStrength,
                    uSize: { value: layer === 0 ? 0.11 : 0.3 },
                    uTint: { value: new THREE.Color(layer === 0 ? 0xfff4c8 : 0xffffff) },
                },
                vertexShader: moteVertex,
                fragmentShader: moteFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            }));

            const points = new THREE.Points(geometry, material);
            points.frustumCulled = false;
            points.renderOrder = 6;
            this.scene.add(points);
            this.motes.push(points);
        }
    }

    private buildFlyer(
        wingMap: THREE.Texture,
        bodyColor: number,
        wingSize: number,
        bodyLength: number,
        pairs: number
    ): { group: THREE.Group; wings: THREE.Object3D[] } {
        const group = new THREE.Group();
        const wings: THREE.Object3D[] = [];

        const wingMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            map: wingMap,
            transparent: true,
            alphaTest: 0.28,
            side: THREE.DoubleSide,
            roughness: 0.55,
            metalness: 0,
            emissive: 0xffffff,
            emissiveMap: wingMap,
            emissiveIntensity: 0.12,
        }));

        const bodyMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.5,
            metalness: 0.08,
        }));

        const body = new THREE.Mesh(this.bin.geometry(new THREE.CapsuleGeometry(bodyLength * 0.1, bodyLength, 4, 7)), bodyMaterial);
        body.rotation.x = Math.PI / 2;
        group.add(body);

        const wingGeometry = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        for (let pair = 0; pair < pairs; pair++) {
            const offset = pairs === 1 ? 0 : (pair - 0.5) * bodyLength * 0.5;
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                pivot.position.set(0, 0, offset);

                const wing = new THREE.Mesh(wingGeometry, wingMaterial);
                wing.scale.set(wingSize * side, wingSize * 0.62, 1);
                wing.position.set(side * wingSize * 0.48, 0, 0);
                wing.rotation.x = -Math.PI / 2;
                wing.castShadow = false;
                pivot.add(wing);

                group.add(pivot);
                wings.push(pivot);
            }
        }

        return { group, wings };
    }

    private buildButterflies() {
        const palettes: Array<[number, number, number]> = [
            [0xff9ecb, 0xfff1a8, 0x3a2430],
            [0x9fd8ff, 0xffffff, 0x28323f],
            [0xffd166, 0xff8f5a, 0x3a2e1c],
            [0xd7a8ff, 0xffe0f4, 0x322641],
        ];

        for (let i = 0; i < BUTTERFLY_COUNT; i++) {
            const palette = palettes[i % palettes.length];
            const map = butterflyWingTexture(this.bin, palette[0], palette[1]);
            const { group, wings } = this.buildFlyer(map, palette[2], 0.42, 0.22, 1);

            const angle = this.random() * Math.PI * 2;
            const distance = 6 + this.random() * (this.fieldRadius - 10);

            this.scene.add(group);
            this.butterflies.push({
                group,
                wings,
                center: new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance),
                radius: 1.6 + this.random() * 4.2,
                speed: 0.45 + this.random() * 0.8,
                phase: this.random() * 9,
                height: 0.9 + this.random() * 2.6,
                flap: 12 + this.random() * 8,
                bob: this.random() * 6,
            });
        }
    }

    private buildDragonflies() {
        const map = dragonflyWingTexture(this.bin);

        for (let i = 0; i < DRAGONFLY_COUNT; i++) {
            const { group, wings } = this.buildFlyer(map, i % 2 === 0 ? 0x4fd8c8 : 0x6fa8ff, 0.5, 0.42, 2);

            const angle = this.random() * Math.PI * 2;
            const distance = 4 + this.random() * 12;

            this.scene.add(group);
            this.dragonflies.push({
                group,
                wings,
                center: new THREE.Vector3(4 + Math.cos(angle) * distance, 0, 20 + Math.sin(angle) * distance),
                radius: 2.4 + this.random() * 5.5,
                speed: 0.8 + this.random() * 1.1,
                phase: this.random() * 9,
                height: 0.55 + this.random() * 1.1,
                flap: 26 + this.random() * 14,
                bob: this.random() * 6,
            });
        }
    }

    private buildShafts() {
        const map = shaftTexture(this.bin);

        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            opacity: SHAFT_OPACITY,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
            fog: false,
        }));

        const spots: Array<[number, number, number]> = [
            [-20, -10, 1],
            [-32, 12, 0.9],
            [18, -26, 1.1],
            [26, 8, 0.85],
            [-4, 26, 1.15],
            [0, -34, 0.95],
            [34, -6, 0.8],
        ];

        for (const [x, z, scale] of spots) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = this.random() * Math.PI;

            for (let i = 0; i < 2; i++) {
                const blade = new THREE.Mesh(
                    this.bin.geometry(new THREE.PlaneGeometry(5 * scale, 13 * scale)),
                    material
                );
                blade.position.y = 8.5 * scale;
                blade.rotation.y = i * Math.PI / 2;
                blade.rotation.z = 0.34;
                blade.renderOrder = 7;
                group.add(blade);
            }

            this.scene.add(group);
            this.shafts.push(group);
        }
    }

    private updateFlyers(list: Flyer[], darting: boolean) {
        for (const flyer of list) {
            const t = this.elapsed * flyer.speed + flyer.phase;
            const dart = darting ? Math.sin(t * 2.7) * 0.5 + 0.5 : 1;

            const x = flyer.center.x + Math.cos(t) * flyer.radius * (darting ? 0.6 + dart * 0.8 : 1);
            const z = flyer.center.z + Math.sin(t * 1.27) * flyer.radius;
            const y = flyer.height + Math.sin(t * 2.1 + flyer.bob) * (darting ? 0.22 : 0.5);

            const previousX = flyer.group.position.x;
            const previousZ = flyer.group.position.z;
            flyer.group.position.set(x, y, z);

            const dx = x - previousX;
            const dz = z - previousZ;
            if (dx * dx + dz * dz > 1e-6) flyer.group.rotation.y = Math.atan2(dx, dz);
            flyer.group.rotation.z = Math.sin(t * 1.6) * 0.22;

            for (let i = 0; i < flyer.wings.length; i++) {
                const side = i % 2 === 0 ? 1 : -1;
                const lag = Math.floor(i / 2) * 0.6;
                const swing = Math.sin(this.elapsed * flyer.flap + flyer.phase + lag);
                flyer.wings[i].rotation.z = side * (0.35 + swing * 0.75);
            }
        }
    }

    public update(delta: number) {
        this.elapsed += delta;

        this.updateFlyers(this.butterflies, false);
        this.updateFlyers(this.dragonflies, true);

        for (const group of this.shafts) {
            const material = (group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
            material.opacity = SHAFT_OPACITY + Math.sin(this.elapsed * 0.4) * 0.05;
            group.rotation.y += delta * 0.012;
        }
    }

    public objects(): THREE.Object3D[] {
        return [...this.petals, ...this.motes, ...this.shafts];
    }

    public dispose() {
        for (const mesh of this.petals) this.scene.remove(mesh);
        for (const points of this.motes) this.scene.remove(points);
        for (const flyer of this.butterflies) this.scene.remove(flyer.group);
        for (const flyer of this.dragonflies) this.scene.remove(flyer.group);
        for (const group of this.shafts) this.scene.remove(group);

        this.petals = [];
        this.motes = [];
        this.butterflies = [];
        this.dragonflies = [];
        this.shafts = [];
    }
}
