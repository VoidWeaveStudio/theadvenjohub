// src/features/game/world/locations/showcase/rooms/church/ChurchLight.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { beamNoiseTexture, goboTexture } from "./churchTextures";

export interface ShaftSpec {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    width: number;
    height: number;
    length: number;
    tint: number;
    strength: number;
}

const SPREAD = 1.75;
const SECTION_SEGMENTS = 20;

const beamVertex = /* glsl */`
    precision highp float;

    attribute float aAlong;

    varying float vAlong;
    varying vec3 vNormal;
    varying vec3 vWorld;

    void main() {
        vAlong = aAlong;
        vNormal = normalize(mat3(modelMatrix) * normal);

        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;

        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const beamFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uNoise;
    uniform vec3 uTint;
    uniform vec3 uDir;
    uniform vec3 uCamPos;
    uniform float uTime;
    uniform float uStrength;

    varying float vAlong;
    varying vec3 vNormal;
    varying vec3 vWorld;

    void main() {
        vec3 toFrag = normalize(vWorld - uCamPos);
        float facing = abs(dot(normalize(vNormal), toFrag));
        float body = pow(facing, 1.35);
        if (body <= 0.002) discard;

        float ends = smoothstep(0.0, 0.09, vAlong) * (1.0 - smoothstep(0.34, 1.0, vAlong));

        vec2 uvA = vWorld.xz * 0.055 + vec2(uTime * 0.011, uTime * 0.007);
        vec2 uvB = vWorld.zy * 0.042 - vec2(uTime * 0.008, uTime * 0.013);
        float grain = texture2D(uNoise, uvA).r * texture2D(uNoise, uvB).r;
        grain = 0.48 + 1.35 * grain;

        float forward = 0.62 + 0.38 * pow(max(dot(toFrag, uDir), 0.0), 2.5);

        float alpha = body * ends * grain * forward * uStrength;
        if (alpha < 0.002) discard;

        gl_FragColor = vec4(uTint, alpha);
    }
`;

interface Shaft {
    material: THREE.ShaderMaterial;
    base: number;
    phase: number;
}

interface Gobo {
    material: THREE.MeshBasicMaterial;
    base: number;
    phase: number;
}

