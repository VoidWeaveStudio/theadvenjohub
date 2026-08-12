// src/features/game/world/locations/main-world/systems/GrassSystem.ts
import * as THREE from "three";
import { createGrassBladeGeometry } from "../utils/proceduralFlora";
import { hashInt } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import { WORLD_SEED } from "../worldConfig";

const FIELD_RADIUS = 46;
const CELL_SIZE = 1.15;
const REBUILD_DISTANCE = 9;
const MAX_BLADES = 9000;
const MIN_HEIGHT = 2.4;
const MAX_SLOPE = 0.42;

const grassVertexShader = /* glsl */`
    uniform float uTime;

    varying float vBlade;
    varying vec3 vWorldPos;

    void main() {
        vBlade = position.y;

        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        #endif

        vec4 world = modelMatrix * local;

        float sway = sin(uTime * 1.5 + world.x * 0.32 + world.z * 0.26) * 0.22
                   + sin(uTime * 2.6 + world.z * 0.55) * 0.08;

        world.x += sway * vBlade;
        world.z += sway * 0.55 * vBlade;

        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const grassFragmentShader = /* glsl */`
    uniform vec3 uBaseColor;
    uniform vec3 uTipColor;
    uniform vec3 uLightDirection;

    varying float vBlade;
    varying vec3 vWorldPos;

    void main() {
        float gradient = clamp(vBlade / 0.62, 0.0, 1.0);
        vec3 color = mix(uBaseColor, uTipColor, gradient);

        float ambient = 0.55;
        float diffuse = max(dot(normalize(vec3(0.0, 1.0, 0.35)), normalize(uLightDirection)), 0.0) * 0.45;

        gl_FragColor = vec4(color * (ambient + diffuse), 1.0);
    }
`;

export class GrassSystem {
    private mesh: THREE.InstancedMesh | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private readonly uniforms;
    private readonly matrix = new THREE.Matrix4();
    private readonly position = new THREE.Vector3();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private readonly scale = new THREE.Vector3();

    private lastX = Number.NaN;
    private lastZ = Number.NaN;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lowEnd: boolean
    ) {
        this.uniforms = {
            uTime: { value: 0 },
            uBaseColor: { value: new THREE.Color(0x1d3a16) },
            uTipColor: { value: new THREE.Color(0x6f9a3c) },
            uLightDirection: { value: new THREE.Vector3(0.4, 1, 0.3).normalize() },
        };
    }

    public create() {
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: grassVertexShader,
            fragmentShader: grassFragmentShader,
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.InstancedMesh(createGrassBladeGeometry(), this.material, this.capacity());
        this.mesh.name = "grass-field";
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);
    }

    private capacity(): number {
        return this.lowEnd ? Math.floor(MAX_BLADES / 3) : MAX_BLADES;
    }

    public update(delta: number, playerX: number, playerZ: number) {
        this.uniforms.uTime.value += delta;

        const moved = Math.hypot(playerX - this.lastX, playerZ - this.lastZ);
        if (Number.isFinite(moved) && moved < REBUILD_DISTANCE) return;

        this.lastX = playerX;
        this.lastZ = playerZ;
        this.rebuild(playerX, playerZ);
    }

    private rebuild(centerX: number, centerZ: number) {
        const mesh = this.mesh;
        if (!mesh) return;

        const capacity = this.capacity();
        const cells = Math.ceil(FIELD_RADIUS / CELL_SIZE);
        const radiusSquared = FIELD_RADIUS * FIELD_RADIUS;

        const baseCellX = Math.floor(centerX / CELL_SIZE);
        const baseCellZ = Math.floor(centerZ / CELL_SIZE);

        let used = 0;

        for (let iz = -cells; iz <= cells && used < capacity; iz++) {
            for (let ix = -cells; ix <= cells && used < capacity; ix++) {
                const cellX = baseCellX + ix;
                const cellZ = baseCellZ + iz;

                const jitterX = hashInt(cellX, cellZ, WORLD_SEED + 11);
                const jitterZ = hashInt(cellX, cellZ, WORLD_SEED + 29);
                const density = hashInt(cellX, cellZ, WORLD_SEED + 47);
                if (density < 0.35) continue;

                const x = (cellX + jitterX) * CELL_SIZE;
                const z = (cellZ + jitterZ) * CELL_SIZE;

                const dx = x - centerX;
                const dz = z - centerZ;
                if (dx * dx + dz * dz > radiusSquared) continue;

                const height = this.terrain.getHeightAt(x, z);
                if (height < MIN_HEIGHT) continue;
                if (this.terrain.getSlopeAt(x, z) > MAX_SLOPE) continue;
                if (this.isInLake(x, z, height)) continue;

                this.position.set(x, height, z);
                this.euler.set(0, hashInt(cellX, cellZ, WORLD_SEED + 83) * Math.PI * 2, 0);
                this.quaternion.setFromEuler(this.euler);
                this.scale.setScalar(0.75 + density * 0.8);
                this.matrix.compose(this.position, this.quaternion, this.scale);

                mesh.setMatrixAt(used, this.matrix);
                used++;
            }
        }

        mesh.count = used;
        mesh.instanceMatrix.needsUpdate = true;
    }

    private isInLake(x: number, z: number, height: number): boolean {
        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz < lake.radius * lake.radius && height < lake.level + 0.4) return true;
        }
        return false;
    }

    public dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.dispose();
            this.mesh = null;
        }
        this.material?.dispose();
        this.material = null;
    }
}
