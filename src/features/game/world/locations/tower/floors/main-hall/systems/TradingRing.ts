// src/features/game/world/locations/tower/floors/main-hall/systems/TradingRing.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch } from "../utils/geometryBatch";
import { insertDisc } from "../utils/collision";
import type { ShellMaterials } from "./HallShell";
import { RING_STEPS, RING_TOP_RADIUS, RING_TOP_Y, isLowEndDevice } from "../layout";

const PIT_LAMP_COUNT = 6;

export class TradingRing {
    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const stepBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const deckBatch = new GeometryBatch();

        const cylinder = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 72));

        let previousTop = 0;

        for (const step of RING_STEPS) {
            stepBatch.addScaled(cylinder, 0, step.top / 2, 0, step.radius, step.top, step.radius);

            const nosing = this.bin.geometry(new THREE.TorusGeometry(step.radius, 0.11, 6, 96));
            brassBatch.addRotated(nosing, 0, step.top - 0.03, 0, Math.PI / 2);

            insertDisc(this.collisionGrid, step.radius, step.top, step.top - previousTop + 0.1);

            previousTop = step.top;
        }

        const deck = this.bin.geometry(new THREE.CircleGeometry(RING_TOP_RADIUS - 0.5, 72));
        deckBatch.addRotated(deck, 0, RING_TOP_Y + 0.03, 0, -Math.PI / 2);

        const compassRing = this.bin.geometry(new THREE.TorusGeometry(RING_TOP_RADIUS - 2.4, 0.09, 4, 96));
        brassBatch.addRotated(compassRing, 0, RING_TOP_Y + 0.06, 0, Math.PI / 2);

        const spoke = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const length = i % 2 === 0 ? RING_TOP_RADIUS - 1.4 : RING_TOP_RADIUS - 5;
            const mid = 3.4 + length / 2;
            brassBatch.addScaled(
                spoke,
                Math.sin(angle) * mid * 0.5,
                RING_TOP_Y + 0.06,
                -Math.cos(angle) * mid * 0.5,
                0.13,
                0.05,
                length * 0.6,
                -angle
            );
        }

        this.buildPitPosts(brassBatch);

        const steps = stepBatch.build(materials.stone, { castShadow: true, receiveShadow: true });
        if (steps) this.scene.add(steps);

        const deckMesh = deckBatch.build(materials.darkTrim, { receiveShadow: true });
        if (deckMesh) this.scene.add(deckMesh);

        const brass = brassBatch.build(materials.brass, { castShadow: true, receiveShadow: true });
        if (brass) this.scene.add(brass);
    }

    private buildPitPosts(brassBatch: GeometryBatch) {
        const shaftHeight = 3.4;
        const shaftTop = RING_TOP_Y + shaftHeight;
        const globeRadius = 0.42;
        const globeY = shaftTop + 0.42 + globeRadius;

        const post = this.bin.geometry(new THREE.CylinderGeometry(0.14, 0.22, shaftHeight, 10));
        const base = this.bin.geometry(new THREE.CylinderGeometry(0.42, 0.52, 0.26, 12));
        const cup = this.bin.geometry(new THREE.CylinderGeometry(0.36, 0.16, 0.42, 12));
        const finial = this.bin.geometry(new THREE.ConeGeometry(0.16, 0.34, 10));
        const globe = this.bin.geometry(new THREE.SphereGeometry(globeRadius, 16, 12));
        const lowEnd = isLowEndDevice();

        const glowMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xfff0c4,
            emissive: 0xffd479,
            emissiveIntensity: 1.7,
            roughness: 0.4,
            toneMapped: false,
        }));

        const radius = RING_TOP_RADIUS - 1.1;
        const globeBatch = new GeometryBatch();

        for (let i = 0; i < PIT_LAMP_COUNT; i++) {
            const angle = (i / PIT_LAMP_COUNT) * Math.PI * 2 + Math.PI / PIT_LAMP_COUNT;
            const x = Math.sin(angle) * radius;
            const z = -Math.cos(angle) * radius;

            brassBatch.add(base, x, RING_TOP_Y + 0.13, z, -angle);
            brassBatch.add(post, x, RING_TOP_Y + shaftHeight / 2, z, -angle);
            brassBatch.add(cup, x, shaftTop + 0.21, z, -angle);

            globeBatch.add(globe, x, globeY, z);

            brassBatch.add(finial, x, globeY + globeRadius + 0.17, z, -angle);

            if (!lowEnd && i % 3 === 0) {
                const light = new THREE.PointLight(0xffd479, 5, 26, 2);
                light.position.set(x, globeY, z);
                light.castShadow = false;
                this.scene.add(light);
            }

            this.collisionGrid.insertCylinder(
                new THREE.Vector3(x, RING_TOP_Y + shaftHeight / 2, z),
                0.32,
                shaftHeight
            );
        }

        const globeMesh = globeBatch.build(glowMaterial);
        if (globeMesh) this.scene.add(globeMesh);
    }
}
