// src/features/game/world/locations/showcase/rooms/church/ChurchAtmosphere.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { dustTexture, flameTexture, haloTexture, smokeTexture } from "./churchTextures";

const SMOKE_POOL = 30;

export interface BeamAnchor {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
    radius: number;
}

interface Puff {
    life: number;
    duration: number;
    size: number;
    drift: THREE.Vector3;
    position: THREE.Vector3;
    spin: number;
    active: boolean;
}

const flameVertex = /* glsl */`
    precision highp float;

    attribute vec3 aOffset;
    attribute vec4 aSeed;

    uniform float uTime;
    uniform float uWidth;
    uniform float uHeight;
    uniform float uRise;

    varying vec2 vUv;
    varying float vHeat;

    void main() {
        float phase = aSeed.x * 6.2831;
        float size = aSeed.y;
        float speed = aSeed.z;
        float sway = aSeed.w;

        float beat = sin(uTime * speed + phase) * 0.5 + sin(uTime * speed * 2.7 + phase * 1.7) * 0.28;
        float stretch = 1.0 + beat * 0.22;
        float lean = sin(uTime * speed * 0.7 + phase) * sway;

        vec3 center = aOffset;
        vec3 viewDir = normalize(cameraPosition - center);
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 right = normalize(cross(up, viewDir));

        float halfW = uWidth * size * (1.0 - beat * 0.12);
        float halfH = uHeight * size * stretch;

        vec3 local = right * (position.x * halfW + lean * (position.y + 0.5) * 0.4)
                   + up * ((position.y + 0.5) * halfH + uRise);

        vHeat = 0.72 + beat * 0.3;
        vUv = uv;

        gl_Position = projectionMatrix * viewMatrix * vec4(center + local, 1.0);
    }
`;

const flameFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uMap;
    uniform vec3 uTint;

    varying vec2 vUv;
    varying float vHeat;

    void main() {
        vec4 texel = texture2D(uMap, vUv);
        float alpha = texel.a * vHeat;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(texel.rgb * uTint * vHeat, alpha);
    }
`;

const moteVertex = /* glsl */`
    precision highp float;

    attribute vec4 aSeed;
    attribute vec3 aAnchor;

    uniform float uTime;
    uniform float uSize;
    uniform float uSpan;

    varying float vAlpha;

    void main() {
        float phase = aSeed.x;
        float rise = aSeed.y;
        float swirl = aSeed.z;
        float bright = aSeed.w;

        float life = fract(phase + uTime * rise);
        vec3 world = aAnchor;
        world.y += life * uSpan;
        world.x += sin(uTime * swirl + phase * 6.2831) * 0.35;
        world.z += cos(uTime * swirl * 0.8 + phase * 4.13) * 0.35;

        vec4 viewPosition = viewMatrix * vec4(world, 1.0);
        float fade = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.76, 1.0, life));
        vAlpha = fade * bright;

        gl_PointSize = clamp(uSize * (300.0 / max(0.1, -viewPosition.z)), 1.0, 40.0);
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
        float alpha = texel.a * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uTint * texel.rgb, alpha);
    }