export class ChurchLight {
    private shafts: Shaft[] = [];
    private gobos: Gobo[] = [];
    private meshes: THREE.Object3D[] = [];
    private noise: THREE.CanvasTexture | null = null;
    private gobo: THREE.CanvasTexture | null = null;
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly floorY: number
    ) { }

    public create(specs: ShaftSpec[], withGobos: boolean) {
        this.noise = beamNoiseTexture(this.bin, this.random);
        if (withGobos) this.gobo = goboTexture(this.bin);

        for (const spec of specs) {
            this.buildShaft(spec);
            if (withGobos) this.buildGobo(spec);
        }
    }

    private beamBasis(direction: THREE.Vector3): THREE.Matrix4 {
        const zAxis = direction.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const xAxis = new THREE.Vector3().crossVectors(up, zAxis);
        if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
        xAxis.normalize();
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
        return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    }

    private buildGeometry(spec: ShaftSpec): THREE.BufferGeometry {
        const halfW = spec.width / 2;
        const halfH = spec.height / 2;
        const rings = 5;
        const positions: number[] = [];
        const normals: number[] = [];
        const along: number[] = [];
        const indices: number[] = [];

        const section: Array<[number, number]> = [];
        for (let i = 0; i < SECTION_SEGMENTS; i++) {
            const angle = (i / SECTION_SEGMENTS) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const shape = 0.32;
            section.push([
                Math.sign(cos) * Math.pow(Math.abs(cos), shape),
                Math.sign(sin) * Math.pow(Math.abs(sin), shape),
            ]);
        }

        for (let r = 0; r <= rings; r++) {
            const t = r / rings;
            const scale = 1 + (SPREAD - 1) * t;
            const z = spec.length * t;

            for (const [sx, sy] of section) {
                positions.push(sx * halfW * scale, sy * halfH * scale, z);
                along.push(t);

                const nx = sx / Math.max(0.0001, halfW);
                const ny = sy / Math.max(0.0001, halfH);
                const inverse = 1 / Math.max(0.0001, Math.hypot(nx, ny));
                normals.push(nx * inverse, ny * inverse, 0);
            }
        }

        for (let r = 0; r < rings; r++) {
            for (let i = 0; i < SECTION_SEGMENTS; i++) {
                const next = (i + 1) % SECTION_SEGMENTS;
                const a = r * SECTION_SEGMENTS + i;
                const b = r * SECTION_SEGMENTS + next;
                const c = (r + 1) * SECTION_SEGMENTS + next;
                const d = (r + 1) * SECTION_SEGMENTS + i;
                indices.push(a, b, c, a, c, d);
            }
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();
        return geometry;
    }

    private buildShaft(spec: ShaftSpec) {
        const material = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uNoise: { value: this.noise },
                uTint: { value: new THREE.Color(spec.tint) },
                uDir: { value: spec.direction.clone().normalize() },
                uCamPos: { value: new THREE.Vector3() },
                uTime: { value: 0 },
                uStrength: { value: spec.strength },
            },
            vertexShader: beamVertex,
            fragmentShader: beamFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
        }));

        const mesh = new THREE.Mesh(this.buildGeometry(spec), material);
        mesh.position.copy(spec.origin);
        mesh.quaternion.setFromRotationMatrix(this.beamBasis(spec.direction));
        mesh.renderOrder = 8;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        this.scene.add(mesh);
        this.meshes.push(mesh);
        this.shafts.push({ material, base: spec.strength, phase: this.random() * 9 });
    }

    private buildGobo(spec: ShaftSpec) {
        const direction = spec.direction.clone().normalize();
        if (direction.y > -0.05) return;

        const travel = (spec.origin.y - this.floorY) / -direction.y;
        if (travel <= 0 || travel > spec.length * 1.6) return;

        const landing = spec.origin.clone().addScaledVector(direction, travel);
        const forward = new THREE.Vector3(direction.x, 0, direction.z);
        if (forward.lengthSq() < 1e-5) forward.set(0, 0, 1);
        forward.normalize();

        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        const basis = new THREE.Matrix4().makeBasis(right, forward, up);

        const stretch = THREE.MathUtils.clamp(1 / Math.max(0.25, -direction.y), 1, 3.2);
        const width = spec.width * SPREAD;
        const length = spec.height * SPREAD * stretch;

        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map: this.gobo,
            color: new THREE.Color(spec.tint),
            transparent: true,
            opacity: spec.strength * 2.6,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(width, length)), material);
        mesh.quaternion.setFromRotationMatrix(basis);
        mesh.position.set(landing.x, this.floorY + 0.12, landing.z);
        mesh.renderOrder = 7;
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        this.scene.add(mesh);
        this.meshes.push(mesh);
        this.gobos.push({ material, base: material.opacity, phase: this.random() * 9 });
    }

    public update(delta: number, cameraPosition: THREE.Vector3) {
        this.elapsed += delta;

        for (const shaft of this.shafts) {
            shaft.material.uniforms.uTime.value = this.elapsed;
            shaft.material.uniforms.uCamPos.value.copy(cameraPosition);
            shaft.material.uniforms.uStrength.value =
                shaft.base * (0.82 + Math.sin(this.elapsed * 0.34 + shaft.phase) * 0.18);
        }

        for (const gobo of this.gobos) {
            gobo.material.opacity = gobo.base * (0.8 + Math.sin(this.elapsed * 0.41 + gobo.phase) * 0.2);
        }
    }

    public objects(): THREE.Object3D[] {
        return this.meshes;
    }

    public dispose() {
        for (const mesh of this.meshes) this.scene.remove(mesh);
        this.meshes = [];
        this.shafts = [];
        this.gobos = [];
        this.noise = null;
        this.gobo = null;
    }
}
