// src\features\game\map\Dust2Map.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionBox } from '../types';

export class Dust2Map {
    private collisionBoxes: CollisionBox[] = [];
    private scene: THREE.Scene | null = null;

    private wallGeometries: THREE.BufferGeometry[] = [];
    private boxGeometries: THREE.BufferGeometry[] = [];
    private darkWallGeometries: THREE.BufferGeometry[] = [];
    private concreteGeometries: THREE.BufferGeometry[] = [];

    private readonly wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd4a574, flatShading: true });
    private readonly wallDarkMaterial = new THREE.MeshStandardMaterial({ color: 0xb89060, flatShading: true });
    private readonly boxMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6f47, flatShading: true });
    private readonly concreteMaterial = new THREE.MeshStandardMaterial({ color: 0xa0a090, flatShading: true });

    getCollisionBoxes(): CollisionBox[] {
        return this.collisionBoxes;
    }

    getSpawnPoints(): { team1: { x: number; z: number }[]; team2: { x: number; z: number }[]; ffa: { x: number; z: number }[] } {
        return {
            team1: [
                { x: -20, z: -50 }, { x: -15, z: -50 }, { x: -25, z: -50 },
                { x: -18, z: -48 }, { x: -22, z: -48 }
            ],
            team2: [
                { x: 20, z: -50 }, { x: 15, z: -50 }, { x: 25, z: -50 },
                { x: 18, z: -48 }, { x: 22, z: -48 }
            ],
            ffa: [
                { x: 0, z: -45 }, { x: -10, z: -40 }, { x: 10, z: -40 },
                { x: -20, z: -35 }, { x: 20, z: -35 }, { x: -30, z: -30 },
                { x: 30, z: -30 }, { x: 0, z: -30 }, { x: -15, z: -25 }, { x: 15, z: -25 }
            ]
        };
    }

    build(scene: THREE.Scene): void {
        this.scene = scene;
        this.collisionBoxes = [];
        this.wallGeometries = [];
        this.boxGeometries = [];
        this.darkWallGeometries = [];
        this.concreteGeometries = [];

        this.addBorders();
        this.addTSpawn();
        this.addMid();
        this.addLongA();
        this.addShortA();
        this.addSiteA();
        this.addBTunnels();
        this.addSiteB();
        this.addCTSpawn();
        this.addCTConnections();
        this.addExtraCover();
        this.addZoneMarkers();

        this.mergeAndAddMeshes();
    }

    private addWall(
        x: number, z: number, width: number, depth: number,
        height: number = 5,
        material?: THREE.MeshStandardMaterial
    ): void {
        const geo = new THREE.BoxGeometry(width, height, depth);
        geo.translate(x, height / 2, z);

        if (material === this.wallDarkMaterial) {
            this.darkWallGeometries.push(geo);
        } else if (material === this.concreteMaterial) {
            this.concreteGeometries.push(geo);
        } else {
            this.wallGeometries.push(geo);
        }

        this.collisionBoxes.push({
            minX: x - width / 2, maxX: x + width / 2,
            minZ: z - depth / 2, maxZ: z + depth / 2
        });
    }

    private addBox(x: number, z: number, size: number = 2, height?: number): void {
        const h = height || size;
        const geo = new THREE.BoxGeometry(size, h, size);
        geo.translate(x, h / 2, z);
        this.boxGeometries.push(geo);

        this.collisionBoxes.push({
            minX: x - size / 2, maxX: x + size / 2,
            minZ: z - size / 2, maxZ: z + size / 2
        });
    }

    private addBorders(): void {
        this.addWall(0, -65, 140, 2, 8, this.concreteMaterial);
        this.addWall(0, 65, 140, 2, 8, this.concreteMaterial);
        this.addWall(-70, 0, 2, 130, 8, this.concreteMaterial);
        this.addWall(70, 0, 2, 130, 8, this.concreteMaterial);
    }

    private addTSpawn(): void {
        this.addWall(-25, -50, 2, 20, 5, this.wallDarkMaterial);
        this.addWall(25, -50, 2, 20, 5, this.wallDarkMaterial);
        this.addBox(-20, -55, 2);
        this.addBox(20, -55, 2);
        this.addWall(-8, -35, 2, 12);
        this.addWall(8, -35, 2, 12);
    }

    private addMid(): void {
        this.addWall(-18, -10, 2, 30);
        this.addWall(18, -10, 2, 30);
        this.addBox(-5, -15, 2.5);
        this.addBox(5, -15, 2.5);
        this.addBox(0, -5, 2);
    }

    private addLongA(): void {
        this.addWall(-35, -15, 2, 30);
        this.addWall(-25, -15, 2, 30);
        this.addBox(-30, -25, 2);
        this.addBox(-30, -5, 2);
        this.addBox(-30, 5, 2.5, 1.5);
    }

    private addShortA(): void {
        this.addWall(-20, 10, 12, 2);
        this.addWall(-20, 18, 12, 2);
    }

    private addSiteA(): void {
        this.addWall(-45, 25, 20, 2);
        this.addWall(-45, 45, 20, 2);
        this.addWall(-55, 35, 2, 20);
        this.addWall(-35, 35, 2, 10);
        this.addBox(-45, 35, 3, 2);
        this.addBox(-50, 30, 2);
        this.addBox(-40, 40, 2);
    }

    private addBTunnels(): void {
        this.addWall(35, -15, 2, 30);
        this.addWall(25, -15, 2, 30);
        this.addBox(30, -25, 2);
        this.addBox(30, -5, 2);
        this.addBox(30, 5, 2.5, 1.5);
    }

    private addSiteB(): void {
        this.addWall(45, 25, 20, 2);
        this.addWall(45, 45, 20, 2);
        this.addWall(55, 35, 2, 20);
        this.addWall(35, 35, 2, 10);
        this.addBox(45, 35, 3, 2);
        this.addBox(50, 30, 2);
        this.addBox(40, 40, 2);
    }

    private addCTSpawn(): void {
        this.addWall(-15, 55, 2, 16, 5, this.wallDarkMaterial);
        this.addWall(15, 55, 2, 16, 5, this.wallDarkMaterial);
        this.addWall(0, 50, 20, 2, 5, this.wallDarkMaterial);
        this.addBox(-10, 58, 2);
        this.addBox(10, 58, 2);
    }

    private addCTConnections(): void {
        this.addWall(-25, 50, 2, 12);
        this.addWall(25, 50, 2, 12);
    }

    private addExtraCover(): void {
        this.addBox(-12, 0, 2);
        this.addBox(12, 0, 2);
        this.addBox(0, 15, 2.5);
    }

    private addZoneMarkers(): void {
        if (!this.scene) return;
        const markerGeometry = new THREE.BoxGeometry(4, 0.05, 4);
        const markers = [
            { color: 0xff4444, position: [0, 0.03, -50] },
            { color: 0x4444ff, position: [0, 0.03, 55] },
            { color: 0xffff00, position: [-45, 0.03, 35] },
            { color: 0x00ff00, position: [45, 0.03, 35] }
        ];

        markers.forEach(({ color, position }) => {
            const material = new THREE.MeshStandardMaterial({ color });
            const marker = new THREE.Mesh(markerGeometry, material);
            marker.position.set(position[0], position[1], position[2]);
            this.scene!.add(marker);
        });
    }

    private mergeAndAddMeshes(): void {
        if (!this.scene) return;

        const createMergedMesh = (
            geometries: THREE.BufferGeometry[],
            material: THREE.MeshStandardMaterial
        ) => {
            if (geometries.length === 0) return;

            const merged = mergeGeometries(geometries, false);
            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene!.add(mesh);

            geometries.forEach(g => g.dispose());
        };

        createMergedMesh(this.wallGeometries, this.wallMaterial);
        createMergedMesh(this.boxGeometries, this.boxMaterial);
        createMergedMesh(this.darkWallGeometries, this.wallDarkMaterial);
        createMergedMesh(this.concreteGeometries, this.concreteMaterial);
    }
}