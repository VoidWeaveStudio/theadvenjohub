// src/features/game/world/Terrain.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

export class Terrain {
    private mesh: THREE.Mesh | null = null;
    private size: number;
    private segments: number;

    private heightCache: Float32Array | null = null;
    private cacheWidth: number = 0;
    private cacheHeight: number = 0;

    constructor(size: number = 500, segments: number = 64) {
        this.size = size;
        this.segments = segments;
    }

    create(scene: THREE.Scene, rm?: ResourceManager): THREE.Mesh {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);

        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const dist = Math.sqrt(x * x + y * y);

            if (dist < 40) {
                positions.setZ(i, 0);
            } else {
                const noise =
                    Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2 +
                    Math.sin(x * 0.1 + 1.5) * Math.cos(y * 0.08 + 0.7) * 1.5 +
                    Math.sin(x * 0.02) * Math.cos(y * 0.03) * 3;

                positions.setZ(i, noise);
            }
        }

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0,
            flatShading: false,
        });

        if (rm) {
            const colorMap = rm.getTexture("ground-color");
            const normalMap = rm.getTexture("ground-normal");
            const roughnessMap = rm.getTexture("ground-roughness");
            const aoMap = rm.getTexture("ground-ao");

            const repeatX = 50;
            const repeatY = 50;

            if (colorMap) {
                material.map = colorMap;
                colorMap.repeat.set(repeatX, repeatY);
            }

            if (normalMap) {
                material.normalMap = normalMap;
                material.normalScale = new THREE.Vector2(1.5, 1.5);
                normalMap.repeat.set(repeatX, repeatY);
            }

            if (roughnessMap) {
                material.roughnessMap = roughnessMap;
                roughnessMap.repeat.set(repeatX, repeatY);
            }

            if (aoMap) {
                material.aoMap = aoMap;
                material.aoMapIntensity = 0.7;
                aoMap.repeat.set(repeatX, repeatY);

                geometry.setAttribute('uv2', geometry.attributes.uv);
            }
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        this.buildHeightCache();

        return this.mesh;
    }

    private buildHeightCache() {
        if (!this.mesh) return;

        const geometry = this.mesh.geometry as THREE.PlaneGeometry;
        const positions = geometry.attributes.position;

        this.cacheWidth = this.segments + 1;
        this.cacheHeight = this.segments + 1;
        this.heightCache = new Float32Array(this.cacheWidth * this.cacheHeight);

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            const gridX = Math.round(((x / this.size) + 0.5) * this.segments);
            const gridY = Math.round(((y / this.size) + 0.5) * this.segments);

            if (gridX >= 0 && gridX < this.cacheWidth && gridY >= 0 && gridY < this.cacheHeight) {
                this.heightCache[gridY * this.cacheWidth + gridX] = z;
            }
        }
    }

    getHeightAt(x: number, z: number): number {
        if (!this.heightCache) return 0;

        const localX = x;
        const localZ = -z;

        const gridX = ((localX / this.size) + 0.5) * this.segments;
        const gridZ = ((localZ / this.size) + 0.5) * this.segments;

        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = x0 + 1;
        const z1 = z0 + 1;

        if (x0 < 0 || x1 >= this.cacheWidth || z0 < 0 || z1 >= this.cacheHeight) {
            return 0;
        }

        const fx = gridX - x0;
        const fz = gridZ - z0;

        const h00 = this.heightCache[z0 * this.cacheWidth + x0];
        const h10 = this.heightCache[z0 * this.cacheWidth + x1];
        const h01 = this.heightCache[z1 * this.cacheWidth + x0];
        const h11 = this.heightCache[z1 * this.cacheWidth + x1];

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;

        return h0 * (1 - fz) + h1 * fz;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
        }
        this.heightCache = null;
    }
}