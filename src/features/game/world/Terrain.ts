//src\features\game\world\Terrain.ts
import * as THREE from "three";

export class Terrain {
    private mesh: THREE.Mesh | null = null;
    private size: number;
    private segments: number;

    constructor(size: number = 500, segments: number = 64) {
        this.size = size;
        this.segments = segments;
    }

    create(scene: THREE.Scene): THREE.Mesh {
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
            color: 0x4a8a3a,
            roughness: 0.95,
            metalness: 0,
            flatShading: false,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        return this.mesh;
    }

    getHeightAt(x: number, z: number): number {
        if (!this.mesh) return 0;

        const geometry = this.mesh.geometry as THREE.PlaneGeometry;
        const positions = geometry.attributes.position;

        const localX = x;
        const localZ = z;

        let closestHeight = 0;
        let minDist = Infinity;

        for (let i = 0; i < positions.count; i++) {
            const vx = positions.getX(i);
            const vy = positions.getY(i);
            const vz = positions.getZ(i);

            const dist = Math.sqrt((vx - localX) ** 2 + (vy - localZ) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closestHeight = vz;
            }
        }

        return closestHeight;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
        }
    }
}