`;

export class ChurchAtmosphere {
    private readonly candles: Array<{ position: THREE.Vector3; scale: number }> = [];
    private flames: THREE.Mesh | null = null;
    private halos: THREE.Mesh | null = null;
    private motes: THREE.Points[] = [];
    private smoke: THREE.InstancedMesh | null = null;
    private puffs: Puff[] = [];
    private smokeTimer = 0;
    private readonly censerPosition = new THREE.Vector3();
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly scaleVector = new THREE.Vector3();
    private readonly faceCamera = new THREE.Matrix4();
    private readonly up = new THREE.Vector3(0, 1, 0);
    private readonly scratchColor = new THREE.Color();
    private readonly hidden = new THREE.Vector3(0, -9999, 0);
    private elapsed = 0;
    private time = { value: 0 };

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly particles: boolean
    ) { }

    public addCandle(x: number, y: number, z: number, scale = 1) {
        this.candles.push({ position: new THREE.Vector3(x, y, z), scale });
    }

    public create(beams: BeamAnchor[], bounds: { halfWidth: number; from: number; to: number; height: number }) {
        this.buildFlames();
        if (!this.particles) return;
        this.buildMotes(beams, bounds);
        this.buildSmoke();
    }

    private billboardGeometry(count: number): THREE.InstancedBufferGeometry {
        const quad = new THREE.PlaneGeometry(1, 1);
        const geometry = this.bin.geometry(new THREE.InstancedBufferGeometry());
        geometry.index = quad.index;
        geometry.attributes.position = quad.attributes.position;
        geometry.attributes.uv = quad.attributes.uv;
        quad.dispose();

        const offsets = new Float32Array(count * 3);
        const seeds = new Float32Array(count * 4);

        for (let i = 0; i < count; i++) {
            const candle = this.candles[i];
            offsets[i * 3] = candle.position.x;
            offsets[i * 3 + 1] = candle.position.y;
            offsets[i * 3 + 2] = candle.position.z;

            seeds[i * 4] = this.random();
            seeds[i * 4 + 1] = candle.scale * (0.86 + this.random() * 0.28);
            seeds[i * 4 + 2] = 6 + this.random() * 7;
            seeds[i * 4 + 3] = 0.03 + this.random() * 0.05;
        }

        geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
        geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
        geometry.instanceCount = count;
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
        return geometry;
    }

    private buildFlames() {
        const count = this.candles.length;
        if (count === 0) return;

        const geometry = this.billboardGeometry(count);

        const flameMaterial = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: flameTexture(this.bin) },
                uTint: { value: new THREE.Color(0xffd9a0) },
                uTime: this.time,
                uWidth: { value: 0.16 },
                uHeight: { value: 0.42 },
                uRise: { value: 0 },
            },
            vertexShader: flameVertex,
            fragmentShader: flameFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const flames = new THREE.Mesh(geometry, flameMaterial);
        flames.frustumCulled = false;
        flames.renderOrder = 9;
        this.scene.add(flames);
        this.flames = flames;

        const haloMaterial = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: haloTexture(this.bin) },
                uTint: { value: new THREE.Color(0xffb763) },
                uTime: this.time,
                uWidth: { value: 0.95 },
                uHeight: { value: 0.95 },
                uRise: { value: -0.22 },
            },
            vertexShader: flameVertex,
            fragmentShader: flameFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const halos = new THREE.Mesh(geometry, haloMaterial);
        halos.frustumCulled = false;
        halos.renderOrder = 8;
        this.scene.add(halos);
        this.halos = halos;
    }

    private buildMotes(beams: BeamAnchor[], bounds: { halfWidth: number; from: number; to: number; height: number }) {
        const dust = dustTexture(this.bin);

        const ambientCount = 520;
        const ambientAnchors = new Float32Array(ambientCount * 3);
        const ambientSeeds = new Float32Array(ambientCount * 4);

        for (let i = 0; i < ambientCount; i++) {
            ambientAnchors[i * 3] = (this.random() - 0.5) * (bounds.halfWidth * 2 - 3);
            ambientAnchors[i * 3 + 1] = 0.4 + this.random() * 2;
            ambientAnchors[i * 3 + 2] = bounds.from + this.random() * (bounds.to - bounds.from);

            ambientSeeds[i * 4] = this.random();
            ambientSeeds[i * 4 + 1] = 0.012 + this.random() * 0.02;
            ambientSeeds[i * 4 + 2] = 0.2 + this.random() * 0.4;
            ambientSeeds[i * 4 + 3] = 0.18 + this.random() * 0.3;
        }

        this.motes.push(this.buildMoteLayer(dust, ambientAnchors, ambientSeeds, 0.06, 0xffe9c2, bounds.height));

        if (beams.length === 0) return;

        const beamCount = 760;
        const beamAnchors = new Float32Array(beamCount * 3);
        const beamSeeds = new Float32Array(beamCount * 4);
        const point = new THREE.Vector3();

        for (let i = 0; i < beamCount; i++) {
            const beam = beams[Math.floor(this.random() * beams.length) % beams.length];
            const t = this.random();
            point.copy(beam.origin).addScaledVector(beam.direction, t * beam.length * 0.6);

            const spread = beam.radius * (0.5 + t * 1.1);
            beamAnchors[i * 3] = point.x + (this.random() - 0.5) * spread * 2;
            beamAnchors[i * 3 + 1] = point.y + (this.random() - 0.5) * spread;
            beamAnchors[i * 3 + 2] = point.z + (this.random() - 0.5) * spread * 2;

            beamSeeds[i * 4] = this.random();
            beamSeeds[i * 4 + 1] = 0.02 + this.random() * 0.035;
            beamSeeds[i * 4 + 2] = 0.35 + this.random() * 0.7;
            beamSeeds[i * 4 + 3] = 0.6 + this.random() * 0.7;
        }

        this.motes.push(this.buildMoteLayer(dust, beamAnchors, beamSeeds, 0.075, 0xfff0cf, 2.4));
    }

    private buildMoteLayer(
        map: THREE.Texture,
        anchors: Float32Array,
        seeds: Float32Array,
        size: number,
        tint: number,
        span: number
    ): THREE.Points {
        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(anchors.length), 3));
        geometry.setAttribute("aAnchor", new THREE.BufferAttribute(anchors, 3));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));

        const material = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: map },
                uTint: { value: new THREE.Color(tint) },
                uTime: this.time,
                uSize: { value: size },
                uSpan: { value: span },
            },
            vertexShader: moteVertex,
            fragmentShader: moteFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 9;
        this.scene.add(points);
        return points;
    }

    private buildSmoke() {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map: smokeTexture(this.bin, this.random),
            color: 0xcfc4ae,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            side: THREE.DoubleSide,
        }));

        const smoke = new THREE.InstancedMesh(this.bin.geometry(new THREE.PlaneGeometry(1, 1)), material, SMOKE_POOL);
        smoke.frustumCulled = false;
        smoke.renderOrder = 7;
        smoke.castShadow = false;
        smoke.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_POOL * 3), 3);

        for (let i = 0; i < SMOKE_POOL; i++) {
            this.puffs.push({
                life: 0,
                duration: 1,
                size: 1,
                drift: new THREE.Vector3(),
                position: new THREE.Vector3(),
                spin: 0,
                active: false,
            });
            this.matrix.makeTranslation(this.hidden.x, this.hidden.y, this.hidden.z);
            smoke.setMatrixAt(i, this.matrix);
        }

        smoke.instanceMatrix.needsUpdate = true;
        this.scene.add(smoke);
        this.smoke = smoke;
    }

    public setCenser(position: THREE.Vector3) {
        this.censerPosition.copy(position);
    }

    private spawnPuff() {
        for (const puff of this.puffs) {
            if (puff.active) continue;
            puff.active = true;
            puff.life = 0;
            puff.duration = 5.5 + this.random() * 4;
            puff.size = 0.5 + this.random() * 0.5;
            puff.spin = (this.random() - 0.5) * 0.8;
            puff.position.copy(this.censerPosition);
            puff.drift.set((this.random() - 0.5) * 0.22, 0.4 + this.random() * 0.3, (this.random() - 0.5) * 0.22);
            return;
        }
    }

    public update(delta: number, cameraPosition: THREE.Vector3) {
        this.elapsed += delta;
        this.time.value = this.elapsed;

        if (!this.smoke) return;

        this.smokeTimer -= delta;
        if (this.smokeTimer <= 0) {
            this.smokeTimer = 0.45 + this.random() * 0.4;
            this.spawnPuff();
        }

        this.faceCamera.lookAt(cameraPosition, this.censerPosition, this.up);
        this.quaternion.setFromRotationMatrix(this.faceCamera);

        for (let i = 0; i < this.puffs.length; i++) {
            const puff = this.puffs[i];

            if (!puff.active) {
                this.matrix.makeTranslation(this.hidden.x, this.hidden.y, this.hidden.z);
                this.smoke.setMatrixAt(i, this.matrix);
                continue;
            }

            puff.life += delta;
            const t = puff.life / puff.duration;
            if (t >= 1) {
                puff.active = false;
                this.matrix.makeTranslation(this.hidden.x, this.hidden.y, this.hidden.z);
                this.smoke.setMatrixAt(i, this.matrix);
                continue;
            }

            puff.position.addScaledVector(puff.drift, delta);
            puff.position.x += Math.sin(this.elapsed * 0.6 + i) * delta * 0.18;
            puff.drift.y *= 1 - delta * 0.12;

            const scale = puff.size * (0.5 + t * 3.4);
            this.scaleVector.set(scale, scale, scale);
            this.matrix.compose(puff.position, this.quaternion, this.scaleVector);
            this.smoke.setMatrixAt(i, this.matrix);

            const fade = Math.min(1, t * 6) * (1 - t) * 0.26;
            this.smoke.setColorAt(i, this.scratchColor.setScalar(fade));
        }

        this.smoke.instanceMatrix.needsUpdate = true;
        if (this.smoke.instanceColor) this.smoke.instanceColor.needsUpdate = true;
    }

    public dispose() {
        if (this.flames) this.scene.remove(this.flames);
        if (this.halos) this.scene.remove(this.halos);
        if (this.smoke) this.scene.remove(this.smoke);
        for (const points of this.motes) this.scene.remove(points);

        this.flames = null;
        this.halos = null;
        this.smoke = null;
        this.motes = [];
        this.puffs = [];
        this.candles.length = 0;
    }
}
