// src/features/game/world/locations/tower/floors/main-hall/systems/TradingRing.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch } from "../utils/geometryBatch";
import type { ShellMaterials } from "./HallShell";
import { RING_STEPS, RING_TOP_RADIUS, RING_TOP_Y } from "../layout";

const DISC_STRIPS = 16;

function insertDisc(collisionGrid: CollisionGrid, radius: number, top: number) {
    for (let i = 0; i < DISC_STRIPS; i++) {
        const z0 = -radius + (i / DISC_STRIPS) * radius * 2;
        const z1 = -radius + ((i + 1) / DISC_STRIPS) * radius * 2;
        const edge = Math.max(Math.abs(z0), Math.abs(z1));
        const halfWidth = Math.sqrt(Math.max(radius * radius - edge * edge, 0));
        if (halfWidth <= 0.05) continue;

        collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-halfWidth, 0, z0),
            new THREE.Vector3(halfWidth, top, z1)
        ));
    }
}

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

        const cylinder = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 48));

        for (const step of RING_STEPS) {
            stepBatch.addScaled(cylinder, 0, step.top / 2, 0, step.radius, step.top, step.radius);

            const nosing = this.bin.geometry(new THREE.TorusGeometry(step.radius, 0.1, 6, 72));
            brassBatch.addRotated(nosing, 0, step.top - 0.04, 0, Math.PI / 2);

            insertDisc(this.collisionGrid, step.radius, step.top);
        }

        const deck = this.bin.geometry(new THREE.CircleGeometry(RING_TOP_RADIUS - 0.4, 48));
        deckBatch.addRotated(deck, 0, RING_TOP_Y + 0.02, 0, -Math.PI / 2);

        const compassRing = this.bin.geometry(new THREE.TorusGeometry(RING_TOP_RADIUS - 1.6, 0.08, 4, 64));
        brassBatch.addRotated(compassRing, 0, RING_TOP_Y + 0.05, 0, Math.PI / 2);

        const spoke = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const length = i % 2 === 0 ? RING_TOP_RADIUS - 0.8 : RING_TOP_RADIUS - 3.2;
            const mid = 2.2 + length / 2;
            brassBatch.addScaled(
                spoke,
                Math.sin(angle) * mid * 0.5,
                RING_TOP_Y + 0.05,
                -Math.cos(angle) * mid * 0.5,
                0.14,
                0.05,
                length * 0.6,
                -angle
            );
        }

        const steps = stepBatch.build(materials.stone, { castShadow: true, receiveShadow: true });
        if (steps) this.scene.add(steps);

        const deckMesh = deckBatch.build(materials.darkTrim, { receiveShadow: true });
        if (deckMesh) this.scene.add(deckMesh);

        const brass = brassBatch.build(materials.brass, { receiveShadow: true });
        if (brass) this.scene.add(brass);
    }
}
