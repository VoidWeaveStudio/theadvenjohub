// src/features/game/world/locations/main-world/systems/RockRingSystem.ts
import * as THREE from "three";
import { fbm, smoothstep } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import { COVE_ANGLE, COVE_RING_OPENNESS, PORTS, RING_INNER, RING_OUTER, SEABED_DEPTH, WORLD_SEED } from "../worldConfig";

const RING_STEPS = 320;
const RING_MAX_HEIGHT = 86;
const RING_MIN_HEIGHT = 34;

function angleDistance(a: number, b: number): number {
    let diff = Math.abs(a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
}

export class RockRingSystem {
    private mesh: THREE.Mesh | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) { }

    public isPortAngle(angle: number): boolean {
        return this.portOpenness(angle) > 0.35;
    }

    private portOpenness(angle: number): number {
        let openness = 0;
        for (const port of PORTS) {
            const distance = angleDistance(angle, port.angle);
            openness = Math.max(openness, 1 - smoothstep(port.halfWidth * 0.55, port.halfWidth, distance));
        }

        const coveDistance = angleDistance(angle, COVE_ANGLE);
        const coveOpen = 1 - smoothstep(COVE_RING_OPENNESS * 0.45, COVE_RING_OPENNESS, coveDistance);
        return Math.max(openness, coveOpen);
    }

    public create() {
        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const rockLow = new THREE.Color(0x3a3733);
        const rockHigh = new THREE.Color(0x6d6a63);

        const columns: { inner: THREE.Vector3; outer: THREE.Vector3; top: THREE.Vector3 }[] = [];

        for (let i = 0; i <= RING_STEPS; i++) {
            const angle = (i / RING_STEPS) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const wobble = fbm(cos * 5.5 + 40, sin * 5.5 + 40, 3, WORLD_SEED + 3301);
            const openness = this.portOpenness(angle);

            const innerRadius = RING_INNER + wobble * 16 + openness * 26;
            const outerRadius = RING_OUTER + wobble * 10;
            const height = (RING_MIN_HEIGHT + wobble * (RING_MAX_HEIGHT - RING_MIN_HEIGHT)) * (1 - openness);

            const innerBase = this.terrain.getHeightAt(cos * innerRadius, sin * innerRadius);
            const outerBase = SEABED_DEPTH - 4;

            columns.push({
                inner: new THREE.Vector3(cos * innerRadius, innerBase - 2, sin * innerRadius),
                outer: new THREE.Vector3(cos * outerRadius, outerBase, sin * outerRadius),
                top: new THREE.Vector3(
                    cos * (innerRadius + (outerRadius - innerRadius) * 0.45),
                    Math.max(innerBase, 0) + height,
                    sin * (innerRadius + (outerRadius - innerRadius) * 0.45)
                ),
            });
        }

        const pushVertex = (point: THREE.Vector3, shade: number) => {
            positions.push(point.x, point.y, point.z);
            const color = rockLow.clone().lerp(rockHigh, shade);
            colors.push(color.r, color.g, color.b);
            return positions.length / 3 - 1;
        };

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const shade = smoothstep(0, RING_MAX_HEIGHT, column.top.y);
            pushVertex(column.inner, 0.12);
            pushVertex(column.top, shade);
            pushVertex(column.outer, 0.05);
        }

        for (let i = 0; i < columns.length - 1; i++) {
            const a = i * 3;
            const b = (i + 1) * 3;

            indices.push(a, a + 1, b);
            indices.push(b, a + 1, b + 1);
            indices.push(a + 1, a + 2, b + 1);
            indices.push(b + 1, a + 2, b + 2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        this.mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.94,
                metalness: 0.02,
                flatShading: true,
                side: THREE.DoubleSide,
            })
        );
        this.mesh.name = "rock-ring";
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.mesh.matrixAutoUpdate = false;
        this.mesh.updateMatrix();
        this.scene.add(this.mesh);
    }

    public dispose() {
        if (!this.mesh) return;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh = null;
    }
}
